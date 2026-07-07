import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, getDataDir, checkpoint } from "../db.js";
import { appendJournal } from "../journal.js";
import { maybeScheduleSync } from "../gitsync.js";
/**
 * Deterministic, reversible lifecycle aging — the curator's automatic pass.
 *
 * Calibration note: ~100% of entries sit at score 0 (auto-captured, rarely voted).
 * Score 0 therefore means "no signal", NOT "negative signal" — only score < 0 is a
 * quality judgment. "Never retrieved" (use_count = 0) is the strongest no-value signal
 * available without votes, and it is what makes the archived tier reachable.
 *
 * Transitions (never hard-deletes; recall/upvote reactivate stale→active):
 *   active → stale:    expired (valid_until past) OR untouched > stale_days AND
 *                      (score < 0 OR never retrieved)
 *   stale  → archived: still untouched > archive_days while stale (any score)
 *
 * "untouched" = last_used_at, falling back to created_at. Transitions are computed
 * against the CURRENT state before any writes, so a memory moves at most one step per
 * run (staged aging over successive curations). 'merged' tombstones are never touched.
 *
 * A non-dry-run apply also writes the curation ledger + last-curation stamp itself
 * (deterministic effector — the LLM skill must not be trusted to bookkeep).
 */
export function ageMemories(opts = {}) {
    const db = getDb();
    const staleDays = opts.stale_days ?? 90;
    const archiveDays = opts.archive_days ?? 180;
    const dryRun = opts.dry_run ?? false;
    const now = new Date().toISOString();
    const staleCutoff = new Date(Date.now() - staleDays * 86400000).toISOString();
    const archiveCutoff = new Date(Date.now() - archiveDays * 86400000).toISOString();
    // datetime() on both sides: valid_until may be date-only ("2026-06-01") or full ISO
    // ("...T...Z"); raw TEXT comparison against datetime('now') mis-orders same-day expiry.
    const toStale = db
        .prepare(`SELECT * FROM memories
       WHERE lifecycle_state = 'active'
         AND ( (valid_until IS NOT NULL AND datetime(valid_until) < datetime('now'))
               OR (COALESCE(last_used_at, created_at) < ? AND (score < 0 OR use_count = 0)) )`)
        .all(staleCutoff);
    const toArchive = db
        .prepare(`SELECT * FROM memories
       WHERE lifecycle_state = 'stale'
         AND COALESCE(last_used_at, created_at) < ?`)
        .all(archiveCutoff);
    if (!dryRun) {
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
        recordCuration({
            action: "age",
            to_stale: toStale.length,
            to_archived: toArchive.length,
            stale_days: staleDays,
            archive_days: archiveDays,
        });
        appendJournal("age", {
            to_stale: toStale.map((r) => r.id),
            to_archived: toArchive.map((r) => r.id),
        });
        checkpoint();
    }
    const expiredBefore = (v, ref) => v !== null && new Date(v).getTime() < ref;
    const reasonStale = (r) => expiredBefore(r.valid_until, Date.now())
        ? `expired (${r.valid_until})`
        : r.score < 0
            ? `untouched >${staleDays}d, score ${r.score}`
            : `never retrieved, >${staleDays}d old`;
    const reasonArchive = (r) => `stale and untouched >${archiveDays}d`;
    return {
        dry_run: dryRun,
        to_stale: toStale.map((r) => ({ id: r.id, content: r.content.slice(0, 80), reason: reasonStale(r) })),
        to_archived: toArchive.map((r) => ({ id: r.id, content: r.content.slice(0, 80), reason: reasonArchive(r) })),
    };
}
/**
 * Consolidation effector: mark `id` as absorbed into `mergedInto`.
 * The loser becomes a tombstone (lifecycle_state='merged'): excluded from recall
 * (search queries filter merged rows), but its row + event history are KEPT —
 * never hard-deleted. This is what the consolidate workflow should call instead
 * of delete (which, via the v4 ON DELETE CASCADE, would erase the loser's event
 * history including the deletion event).
 */
export function mergeMemory(id, mergedInto) {
    const db = getDb();
    const now = new Date().toISOString();
    if (id === mergedInto)
        return "Error: a memory cannot be merged into itself";
    const loser = db.prepare("SELECT id, lifecycle_state FROM memories WHERE id = ?").get(id);
    if (!loser)
        return `Entry ${id} not found`;
    if (loser.lifecycle_state === "merged")
        return `Entry ${id} is already merged`;
    const winner = db.prepare("SELECT id, lifecycle_state FROM memories WHERE id = ?").get(mergedInto);
    if (!winner)
        return `Merge target ${mergedInto} not found`;
    if (winner.lifecycle_state === "merged")
        return `Merge target ${mergedInto} is itself merged — merge into its winner instead`;
    const tx = db.transaction(() => {
        db.prepare(`UPDATE memories SET lifecycle_state = 'merged', merged_into = ?, updated_at = ? WHERE id = ?`).run(mergedInto, now, id);
        db.prepare(`INSERT INTO memory_events(memory_id, event_type, detail, created_at) VALUES (?, 'merged', ?, ?)`).run(id, `merged into ${mergedInto}`, now);
    });
    tx();
    appendLedger({ action: "merge", id, merged_into: mergedInto });
    appendJournal("merge", { id, merged_into: mergedInto });
    checkpoint();
    maybeScheduleSync();
    return { id, merged_into: mergedInto };
}
/**
 * Deterministic bookkeeping (SciEvolve principle: tools are effectors, the LLM is
 * judgment). appendLedger records provenance; the stamp drives the SessionStart nudge
 * and is refreshed only by an actual curation pass (age), not by one-off operations.
 * Both are best-effort — they never fail the underlying operation.
 */
export function appendLedger(entry) {
    const date = new Date().toISOString().slice(0, 10);
    try {
        appendFileSync(join(getDataDir(), "curation-log.jsonl"), JSON.stringify({ date, ...entry }) + "\n");
    }
    catch {
        /* best-effort */
    }
}
function recordCuration(entry) {
    appendLedger(entry);
    try {
        writeFileSync(join(getDataDir(), "last-curation"), new Date().toISOString().slice(0, 10) + "\n");
    }
    catch {
        /* best-effort */
    }
}
//# sourceMappingURL=lifecycle.js.map