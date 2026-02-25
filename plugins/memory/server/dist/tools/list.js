import { getDb } from "../db.js";
import { rowToMemory } from "../types.js";
export function listMemories(opts) {
    const db = getDb();
    const conditions = [];
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
    if (opts.category) {
        conditions.push("category = ?");
        params.push(opts.category);
    }
    if (opts.min_score !== undefined) {
        conditions.push("score >= ?");
        params.push(opts.min_score);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const rows = db
        .prepare(`SELECT * FROM memories ${where}
       ORDER BY score DESC, updated_at DESC
       LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);
    return rows.map(rowToMemory);
}
//# sourceMappingURL=list.js.map