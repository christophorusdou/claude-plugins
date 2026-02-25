import type { StoreResult } from "../types.js";
interface ImportResult {
    total_entries: number;
    created: number;
    duplicates: number;
    near_duplicates: number;
    entries: Array<{
        content: string;
        status: StoreResult["status"];
        id: string;
    }>;
}
/**
 * Parse a MEMORY.md file into individual memory entries.
 * Splits by ## headers. Each section becomes a memory entry.
 * Bullet points within a section become individual memories.
 */
export declare function importMemoryMd(filePath: string, project?: string): Promise<ImportResult>;
export {};
//# sourceMappingURL=import.d.ts.map