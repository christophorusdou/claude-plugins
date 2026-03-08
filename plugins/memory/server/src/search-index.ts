import { create, insert, remove, search, save, load, count } from "@orama/orama";
import type { Orama, Results, AnyOrama } from "@orama/orama";
import { persistToFile, restoreFromFile } from "@orama/plugin-data-persistence/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getDataDir } from "./db.js";

const INDEX_FILE = "search-index.json";
const SCHEMA = {
  content: "string",
  embedding: "vector[384]",
  category: "string",
  project: "string",
  memory_id: "string",
} as const;

let _index: AnyOrama | null = null;

// Write mutex: chains saves so concurrent calls don't interleave file writes
let _saveChain: Promise<void> = Promise.resolve();

function getIndexPath(): string {
  return join(getDataDir(), INDEX_FILE);
}

export async function getSearchIndex(): Promise<AnyOrama> {
  if (_index) return _index;

  const indexPath = getIndexPath();
  if (existsSync(indexPath)) {
    try {
      _index = await restoreFromFile("json", indexPath);
      return _index;
    } catch {
      // Corrupted index — rebuild
    }
  }

  _index = create({ schema: SCHEMA });
  return _index;
}

export async function saveSearchIndex(): Promise<void> {
  if (!_index) return;
  // Serialize writes: each save waits for the previous one to finish
  const prev = _saveChain;
  _saveChain = prev
    .then(async () => { await persistToFile(_index!, "json", getIndexPath()); })
    .catch(() => {});  // Don't let a failed save break the chain
  await _saveChain;
}

/**
 * Reset the in-memory index, forcing a fresh one on next getSearchIndex() call.
 * Used by rebuildSearchIndex to clear stale entries.
 */
export function resetSearchIndex(): void {
  _index = null;
}

export async function indexMemory(
  memoryId: string,
  content: string,
  embedding: number[] | Float32Array,
  category: string,
  project: string
): Promise<void> {
  const index = await getSearchIndex();
  await insert(index, {
    id: memoryId,
    content,
    embedding: Array.from(embedding),
    category,
    project: project || "",
    memory_id: memoryId,
  });
}

export async function removeFromIndex(memoryId: string): Promise<void> {
  const index = await getSearchIndex();
  try {
    await remove(index, memoryId);
  } catch {
    // Document might not exist in index
  }
}

export async function updateInIndex(
  memoryId: string,
  content: string,
  embedding: number[] | Float32Array,
  category: string,
  project: string
): Promise<void> {
  await removeFromIndex(memoryId);
  await indexMemory(memoryId, content, embedding, category, project);
}

export interface SearchResult {
  memory_id: string;
  score: number;
}

export async function hybridSearch(
  query: string,
  queryEmbedding: number[] | Float32Array,
  opts: {
    project?: string | null;
    category?: string | null;
    limit?: number;
    similarity?: number;
  } = {}
): Promise<SearchResult[]> {
  const index = await getSearchIndex();
  const { limit = 20, similarity = 0.5 } = opts;

  const where: Record<string, any> = {};
  if (opts.project !== undefined) {
    // null means "global only" (empty string in Orama)
    // string means "this specific project"
    where.project = { eq: opts.project === null ? "" : opts.project };
  }
  if (opts.category) {
    where.category = { eq: opts.category };
  }

  const results = await search(index, {
    mode: "hybrid",
    term: query,
    vector: {
      value: Array.from(queryEmbedding),
      property: "embedding",
    },
    similarity,
    limit,
    ...(Object.keys(where).length > 0 ? { where } : {}),
  });

  return results.hits.map((hit) => ({
    memory_id: (hit.document as any).memory_id as string,
    score: hit.score,
  }));
}

export async function vectorSearch(
  queryEmbedding: number[] | Float32Array,
  opts: {
    project?: string | null;
    limit?: number;
    similarity?: number;
  } = {}
): Promise<SearchResult[]> {
  const index = await getSearchIndex();
  const { limit = 5, similarity = 0.5 } = opts;

  const where: Record<string, any> = {};
  if (opts.project !== undefined) {
    where.project = { eq: opts.project === null ? "" : opts.project };
  }

  const results = await search(index, {
    mode: "vector",
    vector: {
      value: Array.from(queryEmbedding),
      property: "embedding",
    },
    similarity,
    limit,
    ...(Object.keys(where).length > 0 ? { where } : {}),
  });

  return results.hits.map((hit) => ({
    memory_id: (hit.document as any).memory_id as string,
    score: hit.score,
  }));
}

export async function getIndexCount(): Promise<number> {
  const index = await getSearchIndex();
  return count(index);
}
