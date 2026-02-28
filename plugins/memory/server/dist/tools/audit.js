import { getDb } from "../db.js";
import { rowToMemory } from "../types.js";
export function auditMemories(opts = {}) {
    const db = getDb();
    const candidates = [];
    const limit = opts.limit ?? 50;
    const daysWarning = opts.days_warning ?? 30;
    const includeExpired = opts.include_expired ?? true;
    // Expired memories (valid_until in the past)
    if (includeExpired) {
        const expired = db
            .prepare(`SELECT * FROM memories
         WHERE valid_until IS NOT NULL AND valid_until < datetime('now')
         ORDER BY valid_until ASC
         LIMIT ?`)
            .all(limit);
        for (const row of expired) {
            candidates.push({
                memory: rowToMemory(row),
                reason: `Expired (valid_until: ${row.valid_until})`,
            });
        }
    }
    // Near-expiry memories (within N days)
    const futureDate = new Date(Date.now() + daysWarning * 86400000).toISOString();
    const nearExpiry = db
        .prepare(`SELECT * FROM memories
       WHERE valid_until IS NOT NULL
         AND valid_until >= datetime('now')
         AND valid_until < ?
       ORDER BY valid_until ASC
       LIMIT ?`)
        .all(futureDate, limit);
    for (const row of nearExpiry) {
        if (candidates.some((c) => c.memory.id === row.id))
            continue;
        candidates.push({
            memory: rowToMemory(row),
            reason: `Expiring soon (valid_until: ${row.valid_until})`,
        });
    }
    // Heavily downvoted (low confidence, likely stale)
    const lowConfidence = db
        .prepare(`SELECT * FROM memories
       WHERE confidence < 0.3
       ORDER BY confidence ASC
       LIMIT ?`)
        .all(limit);
    for (const row of lowConfidence) {
        if (candidates.some((c) => c.memory.id === row.id))
            continue;
        candidates.push({
            memory: rowToMemory(row),
            reason: `Low confidence (${row.confidence.toFixed(2)}) — likely stale`,
        });
    }
    return candidates.slice(0, limit);
}
//# sourceMappingURL=audit.js.map