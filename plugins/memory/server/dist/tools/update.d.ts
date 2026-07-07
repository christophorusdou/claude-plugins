import type { Memory, MemoryCategory } from "../types.js";
interface UpdateOptions {
    id: string;
    content?: string;
    category?: MemoryCategory;
    project?: string | null;
    tags?: string[];
    triggers?: string[];
    version_context?: string | null;
    valid_until?: string | null;
}
export declare function updateMemory(opts: UpdateOptions): Memory | null;
export {};
//# sourceMappingURL=update.d.ts.map