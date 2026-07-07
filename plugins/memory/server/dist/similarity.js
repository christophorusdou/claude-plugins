import { ftsSearch, buildMatch } from "./search.js";
import { rowToMemory } from "./types.js";
/**
 * Lexical similarity replaces v1's embedding cosine. For short technical
 * memories (gotchas, patterns) token overlap is a strong dup signal, needs no
 * model, and is fast enough to run pairwise over the whole archive.
 */
export function tokenSet(s) {
    return new Set(s.toLowerCase().match(/[a-z0-9_.-]{3,}/g) ?? []);
}
export function jaccard(a, b) {
    if (a.size === 0 || b.size === 0)
        return 0;
    let intersection = 0;
    for (const t of a)
        if (b.has(t))
            intersection++;
    return intersection / (a.size + b.size - intersection);
}
/** |A∩B| / min(|A|,|B|) — catches "one memory is a subset of the other" */
export function containment(a, b) {
    if (a.size === 0 || b.size === 0)
        return 0;
    let intersection = 0;
    for (const t of a)
        if (b.has(t))
            intersection++;
    return intersection / Math.min(a.size, b.size);
}
const NEAR_DUP_JACCARD = 0.55;
const NEAR_DUP_CONTAINMENT = 0.8;
/**
 * Store-time near-dup gate: FTS-search the candidate content in the same
 * scope, judge the top 5 by Jaccard/containment (v1 checked only top-1 at a
 * high cosine threshold, which let paraphrases pile up).
 */
export function findNearDuplicates(db, content, project) {
    const match = buildMatch(content);
    if (!match)
        return [];
    const candidates = ftsSearch(db, match, { project, limit: 5 });
    const target = tokenSet(content);
    const dups = [];
    for (const c of candidates) {
        const other = tokenSet(c.row.content);
        const j = jaccard(target, other);
        const cont = containment(target, other);
        if (j >= NEAR_DUP_JACCARD || cont >= NEAR_DUP_CONTAINMENT) {
            dups.push({
                id: c.row.id,
                similarity: Math.max(j, cont),
                content: c.row.content.slice(0, 120),
            });
        }
    }
    dups.sort((a, b) => b.similarity - a.similarity);
    return dups;
}
/**
 * Find groups of similar memories for consolidation: pairwise Jaccard over up
 * to 200 rows (≈20k pairs of set ops — milliseconds), then connected
 * components at `threshold`. Same output shape as v1 so /mem and the
 * maintenance skill are unchanged.
 */
export function findConsolidationGroups(db, opts) {
    const threshold = opts.threshold ?? 0.5;
    const groupLimit = opts.limit ?? 10;
    const conditions = ["lifecycle_state != 'merged'"];
    const params = [];
    if (opts.project !== undefined) {
        if (opts.project === null) {
            conditions.push("project IS NULL");
        }
        else {
            conditions.push("project = ?");
            params.push(opts.project);
        }
    }
    const rows = db
        .prepare(`SELECT * FROM memories WHERE ${conditions.join(" AND ")}
       ORDER BY score DESC, use_count DESC
       LIMIT 200`)
        .all(...params);
    const memories = rows.map(rowToMemory);
    if (memories.length < 2)
        return [];
    const tokens = memories.map((m) => tokenSet(m.content));
    // When project is omitted (archive-wide pass), still only group entries in
    // the SAME scope — a project gotcha and a global gotcha about the same topic
    // are an intentional override pair, not duplicates.
    const adjacency = new Map();
    const pairSimilarities = new Map();
    for (let i = 0; i < memories.length; i++) {
        for (let j = i + 1; j < memories.length; j++) {
            if ((memories[i].project ?? "") !== (memories[j].project ?? ""))
                continue;
            const sim = jaccard(tokens[i], tokens[j]);
            if (sim < threshold)
                continue;
            const a = memories[i].id;
            const b = memories[j].id;
            if (!adjacency.has(a))
                adjacency.set(a, new Set());
            if (!adjacency.has(b))
                adjacency.set(b, new Set());
            adjacency.get(a).add(b);
            adjacency.get(b).add(a);
            pairSimilarities.set([a, b].sort().join("|"), sim);
        }
    }
    const memoryById = new Map(memories.map((m) => [m.id, m]));
    // BFS connected components (ported from v1)
    const visited = new Set();
    const components = [];
    for (const id of adjacency.keys()) {
        if (visited.has(id))
            continue;
        const component = [];
        const queue = [id];
        visited.add(id);
        while (queue.length > 0) {
            const current = queue.shift();
            component.push(current);
            for (const neighbor of adjacency.get(current) ?? []) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
        if (component.length >= 2)
            components.push(component);
    }
    const groups = components.map((component) => {
        const members = component
            .map((id) => memoryById.get(id))
            .sort((a, b) => {
            if (b.score !== a.score)
                return b.score - a.score;
            if (b.use_count !== a.use_count)
                return b.use_count - a.use_count;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        let totalSim = 0;
        let pairCount = 0;
        for (let i = 0; i < component.length; i++) {
            for (let j = i + 1; j < component.length; j++) {
                const sim = pairSimilarities.get([component[i], component[j]].sort().join("|"));
                if (sim !== undefined) {
                    totalSim += sim;
                    pairCount++;
                }
            }
        }
        return {
            suggested_winner: members[0],
            members,
            avg_similarity: pairCount > 0 ? totalSim / pairCount : 0,
        };
    });
    groups.sort((a, b) => {
        if (b.members.length !== a.members.length)
            return b.members.length - a.members.length;
        return b.avg_similarity - a.avg_similarity;
    });
    return groups.slice(0, groupLimit);
}
//# sourceMappingURL=similarity.js.map