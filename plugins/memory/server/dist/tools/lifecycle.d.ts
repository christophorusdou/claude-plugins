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
 * Transitions (never hard-deletes; recall/upvote reactivate stale→active):
 *   active → stale:    expired (valid_until past) OR (untouched > stale_days AND score <= 0)
 *   stale  → archived: (untouched > archive_days AND score < 0) OR expired > archive_days ago
 * Consolidation merges and deletes stay proposal-first (see audit/consolidate).
 *
 * "untouched" = last_used_at, falling back to created_at.
 * Transitions are computed against the CURRENT state before any writes, so a memory
 * moves at most one step per run (staged aging over successive curations).
 */
export declare function ageMemories(opts?: AgeOptions): AgeResult;
export {};
//# sourceMappingURL=lifecycle.d.ts.map