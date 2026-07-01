import { getDb } from "../db.js";
/**
 * Deterministic, reversible lifecycle aging — the curator's automatic pass.
 * Transitions (never hard-deletes; recall/upvote reactivate stale→active):
 *   active → stale:    expired (valid_until past) OR (untouched > stale_days AND score <= 0)
 *   stale  → archived: (untouched > archive_days AND score < 0) OR expired > archive_days ago
 * Consolidation merges and deletes stay proposal-first (see audit/consolidate).
 *
 * "untouched" = last_used_at, falling back to created_at.
 * Transitions are computed against the CURRENT state before any writes, so a memory
 * moves at most one step per run (staged aging over successive curations).
 */
export function ageMemories(opts = {}) {
    const db = getDb();
    const staleDays = opts.stale_days ?? 90;
    const archiveDays = opts.archive_days ?? 180;
    const dryRun = opts.dry_run ?? false;
    const now = new Date().toISOString();
    const staleCutoff = new Date(Date.now() - staleDays * 86400000).toISOString();
    const archiveCutoff = new Date(Date.now() - archiveDays * 86400000).toISOString();
    const toStale = db
        .prepare(`SELECT * FROM memories
       WHERE lifecycle_state = 'active'
         AND ( (valid_until IS NOT NULL AND valid_until < datetime('now'))
               OR (COALESCE(last_used_at, created_at) < ? AND score <= 0) )`)
        .all(staleCutoff);
    const toArchive = db
        .prepare(`SELECT * FROM memories
       WHERE lifecycle_state = 'stale'
         AND ( (COALESCE(last_used_at, created_at) < ? AND score < 0)
               OR (valid_until IS NOT NULL AND valid_until < ?) )`)
        .all(archiveCutoff, archiveCutoff);
    if (!dryRun && (toStale.length > 0 || toArchive.length > 0)) {
        const setState = db.prepare(`UPDATE memories SET lifecycle_state = ?, updated_at = ? WHERE id = ?`);
        const logEvt = db.prepare(`INSERT INTO memory_events(memory_id, event_type, detail, created_at) VALUES (?, 'aged', ?, ?)`);
        const apply = db.transaction(() => {
            for (const r of toStale) {
                setState.run("stale", now, r.id);
                logEvt.run(r.id, "active→stale", now);
            }
            for (const r of toArchive) {
                setState.run("archived", now, r.id);
                logEvt.run(r.id, "stale→archived", now);
            }
        });
        apply();
    }
    const reasonStale = (r) => r.valid_until && r.valid_until < now ? `expired (${r.valid_until})` : `untouched >${staleDays}d, score ${r.score}`;
    const reasonArchive = (r) => r.valid_until && r.valid_until < archiveCutoff ? `expired >${archiveDays}d ago` : `untouched >${archiveDays}d, score ${r.score}`;
    return {
        dry_run: dryRun,
        to_stale: toStale.map((r) => ({ id: r.id, content: r.content.slice(0, 80), reason: reasonStale(r) })),
        to_archived: toArchive.map((r) => ({ id: r.id, content: r.content.slice(0, 80), reason: reasonArchive(r) })),
    };
}
//# sourceMappingURL=lifecycle.js.map