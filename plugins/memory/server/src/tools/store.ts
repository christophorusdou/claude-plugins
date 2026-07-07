import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import { getDb, checkpoint } from "../db.js";
import { findNearDuplicates } from "../similarity.js";
import { getDetectedProject } from "../detect.js";
import { scanThreat } from "../threat.js";
import { appendJournal } from "../journal.js";
import { maybeScheduleSync } from "../gitsync.js";
import type { Memory, MemoryCategory, MemorySource, StoreResult } from "../types.js";

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
  version_context?: string | null;
  valid_until?: string | null;
  /** Force the write past the near-duplicate gate */
  allow_similar?: boolean;
}

const MAX_CONTENT_LENGTH = 5000;

export function storeMemory(opts: StoreOptions): StoreResult {
  if (opts.content.length > MAX_CONTENT_LENGTH) {
    throw new Error(
      `Memory content too long (${opts.content.length} chars, max ${MAX_CONTENT_LENGTH}). Summarize before storing.`
    );
  }

  // Store-boundary threat gate: this content will be rendered into future
  // sessions' context, so instruction-override/exfil-shaped text is rejected.
  const threat = scanThreat(opts.content);
  if (threat) {
    throw new Error(
      `Content rejected: matches threat pattern "${threat}". Memories are injected into future sessions — rephrase without instruction-like or exfiltration-shaped content.`
    );
  }

  const db = getDb();
  const contentHash = hashContent(opts.content);

  // Resolve project: auto-detect when omitted (undefined), explicit otherwise
  const project =
    opts.project === undefined ? getDetectedProject() : opts.project ?? null;
  const projectScope = project ?? "";

  // Layer 1: Scope-aware exact duplicate check
  const existing = db
    .prepare(
      "SELECT id FROM memories WHERE content_hash = ? AND COALESCE(project, '') = ?"
    )
    .get(contentHash, projectScope) as { id: string } | undefined;

  if (existing) {
    return {
      id: existing.id,
      status: "duplicate",
      existing_id: existing.id,
    };
  }

  // Layer 2: Lexical near-duplicate gate — top-5 FTS candidates judged by
  // Jaccard/containment (v1's top-1 cosine at 0.85 let paraphrases pile up)
  if (!opts.allow_similar) {
    const dups = findNearDuplicates(db, opts.content, project);
    if (dups.length > 0) {
      return {
        id: dups[0].id,
        status: "near-duplicate",
        existing_id: dups[0].id,
        similarity: dups[0].similarity,
        near_duplicates: dups,
        project,
      };
    }
  }

  const id = uuid();
  const now = new Date().toISOString();
  const category = opts.category ?? autoDetectCategory(opts.content);
  const source = opts.source ?? "manual";
  const confidence = opts.confidence ?? (source === "auto-captured" ? 0.7 : 1.0);

  const memory: Memory = {
    id,
    content: opts.content,
    category,
    project,
    tags: opts.tags ?? [],
    triggers: opts.triggers ?? [],
    source,
    source_detail: opts.source_detail ?? null,
    confidence,
    score: 0,
    use_count: 0,
    created_at: now,
    updated_at: now,
    last_used_at: null,
    version_context: opts.version_context ?? null,
    valid_until: opts.valid_until ?? null,
    content_hash: contentHash,
    lifecycle_state: "active",
    merged_into: null,
  };

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO memories (id, content, category, project, tags, triggers, source, source_detail, confidence, score, use_count, created_at, updated_at, content_hash, version_context, valid_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`
    ).run(
      id,
      memory.content,
      category,
      project,
      JSON.stringify(memory.tags),
      JSON.stringify(memory.triggers),
      source,
      memory.source_detail,
      confidence,
      now,
      now,
      contentHash,
      memory.version_context,
      memory.valid_until
    );
    db.prepare(
      "INSERT INTO memory_events(memory_id, event_type, created_at) VALUES (?, 'created', ?)"
    ).run(id, now);
  });
  tx();

  appendJournal("create", { memory });
  checkpoint();
  maybeScheduleSync();

  return { id, status: "created", project };
}
