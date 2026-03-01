import { getDb } from "../db.js";
import { embed } from "../embeddings.js";
import { findSimilar } from "../retrieval.js";
import type { Memory, MemoryRow, ConsolidationGroup } from "../types.js";
import { rowToMemory } from "../types.js";

interface ConsolidateOptions {
  project?: string | null;
  threshold?: number;
  limit?: number;
}

/**
 * Find groups of similar memories that could be consolidated.
 * Uses BFS connected components on a similarity adjacency graph.
 */
export async function findConsolidationGroups(
  opts: ConsolidateOptions
): Promise<ConsolidationGroup[]> {
  const db = getDb();
  const threshold = opts.threshold ?? 0.70;
  const groupLimit = opts.limit ?? 10;

  // Load up to 200 memories, sorted by score DESC
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts.project !== undefined) {
    if (opts.project === null) {
      conditions.push("project IS NULL");
    } else {
      conditions.push("project = ?");
      params.push(opts.project);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT * FROM memories ${where}
       ORDER BY score DESC, use_count DESC
       LIMIT 200`
    )
    .all(...params) as MemoryRow[];

  const memories = rows.map(rowToMemory);
  if (memories.length < 2) return [];

  // Build ID set for fast lookup
  const memorySet = new Set(memories.map((m) => m.id));
  const memoryById = new Map(memories.map((m) => [m.id, m]));

  // Embed all memories and find similar pairs (batched for performance)
  const adjacency = new Map<string, Set<string>>();
  const pairSimilarities = new Map<string, number>(); // "id1|id2" → similarity

  const BATCH_SIZE = 20;
  for (let i = 0; i < memories.length; i += BATCH_SIZE) {
    const batch = memories.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (memory) => {
        const embedding = await embed(memory.content);
        // When project is explicitly specified, scope search to that project.
        // When omitted (all projects), don't scope — allow cross-project grouping.
        const searchProject = opts.project !== undefined ? memory.project : undefined;
        const similar = await findSimilar(embedding, threshold, 10, searchProject);

        for (const s of similar) {
          if (s.memory_id === memory.id) continue; // skip self
          if (!memorySet.has(s.memory_id)) continue; // only include candidates in our set

          // Add bidirectional edge
          if (!adjacency.has(memory.id)) adjacency.set(memory.id, new Set());
          if (!adjacency.has(s.memory_id)) adjacency.set(s.memory_id, new Set());
          adjacency.get(memory.id)!.add(s.memory_id);
          adjacency.get(s.memory_id)!.add(memory.id);

          // Store similarity (use sorted key to avoid duplicates)
          const pairKey = [memory.id, s.memory_id].sort().join("|");
          if (!pairSimilarities.has(pairKey)) {
            pairSimilarities.set(pairKey, s.similarity);
          }
        }
      })
    );
  }

  // BFS connected components
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const id of adjacency.keys()) {
    if (visited.has(id)) continue;

    const component: string[] = [];
    const queue = [id];
    visited.add(id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      const neighbors = adjacency.get(current);
      if (!neighbors) continue;

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // Filter singletons
    if (component.length >= 2) {
      components.push(component);
    }
  }

  // Convert to ConsolidationGroups
  const groups: ConsolidationGroup[] = components.map((component) => {
    const members = component
      .map((id) => memoryById.get(id)!)
      .sort((a, b) => {
        // Sort by score DESC, use_count DESC, created_at ASC
        if (b.score !== a.score) return b.score - a.score;
        if (b.use_count !== a.use_count) return b.use_count - a.use_count;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    // Calculate average similarity across all pairs in this component
    let totalSim = 0;
    let pairCount = 0;
    for (let i = 0; i < component.length; i++) {
      for (let j = i + 1; j < component.length; j++) {
        const pairKey = [component[i], component[j]].sort().join("|");
        const sim = pairSimilarities.get(pairKey);
        if (sim !== undefined) {
          totalSim += sim;
          pairCount++;
        }
      }
    }

    return {
      suggested_winner: members[0],
      members,
      avg_similarity: pairCount > 0 ? totalSim / pairCount : 0,
    };
  });

  // Sort groups: largest first, then by avg similarity DESC
  groups.sort((a, b) => {
    if (b.members.length !== a.members.length)
      return b.members.length - a.members.length;
    return b.avg_similarity - a.avg_similarity;
  });

  return groups.slice(0, groupLimit);
}
