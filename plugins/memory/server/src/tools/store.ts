import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import { getDb } from "../db.js";
import { embed } from "../embeddings.js";
import { findSimilar } from "../retrieval.js";
import { indexMemory, saveSearchIndex } from "../search-index.js";
import type { MemoryCategory, MemoryRow, MemorySource, StoreResult } from "../types.js";

const CATEGORY_KEYWORDS: Record<MemoryCategory, string[]> = {
  pattern: ["pattern", "convention", "always", "standard", "approach", "architecture"],
  gotcha: ["gotcha", "watch out", "careful", "trap", "pitfall", "caveat", "workaround", "bug"],
  preference: ["prefer", "use", "don't use", "avoid", "instead of", "rather than", "like to"],
  decision: ["decided", "chose", "decision", "went with", "picked", "selected"],
  fact: ["is", "has", "uses", "runs on", "located at", "version"],
  "debug-insight": ["debug", "fix", "error", "resolved", "caused by", "root cause", "solution"],
};

function autoDetectCategory(content: string): MemoryCategory {
  const lower = content.toLowerCase();
  let bestCategory: MemoryCategory = "fact";
  let bestScore = 0;

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat as MemoryCategory;
    }
  }

  return bestCategory;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex");
}

interface StoreOptions {
  content: string;
  category?: MemoryCategory;
  project?: string | null;
  tags?: string[];
  triggers?: string[];
  source?: MemorySource;
  source_detail?: string | null;
  confidence?: number;
}

export async function storeMemory(opts: StoreOptions): Promise<StoreResult> {
  const db = getDb();
  const contentHash = hashContent(opts.content);

  // Layer 1: Exact duplicate check via content hash
  const existing = db
    .prepare("SELECT id FROM memories WHERE content_hash = ?")
    .get(contentHash) as { id: string } | undefined;

  if (existing) {
    return {
      id: existing.id,
      status: "duplicate",
      existing_id: existing.id,
    };
  }

  // Generate embedding
  const embedding = await embed(opts.content);

  // Layer 2: Semantic near-duplicate check via Orama
  const similar = await findSimilar(embedding, 0.85, 1);

  if (similar.length > 0) {
    return {
      id: similar[0].memory_id,
      status: "near-duplicate",
      existing_id: similar[0].memory_id,
      similarity: similar[0].similarity,
    };
  }

  // Store new memory
  const id = uuid();
  const now = new Date().toISOString();
  const category = opts.category ?? autoDetectCategory(opts.content);
  const source = opts.source ?? "manual";
  const confidence = opts.confidence ?? (source === "auto-captured" ? 0.7 : 1.0);
  const project = opts.project ?? null;

  db.prepare(
    `INSERT INTO memories (id, content, category, project, tags, triggers, source, source_detail, confidence, score, use_count, created_at, updated_at, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`
  ).run(
    id,
    opts.content,
    category,
    project,
    JSON.stringify(opts.tags ?? []),
    JSON.stringify(opts.triggers ?? []),
    source,
    opts.source_detail ?? null,
    confidence,
    now,
    now,
    contentHash
  );

  // Index in Orama
  await indexMemory(id, opts.content, embedding, category, project ?? "");
  await saveSearchIndex();

  // Log event
  db.prepare(
    "INSERT INTO memory_events(memory_id, event_type, created_at) VALUES (?, 'created', ?)"
  ).run(id, now);

  return { id, status: "created" };
}
