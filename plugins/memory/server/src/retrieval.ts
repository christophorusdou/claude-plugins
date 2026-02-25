import { getDb } from "./db.js";
import { embed } from "./embeddings.js";
import { hybridSearch, vectorSearch } from "./search-index.js";
import type { Memory, MemoryRow, RecallResult } from "./types.js";
import { rowToMemory } from "./types.js";

interface RetrievalOptions {
  query: string;
  project?: string | null;
  category?: string | null;
  limit?: number;
  min_score?: number;
}

/**
 * 3-stage retrieval pipeline:
 * 1. Orama hybrid search (vector + FTS combined)
 * 2. Load full memory records from SQLite
 * 3. Re-rank with effective rank (votes, usage, recency)
 */
export async function recall(opts: RetrievalOptions): Promise<RecallResult[]> {
  const { query, project, category, limit = 10, min_score } = opts;
  const db = getDb();

  // Stage 1: Orama hybrid search — top 20 candidates
  const queryEmbedding = await embed(query);
  const searchResults = await hybridSearch(query, queryEmbedding, {
    project,
    category,
    limit: 20,
    similarity: 0.3,
  });

  if (searchResults.length === 0) return [];

  // Stage 2: Load full records from SQLite
  const ids = searchResults.map((r) => r.memory_id);
  const memoryRows = db
    .prepare(
      `SELECT * FROM memories WHERE id IN (${ids.map(() => "?").join(",")})`
    )
    .all(...ids) as MemoryRow[];

  const memoriesById = new Map<string, Memory>();
  for (const row of memoryRows) {
    memoriesById.set(row.id, rowToMemory(row));
  }

  // Stage 3: Re-rank with effective rank
  const results: RecallResult[] = [];
  const now = Date.now();

  for (const sr of searchResults) {
    const memory = memoriesById.get(sr.memory_id);
    if (!memory) continue;

    // Apply min_score filter
    if (min_score !== undefined && memory.score < min_score) continue;

    // Effective rank: score + ln(use_count + 1) - 0.01 * days_since_last_used
    const daysSinceUsed = memory.last_used_at
      ? (now - new Date(memory.last_used_at).getTime()) / 86400000
      : 30;
    const effectiveRank =
      memory.score +
      Math.log(memory.use_count + 1) -
      0.01 * daysSinceUsed;

    // Normalize effective rank to 0-1 range (sigmoid-like)
    const normalizedRank = 1 / (1 + Math.exp(-effectiveRank / 5));

    // Combine Orama score (already hybrid) with effective rank
    const finalScore = sr.score * 0.8 + normalizedRank * 0.2;

    results.push({
      memory,
      vector_similarity: sr.score,
      fts_score: 0, // Orama combines these internally
      final_score: finalScore,
    });
  }

  // Sort by final score descending
  results.sort((a, b) => b.final_score - a.final_score);

  // Update use_count and last_used_at for returned results
  const updateStmt = db.prepare(
    `UPDATE memories SET use_count = use_count + 1, last_used_at = ? WHERE id = ?`
  );
  const logStmt = db.prepare(
    `INSERT INTO memory_events(memory_id, event_type, created_at) VALUES (?, 'retrieved', ?)`
  );
  const nowIso = new Date().toISOString();
  const updateBatch = db.transaction(() => {
    for (const r of results.slice(0, limit)) {
      updateStmt.run(nowIso, r.memory.id);
      logStmt.run(r.memory.id, nowIso);
    }
  });
  updateBatch();

  return results.slice(0, limit);
}

/**
 * Find memories similar to a given embedding, for dedup checks.
 */
export async function findSimilar(
  embedding: Float32Array,
  threshold: number = 0.85,
  limit: number = 5
): Promise<Array<{ memory_id: string; similarity: number }>> {
  const results = await vectorSearch(embedding, {
    limit,
    similarity: threshold,
  });

  return results.map((r) => ({
    memory_id: r.memory_id,
    similarity: r.score,
  }));
}
