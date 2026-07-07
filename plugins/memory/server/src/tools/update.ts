import { createHash } from "node:crypto";
import { getDb, checkpoint } from "../db.js";
import { appendJournal } from "../journal.js";
import type { Memory, MemoryCategory, MemoryRow } from "../types.js";
import { rowToMemory } from "../types.js";

interface UpdateOptions {
  id: string;
  content?: string;
  category?: MemoryCategory;
  project?: string | null;
  tags?: string[];
  triggers?: string[];
  version_context?: string | null;
  valid_until?: string | null;
}

export function updateMemory(opts: UpdateOptions): Memory | null {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare("SELECT * FROM memories WHERE id = ?")
    .get(opts.id) as MemoryRow | undefined;

  if (!existing) return null;

  const sets: string[] = ["updated_at = ?"];
  const params: (string | number | null)[] = [now];

  if (opts.content !== undefined) {
    const hash = createHash("sha256").update(opts.content.trim()).digest("hex");
    sets.push("content = ?", "content_hash = ?");
    params.push(opts.content, hash);
  }

  if (opts.category !== undefined) {
    sets.push("category = ?");
    params.push(opts.category);
  }

  if (opts.project !== undefined) {
    sets.push("project = ?");
    params.push(opts.project);
  }

  if (opts.tags !== undefined) {
    sets.push("tags = ?");
    params.push(JSON.stringify(opts.tags));
  }

  if (opts.triggers !== undefined) {
    sets.push("triggers = ?");
    params.push(JSON.stringify(opts.triggers));
  }

  if (opts.version_context !== undefined) {
    sets.push("version_context = ?");
    params.push(opts.version_context);
  }

  if (opts.valid_until !== undefined) {
    sets.push("valid_until = ?");
    params.push(opts.valid_until);
  }

  params.push(opts.id);

  const tx = db.transaction(() => {
    // The FTS index follows automatically via the memories_fts_au trigger.
    db.prepare(`UPDATE memories SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    db.prepare(
      "INSERT INTO memory_events(memory_id, event_type, detail, created_at) VALUES (?, 'updated', ?, ?)"
    ).run(opts.id, JSON.stringify(opts), now);
  });
  tx();

  appendJournal("update", { id: opts.id, fields: opts });
  checkpoint();

  const updatedRow = db
    .prepare("SELECT * FROM memories WHERE id = ?")
    .get(opts.id) as MemoryRow;

  return rowToMemory(updatedRow);
}
