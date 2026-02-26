import type { AnyOrama } from "@orama/orama";
export declare function getSearchIndex(): Promise<AnyOrama>;
export declare function saveSearchIndex(): Promise<void>;
export declare function indexMemory(memoryId: string, content: string, embedding: number[] | Float32Array, category: string, project: string): Promise<void>;
export declare function removeFromIndex(memoryId: string): Promise<void>;
export declare function updateInIndex(memoryId: string, content: string, embedding: number[] | Float32Array, category: string, project: string): Promise<void>;
export interface SearchResult {
    memory_id: string;
    score: number;
}
export declare function hybridSearch(query: string, queryEmbedding: number[] | Float32Array, opts?: {
    project?: string | null;
    category?: string | null;
    limit?: number;
    similarity?: number;
}): Promise<SearchResult[]>;
export declare function vectorSearch(queryEmbedding: number[] | Float32Array, opts?: {
    project?: string | null;
    limit?: number;
    similarity?: number;
}): Promise<SearchResult[]>;
export declare function getIndexCount(): Promise<number>;
//# sourceMappingURL=search-index.d.ts.map