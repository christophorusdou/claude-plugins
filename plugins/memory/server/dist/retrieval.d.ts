import type { MemoryRow, RecallResult } from "./types.js";
interface RetrievalOptions {
    query: string;
    project?: string | null;
    category?: string | null;
    limit?: number;
    min_score?: number;
}
/**
 * Retrieval pipeline (v2, FTS5): scope-aware two-pass BM25 search → normalize
 * relevance across the merged candidate set → rerank via the shared rank.ts
 * signals → conflict suppression → use accounting.
 *
 * Project resolution (unchanged from v1):
 *   - undefined → auto-detect project, two-pass search (project + global)
 *   - string → that project only
 *   - null → global only
 */
export declare function recall(opts: RetrievalOptions): RecallResult[];
/**
 * Validate a single trigger pattern for safety.
 * Returns null if valid, or an error string if invalid.
 */
export declare function validateTrigger(trigger: string): string | null;
/** Validate all triggers, returning errors for any unsafe patterns. */
export declare function validateTriggers(triggers: string[]): string[];
/**
 * Check if any trigger pattern matches the query string.
 * Plain strings: case-insensitive substring match.
 * Regex (e.g. /pattern/flags): RegExp test (default flag `i`).
 * Invalid regex falls back to substring match.
 */
export declare function matchTriggers(triggers: string[], query: string): boolean;
export type { MemoryRow };
//# sourceMappingURL=retrieval.d.ts.map