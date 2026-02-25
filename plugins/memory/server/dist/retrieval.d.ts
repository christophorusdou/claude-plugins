import type { RecallResult } from "./types.js";
interface RetrievalOptions {
    query: string;
    project?: string | null;
    category?: string | null;
    limit?: number;
    min_score?: number;
}
/**
 * 3-stage retrieval pipeline:
 * 1. Orama hybrid search (vector + FTS combined)
 * 2. Load full memory records from SQLite
 * 3. Re-rank with effective rank (votes, usage, recency)
 */
export declare function recall(opts: RetrievalOptions): Promise<RecallResult[]>;
/**
 * Find memories similar to a given embedding, for dedup checks.
 */
export declare function findSimilar(embedding: Float32Array, threshold?: number, limit?: number): Promise<Array<{
    memory_id: string;
    similarity: number;
}>>;
export {};
//# sourceMappingURL=retrieval.d.ts.map