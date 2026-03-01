import { getDb } from "./db.js";
import { embed } from "./embeddings.js";
import { hybridSearch, vectorSearch } from "./search-index.js";
import { getDetectedProject } from "./project-detect.js";
import { rowToMemory } from "./types.js";
/**
 * 3-stage retrieval pipeline with scope-aware two-pass search:
 * 1. Two-pass Orama hybrid search (project-specific + global)
 * 2. Load full memory records from SQLite
 * 3. Re-rank with effective rank + scope boost, conflict suppression
 *
 * Project resolution:
 *   - undefined → auto-detect project, two-pass search
 *   - string → filter to that project only
 *   - null → global only
 */
export async function recall(opts) {
    const { query, category, limit = 10, min_score } = opts;
    const db = getDb();
    const queryEmbedding = await embed(query);
    // Resolve project scope
    const explicitProject = opts.project;
    const autoProject = explicitProject === undefined ? getDetectedProject() : null;
    const usesTwoPass = explicitProject === undefined && autoProject !== null;
    let searchResults;
    if (usesTwoPass) {
        // Two-pass: project-specific + global
        const [projectResults, globalResults] = await Promise.all([
            hybridSearch(query, queryEmbedding, {
                project: autoProject,
                category,
                limit: 20,
                similarity: 0.3,
            }),
            hybridSearch(query, queryEmbedding, {
                project: null, // global only
                category,
                limit: 15,
                similarity: 0.3,
            }),
        ]);
        // Merge, dedup by memory_id (project wins)
        const seen = new Set();
        searchResults = [];
        for (const r of projectResults) {
            seen.add(r.memory_id);
            searchResults.push({ ...r, isProjectResult: true });
        }
        for (const r of globalResults) {
            if (!seen.has(r.memory_id)) {
                searchResults.push({ ...r, isProjectResult: false });
            }
        }
    }
    else {
        // Single-pass: explicit project or global-only
        // No project detected or explicit scope — single-pass search
        const project = explicitProject === undefined ? null : explicitProject;
        const results = await hybridSearch(query, queryEmbedding, {
            project,
            category,
            limit: 20,
            similarity: 0.3,
        });
        searchResults = results.map((r) => ({
            ...r,
            isProjectResult: project !== null,
        }));
    }
    if (searchResults.length === 0)
        return [];
    // Stage 2: Load full records from SQLite
    const ids = searchResults.map((r) => r.memory_id);
    const memoryRows = db
        .prepare(`SELECT * FROM memories WHERE id IN (${ids.map(() => "?").join(",")})`)
        .all(...ids);
    const memoriesById = new Map();
    for (const row of memoryRows) {
        memoriesById.set(row.id, rowToMemory(row));
    }
    // Stage 3: Re-rank with effective rank + scope boost
    const results = [];
    const now = Date.now();
    for (const sr of searchResults) {
        const memory = memoriesById.get(sr.memory_id);
        if (!memory)
            continue;
        if (min_score !== undefined && memory.score < min_score)
            continue;
        // Effective rank: score + ln(use_count + 1) - 0.01 * days_since_last_used
        const daysSinceUsed = memory.last_used_at
            ? (now - new Date(memory.last_used_at).getTime()) / 86400000
            : 30;
        const effectiveRank = memory.score +
            Math.log(memory.use_count + 1) -
            0.01 * daysSinceUsed;
        // Normalize effective rank to 0-1 range (sigmoid-like)
        const normalizedRank = 1 / (1 + Math.exp(-effectiveRank / 5));
        // Scope boost: project-specific memories get +0.15 in two-pass mode
        const scopeBoost = usesTwoPass && sr.isProjectResult ? 0.15 : 0;
        // Trigger boost: +0.20 if any trigger pattern matches the query
        const triggerMatched = matchTriggers(memory.triggers, query);
        const triggerBoost = triggerMatched ? 0.20 : 0;
        // Freshness multiplier based on valid_until expiry
        let freshnessMultiplier = 1.0;
        if (memory.valid_until) {
            const expiryMs = new Date(memory.valid_until).getTime();
            const daysLeft = (expiryMs - now) / 86400000;
            if (daysLeft <= 0) {
                freshnessMultiplier = 0.3; // expired — 70% penalty
            }
            else if (daysLeft <= 7) {
                freshnessMultiplier = 0.5 + 0.5 * (daysLeft / 7); // linear ramp 0.5→1.0
            }
        }
        // Combine: 0.7 * orama + 0.15 * effective_rank + scope + trigger
        const finalScore = (sr.score * 0.7 + normalizedRank * 0.15 + scopeBoost + triggerBoost) * freshnessMultiplier;
        results.push({
            memory,
            vector_similarity: sr.score,
            fts_score: 0, // Orama combines these internally
            final_score: finalScore,
            trigger_matched: triggerMatched,
        });
    }
    // Conflict suppression: if a project memory and global memory both scored
    // highly on the same query (both >0.5 relevance, within 0.2 of each other),
    // suppress the global one — the project-specific memory is the override.
    if (usesTwoPass) {
        resolveConflicts(results);
    }
    // Sort by final score descending
    results.sort((a, b) => b.final_score - a.final_score);
    // Update use_count and last_used_at for returned results
    const updateStmt = db.prepare(`UPDATE memories SET use_count = use_count + 1, last_used_at = ? WHERE id = ?`);
    const logStmt = db.prepare(`INSERT INTO memory_events(memory_id, event_type, created_at) VALUES (?, 'retrieved', ?)`);
    const nowIso = new Date().toISOString();
    const updateBatch = db.transaction(() => {
        for (const r of results.slice(0, limit)) {
            updateStmt.run(nowIso, r.memory.id);
            logStmt.run(r.memory.id, nowIso);
        }
    });
    updateBatch();
    return results.slice(0, limit);
}
/**
 * Check if any trigger pattern matches the query string.
 * Plain strings: case-insensitive substring match.
 * Regex (e.g. /pattern/flags): RegExp test (default flag `i`).
 * Invalid regex falls back to substring match.
 */
