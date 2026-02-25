import { recall } from "../retrieval.js";
import type { RecallResult } from "../types.js";

interface RecallOptions {
  query: string;
  project?: string | null;
  category?: string | null;
  limit?: number;
  min_score?: number;
}

export async function recallMemories(
  opts: RecallOptions
): Promise<RecallResult[]> {
  return recall({
    query: opts.query,
    project: opts.project,
    category: opts.category,
    limit: opts.limit ?? 10,
    min_score: opts.min_score,
  });
}
