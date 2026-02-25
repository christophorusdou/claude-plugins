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

export async function embed(text: string): Promise<Float32Array> {
  // Check cache
  const cached = _cache.get(text);
  if (cached) return cached;

  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  const embedding = new Float32Array(output.data);

  // LRU eviction
  if (_cache.size >= CACHE_SIZE) {
    const firstKey = _cache.keys().next().value!;
    _cache.delete(firstKey);
  }
  _cache.set(text, embedding);

  return embedding;
}

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  // Process sequentially to avoid memory spikes
  const results: Float32Array[] = [];
  for (const text of texts) {
    results.push(await embed(text));
  }
  return results;
}
