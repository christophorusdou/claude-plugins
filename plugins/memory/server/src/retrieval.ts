import { getDb } from "./db.js";
import { buildMatch, ftsSearch, likeSearch } from "./search.js";
import type { FtsCandidate } from "./search.js";
import { getDetectedProject } from "./detect.js";
import { finalScore, MIN_RELEVANCE } from "./rank.js";
import type { MemoryRow, RecallResult } from "./types.js";
import { rowToMemory } from "./types.js";

interface RetrievalOptions {
  query: string;
  project?: string | null;
  category?: string | null;
  limit?: number;
  min_score?: number;
}

/**
 * Retrieval pipeline (v2, FTS5): scope-aware two-pass BM25 search → normalize
 * relevance across the merged candidate set → rerank via the shared rank.ts
 * signals → conflict suppression → use accounting.
 *
 * Project resolution (unchanged from v1):
 *   - undefined → auto-detect project, two-pass search (project + global)
 *   - string → that project only
 *   - null → global only
 */
export function recall(opts: RetrievalOptions): RecallResult[] {
  const { query, category, limit = 5, min_score } = opts;
  const db = getDb();

  const explicitProject = opts.project;
  const autoProject = explicitProject === undefined ? getDetectedProject() : null;
  const usesTwoPass = explicitProject === undefined && autoProject !== null;

  type Candidate = { cand: FtsCandidate; isProjectResult: boolean };
  let candidates: Candidate[] = [];

  const match = buildMatch(query);
  if (match) {
    if (usesTwoPass) {
      const projectResults = ftsSearch(db, match, { project: autoProject, category, limit: 20 });
      const globalResults = ftsSearch(db, match, { project: null, category, limit: 15 });
      const seen = new Set(projectResults.map((c) => c.row.id));
      candidates = [
        ...projectResults.map((cand) => ({ cand, isProjectResult: true })),
        ...globalResults
          .filter((c) => !seen.has(c.row.id))
          .map((cand) => ({ cand, isProjectResult: false })),
      ];
    } else {
      const project = explicitProject === undefined ? null : explicitProject;
      candidates = ftsSearch(db, match, { project, category, limit: 20 }).map((cand) => ({
        cand,
        isProjectResult: project !== null,
      }));
    }
  }

  // Substring fallback when tokenization or FTS produced nothing
  if (candidates.length === 0) {
    if (usesTwoPass) {
      const projectResults = likeSearch(db, query, { project: autoProject, category, limit: 10 });
      const globalResults = likeSearch(db, query, { project: null, category, limit: 10 });
      const seen = new Set(projectResults.map((c) => c.row.id));
      candidates = [
        ...projectResults.map((cand) => ({ cand, isProjectResult: true })),
        ...globalResults
          .filter((c) => !seen.has(c.row.id))
          .map((cand) => ({ cand, isProjectResult: false })),
      ];
    } else {
      const project = explicitProject === undefined ? null : explicitProject;
      candidates = likeSearch(db, query, { project, category, limit: 10 }).map((cand) => ({
        cand,
        isProjectResult: project !== null,
      }));
    }
  }

  if (candidates.length === 0) return [];

  // Normalize BM25 to 0–1 across the merged candidate set
  const maxBm25 = Math.max(...candidates.map((c) => c.cand.bm25));
  const nowMs = Date.now();

  const results: RecallResult[] = [];
  for (const { cand, isProjectResult } of candidates) {
    const memory = rowToMemory(cand.row);
    if (min_score !== undefined && memory.score < min_score) continue;

    const relevance = maxBm25 > 0 ? cand.bm25 / maxBm25 : 0;
    if (relevance < MIN_RELEVANCE) continue;

    const triggerMatched = matchTriggers(memory.triggers, query);

    results.push({
      memory,
      relevance,
      final_score: finalScore(
        memory,
        {
          relevance,
          scopeBoosted: usesTwoPass && isProjectResult,
          triggerMatched,
        },
        nowMs
      ),
      trigger_matched: triggerMatched,
    });
  }

  if (usesTwoPass) {
    resolveConflicts(results);
  }

  results.sort((a, b) => b.final_score - a.final_score);

  // Use accounting for returned results (query-driven retrieval earns use_count)
  const updateStmt = db.prepare(
    `UPDATE memories SET use_count = use_count + 1, last_used_at = ? WHERE id = ?`
  );
  const logStmt = db.prepare(
    `INSERT INTO memory_events(memory_id, event_type, created_at) VALUES (?, 'retrieved', ?)`
  );
  // Reactivate on use: a recalled 'stale' memory is evidently still useful → back to active.
  // Deliberately asymmetric: 'archived' does NOT reactivate on recall (it was buried by
  // prolonged disuse and still ranks at 0.1×) — only an explicit upvote revives it.
  const reactivateStmt = db.prepare(
    `UPDATE memories SET lifecycle_state = 'active' WHERE id = ? AND lifecycle_state = 'stale'`
  );
  const reactivateLog = db.prepare(
    `INSERT INTO memory_events(memory_id, event_type, detail, created_at) VALUES (?, 'aged', 'stale→active (reused)', ?)`
  );
  const nowIso = new Date().toISOString();
  const updateBatch = db.transaction(() => {
    for (const r of results.slice(0, limit)) {
      updateStmt.run(nowIso, r.memory.id);
      logStmt.run(r.memory.id, nowIso);
      if (r.memory.lifecycle_state === "stale") {
        reactivateStmt.run(r.memory.id);
        reactivateLog.run(r.memory.id, nowIso);
      }
    }
  });
  updateBatch();

  return results.slice(0, limit);
}

