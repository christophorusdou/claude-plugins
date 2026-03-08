const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIM = 384;

// Use `any` for the extractor to avoid TS2590 (union type too complex)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _extractor: any = null;

// Simple LRU cache for embeddings
const CACHE_SIZE = 256;
const _cache = new Map<string, Float32Array>();

async function getExtractor(): Promise<any> {
  if (_extractor) return _extractor;
  const { pipeline } = await import("@huggingface/transformers");
  _extractor = await (pipeline as any)("feature-extraction", MODEL_NAME, {
    dtype: "fp32",
  });
  return _extractor;
}

/** Preload the embedding model in the background to avoid cold-start latency. */
export function preloadModel(): void {
  getExtractor().catch(() => {});
}

export async function embed(text: string): Promise<Float32Array> {
  // Check cache — delete+re-insert to move to end (LRU order)
  const cached = _cache.get(text);
  if (cached) {
    _cache.delete(text);
    _cache.set(text, cached);
    return cached;
  }

  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  const embedding = new Float32Array(output.data);

  // LRU eviction: remove oldest (first) entry
  if (_cache.size >= CACHE_SIZE) {
    const firstKey = _cache.keys().next().value!;
    _cache.delete(firstKey);
  }
  _cache.set(text, embedding);

  return embedding;
}

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];

  // Separate cached vs uncached texts
  const results = new Array<Float32Array>(texts.length);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const cached = _cache.get(texts[i]);
    if (cached) {
      // LRU: move to end on access
      _cache.delete(texts[i]);
      _cache.set(texts[i], cached);
      results[i] = cached;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  }

  if (uncachedTexts.length > 0) {
    // Use pipeline's native batching for uncached texts
    const extractor = await getExtractor();
    const output = await extractor(uncachedTexts, {
      pooling: "mean",
      normalize: true,
    });

    for (let j = 0; j < uncachedTexts.length; j++) {
      const embedding = new Float32Array(output[j].data);
      const idx = uncachedIndices[j];
      results[idx] = embedding;

      // Cache the result
      if (_cache.size >= CACHE_SIZE) {
        const firstKey = _cache.keys().next().value!;
        _cache.delete(firstKey);
      }
      _cache.set(uncachedTexts[j], embedding);
    }
  }

  return results;
}
