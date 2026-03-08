export declare const EMBEDDING_DIM = 384;
/** Preload the embedding model in the background to avoid cold-start latency. */
export declare function preloadModel(): void;
export declare function embed(text: string): Promise<Float32Array>;
export declare function embedBatch(texts: string[]): Promise<Float32Array[]>;
//# sourceMappingURL=embeddings.d.ts.map