/** Patterns that indicate ReDoS-vulnerable regex (nested quantifiers, overlapping alternation) */
const REDOS_PATTERN = /(\+|\*|\{)\s*\)[\+\*\?]|\(\?[^)]*\)\{|\(\?[^)]*\)\+|\(\?[^)]*\)\*|(\+|\*)\s*\1/;

/**
 * Validate a single trigger pattern for safety.
 * Returns null if valid, or an error string if invalid.
 */
export function validateTrigger(trigger: string): string | null {
  const regexMatch = trigger.match(/^\/(.+)\/([gimsuy]*)$/);
  if (!regexMatch) return null; // plain strings are always safe

  try {
    new RegExp(regexMatch[1], regexMatch[2] || "i");
  } catch {
    return `Invalid regex: ${trigger}`;
  }

  if (REDOS_PATTERN.test(regexMatch[1])) {
    return `Potentially unsafe regex (nested quantifiers): ${trigger}`;
  }

  return null;
}

/** Validate all triggers, returning errors for any unsafe patterns. */
export function validateTriggers(triggers: string[]): string[] {
  const errors: string[] = [];
  for (const trigger of triggers) {
    const err = validateTrigger(trigger);
    if (err) errors.push(err);
  }
  return errors;
}

/**
 * Check if any trigger pattern matches the query string.
 * Plain strings: case-insensitive substring match.
 * Regex (e.g. /pattern/flags): RegExp test (default flag `i`).
 * Invalid regex falls back to substring match.
 */
export function matchTriggers(triggers: string[], query: string): boolean {
  if (!triggers || triggers.length === 0) return false;
  const lowerQuery = query.toLowerCase();

  for (const trigger of triggers) {
    const regexMatch = trigger.match(/^\/(.+)\/([gimsuy]*)$/);
    if (regexMatch) {
      try {
        const flags = regexMatch[2] || "i";
        const pattern = regexMatch[1];
        if (REDOS_PATTERN.test(pattern)) continue;
        const re = new RegExp(pattern, flags);
        if (re.test(query)) return true;
      } catch {
        if (lowerQuery.includes(trigger.toLowerCase())) return true;
      }
    } else {
      if (lowerQuery.includes(trigger.toLowerCase())) return true;
    }
  }
  return false;
}

/**
 * Suppress global memories that conflict with project-specific ones.
 * Conservative: only when both are highly relevant (>0.7 normalized BM25),
 * within 0.1 of each other, AND share category — the project-specific memory
 * is treated as the intentional override.
 */
function resolveConflicts(results: RecallResult[]): void {
  const projectMemories = results.filter((r) => r.memory.project !== null);
  const globalMemories = results.filter((r) => r.memory.project === null);

  const suppressIds = new Set<string>();

  for (const proj of projectMemories) {
    if (proj.relevance < 0.7) continue;
    for (const glob of globalMemories) {
      if (glob.relevance < 0.7) continue;
      if (proj.memory.category !== glob.memory.category) continue;
      if (Math.abs(proj.relevance - glob.relevance) < 0.1) {
        suppressIds.add(glob.memory.id);
      }
    }
  }

  for (let i = results.length - 1; i >= 0; i--) {
    if (suppressIds.has(results[i].memory.id)) {
      results.splice(i, 1);
    }
  }
}

// Re-exported so existing imports keep working
export type { MemoryRow };
