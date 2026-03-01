import type { RecallResult } from "./types.js";
interface RetrievalOptions {
    query: string;
    project?: string | null;
    category?: string | null;
    limit?: number;
    min_score?: number;
}
/**
 * 3-stage retrieval pipeline with scope-aware two-pass search:
 * 1. Two-pass Orama hybrid search (project-specific + global)
 * 2. Load full memory records from SQLite
 * 3. Re-rank with effective rank + scope boost, conflict suppression
 *
 * Project resolution:
 *   - undefined → auto-detect project, two-pass search
 *   - string → filter to that project only
 *   - null → global only
 */
export declare function recall(opts: RetrievalOptions): Promise<RecallResult[]>;
/**
 * Validate a single trigger pattern for safety.
 * Returns null if valid, or an error string if invalid.
 */
export declare function validateTrigger(trigger: string): string | null;
/**
 * Validate all triggers, returning errors for any unsafe patterns.
 */
export declare function validateTriggers(triggers: string[]): string[];
/**
 * Check if any trigger pattern matches the query string.
 * Plain strings: case-insensitive substring match.
 * Regex (e.g. /pattern/flags): RegExp test (default flag `i`).
 * Invalid regex falls back to substring match.
 */
export declare function matchTriggers(triggers: string[], query: string): boolean;
/**
 * Find memories similar to a given embedding, for dedup checks.
 * When project is provided, limits vector dedup to same scope.
 */
export declare function findSimilar(embedding: Float32Array, threshold?: number, limit?: number, project?: string | null): Promise<Array<{
    memory_id: string;
    similarity: number;
}>>;
export {};
//# sourceMappingURL=retrieval.d.ts.map