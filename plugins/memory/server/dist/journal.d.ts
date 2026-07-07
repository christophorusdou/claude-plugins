export declare const SNAPSHOT_FILE = "memories.jsonl";
export declare function appendJournal(op: string, data: Record<string, unknown>): void;
/** Full-table dump via temp-file + atomic rename (git never sees a torn file). */
export declare function writeSnapshot(): number;
/** First-run bootstrap: seed the journal with one snapshot line per existing row. */
export declare function ensureJournalBootstrap(): void;
export declare function journalLineCount(): number;
/** Import from the snapshot JSONL. Idempotent via (content_hash, scope). */
export declare function importFromJsonl(): {
    imported: number;
    skipped: number;
};
//# sourceMappingURL=journal.d.ts.map