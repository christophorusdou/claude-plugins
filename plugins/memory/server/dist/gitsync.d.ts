export interface SyncStatus {
    status: "ok" | "failed";
    ts: string;
}
export declare function readSyncStatus(): SyncStatus | null;
/**
 * SessionEnd auto-sync: snapshot → commit when dirty → debounced detached push.
 */
export declare function autoSync(): string;
/** Manual sync operations for memory_manage action:"sync" (blocking, verbose). */
export declare function gitSync(operation: "push" | "pull" | "status"): string;
//# sourceMappingURL=gitsync.d.ts.map