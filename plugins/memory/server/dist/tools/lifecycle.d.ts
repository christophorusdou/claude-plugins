interface AgeOptions {
    stale_days?: number;
    archive_days?: number;
    dry_run?: boolean;
}
interface AgedEntry {
    id: string;
    content: string;
    reason: string;
}
export interface AgeResult {
    dry_run: boolean;
    to_stale: AgedEntry[];
    to_archived: AgedEntry[];
}
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
export declare function ageMemories(opts?: AgeOptions): AgeResult;
export interface MergeResult {
    id: string;
    merged_into: string;
}
/**
 * Consolidation effector: mark `id` as absorbed into `mergedInto`.
 * The loser becomes a tombstone (lifecycle_state='merged'): excluded from recall
 * (search queries filter merged rows), but its row + event history are KEPT —
 * never hard-deleted. This is what the consolidate workflow should call instead
 * of delete (which, via the v4 ON DELETE CASCADE, would erase the loser's event
 * history including the deletion event).
 */
export declare function mergeMemory(id: string, mergedInto: string): MergeResult | string;
/**
 * Deterministic bookkeeping (SciEvolve principle: tools are effectors, the LLM is
 * judgment). appendLedger records provenance; the stamp drives the SessionStart nudge
 * and is refreshed only by an actual curation pass (age), not by one-off operations.
 * Both are best-effort — they never fail the underlying operation.
 */
export declare function appendLedger(entry: Record<string, unknown>): void;
export {};
//# sourceMappingURL=lifecycle.d.ts.map