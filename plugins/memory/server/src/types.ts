export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  project: string | null;
  tags: string[];
  triggers: string[];
  source: MemorySource;
  source_detail: string | null;
  confidence: number;
  score: number;
  use_count: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  version_context: string | null;
  valid_until: string | null;
  content_hash: string;
}

export type MemoryCategory =
  | "pattern"
  | "gotcha"
  | "preference"
  | "decision"
  | "fact"
  | "debug-insight";

export type MemorySource = "manual" | "auto-captured" | "imported";

export interface MemoryEvent {
  id: number;
  memory_id: string;
  event_type: MemoryEventType;
  detail: string | null;
  created_at: string;
}

export type MemoryEventType =
  | "created"
  | "updated"
  | "upvoted"
  | "downvoted"
  | "retrieved"
  | "deleted";

export interface RecallResult {
  memory: Memory;
  vector_similarity: number;
  fts_score: number;
  final_score: number;
}

export interface StoreResult {
  id: string;
  status: "created" | "duplicate" | "near-duplicate";
  existing_id?: string;
  similarity?: number;
  project?: string | null;
}

export interface MemoryStats {
  total: number;
  by_category: Record<string, number>;
  by_project: Record<string, number>;
  by_source: Record<string, number>;
  score_distribution: {
    negative: number;
    zero: number;
    positive: number;
    highly_rated: number;
  };
}

export interface CleanupCandidate {
  memory: Memory;
  reason: string;
}

/** Row shape from SQLite for the memories table */
export interface MemoryRow {
  id: string;
  content: string;
  category: string;
  project: string | null;
  tags: string;
  triggers: string;
  source: string;
  source_detail: string | null;
  confidence: number;
  score: number;
  use_count: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  version_context: string | null;
  valid_until: string | null;
  content_hash: string;
}

export function rowToMemory(row: MemoryRow): Memory {
  return {
    ...row,
    category: row.category as MemoryCategory,
    source: row.source as MemorySource,
    tags: JSON.parse(row.tags),
    triggers: JSON.parse(row.triggers),
  };
}
