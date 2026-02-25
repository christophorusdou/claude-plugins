import type { Memory } from "../types.js";
interface ListOptions {
    project?: string | null;
    category?: string | null;
    min_score?: number;
    limit?: number;
    offset?: number;
}
export declare function listMemories(opts: ListOptions): Memory[];
export {};
//# sourceMappingURL=list.d.ts.map