export function matchTriggers(triggers, query) {
    if (!triggers || triggers.length === 0)
        return false;
    const lowerQuery = query.toLowerCase();
    for (const trigger of triggers) {
        const regexMatch = trigger.match(/^\/(.+)\/([gimsuy]*)$/);
        if (regexMatch) {
            try {
                const flags = regexMatch[2] || "i";
                const re = new RegExp(regexMatch[1], flags);
                if (re.test(query))
                    return true;
            }
            catch {
                // Invalid regex — fall back to substring
                if (lowerQuery.includes(trigger.toLowerCase()))
                    return true;
            }
        }
        else {
            if (lowerQuery.includes(trigger.toLowerCase()))
                return true;
        }
    }
    return false;
}
/**
 * Suppress global memories that conflict with project-specific ones.
 * Conservative: only suppresses when both score very high (>0.7) and are
 * within 0.1 of each other AND share category (indicating topic overlap).
 * This prevents unrelated global memories from being incorrectly suppressed.
 */
function resolveConflicts(results) {
    const projectMemories = results.filter((r) => r.memory.project !== null);
    const globalMemories = results.filter((r) => r.memory.project === null);
    const suppressIds = new Set();
    for (const proj of projectMemories) {
        if (proj.final_score < 0.7)
            continue;
        for (const glob of globalMemories) {
            if (glob.final_score < 0.7)
                continue;
            // Must be same category (indicates topic overlap)
            if (proj.memory.category !== glob.memory.category)
                continue;
            if (Math.abs(proj.final_score - glob.final_score) < 0.1) {
                suppressIds.add(glob.memory.id);
            }
        }
    }
    // Remove suppressed globals in-place
    for (let i = results.length - 1; i >= 0; i--) {
        if (suppressIds.has(results[i].memory.id)) {
            results.splice(i, 1);
        }
    }
}
/**
 * Find memories similar to a given embedding, for dedup checks.
 * When project is provided, limits vector dedup to same scope.
 */
export async function findSimilar(embedding, threshold = 0.85, limit = 5, project) {
    const results = await vectorSearch(embedding, {
        project,
        limit,
        similarity: threshold,
    });
    return results.map((r) => ({
        memory_id: r.memory_id,
        similarity: r.score,
    }));
}
//# sourceMappingURL=retrieval.js.map