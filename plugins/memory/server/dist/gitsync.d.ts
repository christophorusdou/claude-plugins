/**
 * Write-triggered sync scheduler: every mutation calls this; at most once per
 * MEMORY_SYNC_INTERVAL_MIN (default 15) it spawns a detached `cli.js sync` so
 * commits/pushes happen DURING long sessions, not only at SessionEnd — and a
 * crashed session's writes ship at the next session start, which also calls
 * this. Never blocks or fails the calling tool.
 */
export declare function maybeScheduleSync(): void;
export interface SyncStatus {
    status: "ok" | "failed";
    ts: string;
}
export declare function readSyncStatus(): SyncStatus | null;
/**
 * Auto-sync (SessionEnd hook + write-triggered scheduler): snapshot → commit
 * when dirty → detached push whenever local commits aren't on the remote yet.
 */
export declare function autoSync(): string;
/** Manual sync operations for memory_manage action:"sync" (blocking, verbose). */
export declare function gitSync(operation: "push" | "pull" | "status"): string;
//# sourceMappingURL=gitsync.d.ts.map