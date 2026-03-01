import type { ConsolidationGroup } from "../types.js";
interface ConsolidateOptions {
    project?: string | null;
    threshold?: number;
    limit?: number;
}
/**
 * Find groups of similar memories that could be consolidated.
 * Uses BFS connected components on a similarity adjacency graph.
 */
export declare function findConsolidationGroups(opts: ConsolidateOptions): Promise<ConsolidationGroup[]>;
export {};
//# sourceMappingURL=consolidate.d.ts.map