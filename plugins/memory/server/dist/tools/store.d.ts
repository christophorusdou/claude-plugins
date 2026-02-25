import type { MemoryCategory, MemorySource, StoreResult } from "../types.js";
interface StoreOptions {
    content: string;
    category?: MemoryCategory;
    project?: string | null;
    tags?: string[];
    triggers?: string[];
    source?: MemorySource;
    source_detail?: string | null;
    confidence?: number;
}
export declare function storeMemory(opts: StoreOptions): Promise<StoreResult>;
export {};
//# sourceMappingURL=store.d.ts.map