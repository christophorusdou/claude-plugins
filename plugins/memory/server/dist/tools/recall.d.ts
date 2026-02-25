import type { RecallResult } from "../types.js";
interface RecallOptions {
    query: string;
    project?: string | null;
    category?: string | null;
    limit?: number;
    min_score?: number;
}
export declare function recallMemories(opts: RecallOptions): Promise<RecallResult[]>;
export {};
//# sourceMappingURL=recall.d.ts.map