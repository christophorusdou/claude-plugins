import type { Memory, MemoryCategory } from "../types.js";
interface UpdateOptions {
    id: string;
    content?: string;
    category?: MemoryCategory;
    project?: string | null;
    tags?: string[];
    triggers?: string[];
}
export declare function updateMemory(opts: UpdateOptions): Promise<Memory | null>;
export {};
//# sourceMappingURL=update.d.ts.map