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
  lifecycle_state: MemoryLifecycleState;
  merged_into: string | null;
}

export type MemoryCategory =
  | "pattern"
  | "gotcha"
  | "preference"
  | "decision"
  | "fact"
  | "debug-insight";

export type MemorySource = "manual" | "auto-captured" | "imported";

/**
 * Curator lifecycle: active → stale → archived (reversible; reactivates on use/upvote).
 * 'merged' is a terminal tombstone: absorbed into another memory (merged_into), excluded
 * from recall entirely, kept for provenance and sync.
 */
export type MemoryLifecycleState = "active" | "stale" | "archived" | "merged";

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
  | "deleted"
  | "aged"
  | "merged";

export interface RecallResult {
  memory: Memory;
  vector_similarity: number;
  fts_score: number;
  final_score: number;
  trigger_matched: boolean;
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
  by_lifecycle: Record<string, number>;
  score_distribution: {
    negative: number;
    zero: number;
    positive: number;
    highly_rated: number;
  };
}

export interface ConsolidationGroup {
  suggested_winner: Memory;
  members: Memory[];
  avg_similarity: number;
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
  lifecycle_state: string;
  merged_into: string | null;
}

export function rowToMemory(row: MemoryRow): Memory {
  return {
    ...row,
    category: row.category as MemoryCategory,
    source: row.source as MemorySource,
    lifecycle_state: row.lifecycle_state as MemoryLifecycleState,
    tags: JSON.parse(row.tags),
    triggers: JSON.parse(row.triggers),
  };
}
