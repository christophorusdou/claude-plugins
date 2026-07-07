import type Database from "better-sqlite3";
import type { ConsolidationGroup } from "./types.js";
/**
 * Lexical similarity replaces v1's embedding cosine. For short technical
 * memories (gotchas, patterns) token overlap is a strong dup signal, needs no
 * model, and is fast enough to run pairwise over the whole archive.
 */
export declare function tokenSet(s: string): Set<string>;
export declare function jaccard(a: Set<string>, b: Set<string>): number;
/** |A∩B| / min(|A|,|B|) — catches "one memory is a subset of the other" */
export declare function containment(a: Set<string>, b: Set<string>): number;
export interface NearDuplicate {
    id: string;
    similarity: number;
    content: string;
}
/**
 * Store-time near-dup gate: FTS-search the candidate content in the same
 * scope, judge the top 5 by Jaccard/containment (v1 checked only top-1 at a
 * high cosine threshold, which let paraphrases pile up).
 */
export declare function findNearDuplicates(db: Database.Database, content: string, project: string | null): NearDuplicate[];
interface ConsolidateOptions {
    project?: string | null;
    threshold?: number;
    limit?: number;
}
/**
 * Find groups of similar memories for consolidation: pairwise Jaccard over up
 * to 200 rows (≈20k pairs of set ops — milliseconds), then connected
 * components at `threshold`. Same output shape as v1 so /mem and the
 * maintenance skill are unchanged.
 */
export declare function findConsolidationGroups(db: Database.Database, opts: ConsolidateOptions): ConsolidationGroup[];
export {};
//# sourceMappingURL=similarity.d.ts.map