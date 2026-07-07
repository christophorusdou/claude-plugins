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
    version_context?: string | null;
    valid_until?: string | null;
    /** Force the write past the near-duplicate gate */
    allow_similar?: boolean;
}
export declare function storeMemory(opts: StoreOptions): StoreResult;
export {};
//# sourceMappingURL=store.d.ts.map