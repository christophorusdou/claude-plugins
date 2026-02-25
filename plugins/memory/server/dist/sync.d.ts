/** Export all memories to JSONL (the sync source of truth) */
export declare function exportToJsonl(): number;
/** Import from JSONL, rebuilding the database. Idempotent via content_hash. */
export declare function importFromJsonl(): Promise<{
    imported: number;
    skipped: number;
}>;
/**
 * Rebuild the Orama search index from all memories in SQLite.
 * Used after sync pull or when index is corrupted.
 */
export declare function rebuildSearchIndex(): Promise<number>;
/** Git operations for sync */
export declare function gitSync(operation: "push" | "pull" | "status"): string;
//# sourceMappingURL=sync.d.ts.map