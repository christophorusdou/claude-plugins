import type Database from "better-sqlite3";
import type { MemoryRow } from "./types.js";
/**
 * Turn a natural-language query into an OR-of-phrases FTS5 MATCH expression.
 * Each term is double-quoted (phrase syntax) so FTS5 operators and punctuation
 * in user text can't break the query. Returns null when nothing survives.
 */
export declare function buildMatch(query: string): string | null;
export interface FtsCandidate {
    row: MemoryRow;
    /** Negated bm25() — higher is better, unnormalized */
    bm25: number;
}
interface SearchOptions {
    /** undefined = no scope filter; null = global only; string = that project only */
    project?: string | null;
    category?: string | null;
    limit?: number;
}
export declare function ftsSearch(db: Database.Database, match: string, opts?: SearchOptions): FtsCandidate[];
/** Substring fallback for queries that produce no usable FTS terms or no hits. */
export declare function likeSearch(db: Database.Database, query: string, opts?: SearchOptions): FtsCandidate[];
export {};
//# sourceMappingURL=search.d.ts.map