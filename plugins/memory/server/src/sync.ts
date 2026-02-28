import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { getDb, getDataDir } from "./db.js";
import { embed } from "./embeddings.js";
import { indexMemory, saveSearchIndex, getSearchIndex } from "./search-index.js";
import type { Memory, MemoryRow } from "./types.js";
import { rowToMemory } from "./types.js";

const JSONL_FILE = "memories.jsonl";

function getJsonlPath(): string {
  return join(getDataDir(), JSONL_FILE);
}

/** Export all memories to JSONL (the sync source of truth) */
export function exportToJsonl(): number {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM memories ORDER BY created_at ASC")
    .all() as MemoryRow[];

  const lines = rows.map((row) => {
    const memory = rowToMemory(row);
    return JSON.stringify(memory);
  });

  writeFileSync(getJsonlPath(), lines.join("\n") + (lines.length ? "\n" : ""));
  return rows.length;
}

/** Import from JSONL, rebuilding the database. Idempotent via content_hash. */
export async function importFromJsonl(): Promise<{
  imported: number;
  skipped: number;
}> {
  const path = getJsonlPath();
  if (!existsSync(path)) return { imported: 0, skipped: 0 };

  const content = readFileSync(path, "utf-8").trim();
  if (!content) return { imported: 0, skipped: 0 };

  const db = getDb();
  const lines = content.split("\n");
  let imported = 0;
  let skipped = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const memory: Memory = JSON.parse(line);

    // Skip if already exists in same scope (idempotent)
    const existing = db
      .prepare(
        "SELECT id FROM memories WHERE content_hash = ? AND COALESCE(project, '') = ?"
      )
      .get(memory.content_hash, memory.project ?? "");
    if (existing) {
      skipped++;
      continue;
    }

    db.prepare(
      `INSERT INTO memories (id, content, category, project, tags, triggers, source, source_detail, confidence, score, use_count, created_at, updated_at, last_used_at, content_hash, version_context, valid_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      memory.id,
      memory.content,
      memory.category,
      memory.project,
      JSON.stringify(memory.tags),
      JSON.stringify(memory.triggers),
      memory.source,
      memory.source_detail,
      memory.confidence,
      memory.score,
      memory.use_count,
      memory.created_at,
      memory.updated_at,
      memory.last_used_at,
      memory.content_hash,
      memory.version_context ?? null,
      memory.valid_until ?? null
    );

    // Index in Orama
    const embedding = await embed(memory.content);
    await indexMemory(
      memory.id,
      memory.content,
      embedding,
      memory.category,
      memory.project ?? ""
    );

    imported++;
  }

  if (imported > 0) {
    await saveSearchIndex();
  }

  return { imported, skipped };
}

/**
 * Rebuild the Orama search index from all memories in SQLite.
 * Used after sync pull or when index is corrupted.
 */
export async function rebuildSearchIndex(): Promise<number> {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM memories ORDER BY created_at ASC")
    .all() as MemoryRow[];

  // Force a fresh index by clearing the existing one
  // We'll just rebuild by indexing all memories
  let count = 0;
  for (const row of rows) {
    const embedding = await embed(row.content);
    await indexMemory(
      row.id,
      row.content,
      embedding,
      row.category,
      row.project ?? ""
    );
    count++;
  }

  if (count > 0) {
    await saveSearchIndex();
  }

  return count;
}

/** Git operations for sync */
export function gitSync(
  operation: "push" | "pull" | "status"
): string {
  const dataDir = getDataDir();

  // Initialize git repo if needed
  if (!existsSync(join(dataDir, ".git"))) {
    execSync("git init", { cwd: dataDir });
    writeFileSync(
      join(dataDir, ".gitignore"),
      "*.db\n*.db-journal\n*.db-wal\n*.db-shm\nsearch-index.json\n"
    );
    execSync("git add .gitignore", { cwd: dataDir });
    execSync('git commit -m "Initialize memory repo"', { cwd: dataDir });
  }

  switch (operation) {
    case "push": {
      const count = exportToJsonl();
      execSync("git add memories.jsonl", { cwd: dataDir });
      try {
        execSync(`git commit -m "Sync ${count} memories"`, { cwd: dataDir });
      } catch {
        // Nothing to commit
      }
      try {
        const result = execSync("git push 2>&1", {
          cwd: dataDir,
          encoding: "utf-8",
        });
        return `Exported ${count} memories. ${result}`;
      } catch (e) {
        return `Exported ${count} memories locally. Push failed (no remote configured?): ${e}`;
      }
    }

    case "pull": {
      try {
        const result = execSync("git pull 2>&1", {
          cwd: dataDir,
          encoding: "utf-8",
        });
        return `Pulled: ${result}`;
      } catch (e) {
        return `Pull failed: ${e}`;
      }
    }

    case "status": {
      try {
        const status = execSync("git status --short 2>&1", {
          cwd: dataDir,
          encoding: "utf-8",
        });
        const log = execSync("git log --oneline -5 2>&1", {
          cwd: dataDir,
          encoding: "utf-8",
        });
        return `Status:\n${status || "(clean)"}\n\nRecent commits:\n${log}`;
      } catch (e) {
        return `Status check failed: ${e}`;
      }
    }
  }
}
