import type Database from "better-sqlite3";

export const SCHEMA_VERSION = 7;

const MIGRATIONS: Record<number, string[]> = {
  1: [
    `CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'fact',
      project TEXT,
      tags TEXT DEFAULT '[]',
      triggers TEXT DEFAULT '[]',
      source TEXT DEFAULT 'manual',
      source_detail TEXT,
      confidence REAL DEFAULT 1.0,
      score INTEGER DEFAULT 0,
      use_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_used_at TEXT,
      content_hash TEXT NOT NULL
    )`,

    `CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_content_hash ON memories(content_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project)`,
    `CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)`,
    `CREATE INDEX IF NOT EXISTS idx_memories_score ON memories(score)`,

    `CREATE TABLE IF NOT EXISTS memory_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_events_memory_id ON memory_events(memory_id)`,

    `CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ],

  2: [
    // Replace global unique content_hash with compound unique (content_hash, project scope)
    // This allows the same content to exist as both global and project-specific
    `DROP INDEX IF EXISTS idx_memories_content_hash`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_content_hash_project
       ON memories(content_hash, COALESCE(project, ''))`,
  ],

  3: [
    // Freshness & staleness: version context and expiry date
    `ALTER TABLE memories ADD COLUMN version_context TEXT`,
    `ALTER TABLE memories ADD COLUMN valid_until TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_memories_valid_until ON memories(valid_until)`,
  ],

  4: [
    // Add FK constraint on memory_events → memories with cascade delete
    // SQLite requires table recreation to add foreign keys
    `CREATE TABLE memory_events_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    )`,
    `INSERT INTO memory_events_new SELECT * FROM memory_events`,
    `DROP TABLE memory_events`,
    `ALTER TABLE memory_events_new RENAME TO memory_events`,
    `CREATE INDEX IF NOT EXISTS idx_events_memory_id ON memory_events(memory_id)`,
  ],

  5: [
    // Lifecycle state for the curator: active → stale → archived.
    // Deterministic, reversible aging (reactivates on use/upvote). Existing rows
    // default to 'active', so recall behavior is unchanged until the curator ages entries.
    `ALTER TABLE memories ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'active'`,
    `CREATE INDEX IF NOT EXISTS idx_memories_lifecycle_state ON memories(lifecycle_state)`,
  ],

  6: [
    // Consolidation tombstones: a merged loser keeps its row (lifecycle_state='merged',
    // merged_into=<winner id>) instead of being hard-deleted. Preserves provenance
    // (v4's ON DELETE CASCADE erases a deleted row's events) and gives sync tombstones.
    `ALTER TABLE memories ADD COLUMN merged_into TEXT`,
  ],

  7: [
    // v2: FTS5 external-content index replaces the Orama JSON file. Triggers keep it
    // in sync INSIDE the writing transaction, so concurrent sessions can never
    // observe (or clobber) a divergent index — the failure mode that lost entries
    // when two sessions each rewrote search-index.json whole.
    // The index mirrors ALL rows (external-content tables must stay 1:1 with the
    // base table); lifecycle/merged filtering belongs in the search query's WHERE.
    `CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content, tags, triggers,
      content='memories', content_rowid='rowid',
      tokenize='porter unicode61 remove_diacritics 2'
    )`,
    `INSERT INTO memories_fts(rowid, content, tags, triggers)
       SELECT rowid, content, tags, triggers FROM memories`,
    `CREATE TRIGGER IF NOT EXISTS memories_fts_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, tags, triggers)
      VALUES (new.rowid, new.content, new.tags, new.triggers);
    END`,
    `CREATE TRIGGER IF NOT EXISTS memories_fts_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags, triggers)
      VALUES ('delete', old.rowid, old.content, old.tags, old.triggers);
    END`,
    `CREATE TRIGGER IF NOT EXISTS memories_fts_au AFTER UPDATE OF content, tags, triggers ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags, triggers)
      VALUES ('delete', old.rowid, old.content, old.tags, old.triggers);
      INSERT INTO memories_fts(rowid, content, tags, triggers)
      VALUES (new.rowid, new.content, new.tags, new.triggers);
    END`,

    // Undo v1's downvote hack: downvoting stamped valid_until with the exact ISO
    // timestamp of the downvote event, permanently pinning a 0.3× freshness penalty
    // that upvotes could never clear. The stamp equals the downvote event's
    // created_at (same \`now\` variable in v1 vote()), so this reversal is precise —
    // user-set expiry dates (date-only or unrelated timestamps) are untouched.
    `UPDATE memories SET valid_until = NULL
     WHERE valid_until IN (
       SELECT e.created_at FROM memory_events e
       WHERE e.memory_id = memories.id AND e.event_type = 'downvoted'
     )`,
  ],
};

export function getSchemaVersion(db: Database.Database): number {
  try {
    const row = db
      .prepare("SELECT value FROM schema_meta WHERE key = 'version'")
      .get() as { value: string } | undefined;
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0; // schema_meta doesn't exist yet
  }
}

export function initSchema(db: Database.Database): void {
  const currentVersion = getSchemaVersion(db);

  if (currentVersion >= SCHEMA_VERSION) return;

  // Apply migrations
  for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
    const stmts = MIGRATIONS[v];
    if (!stmts) continue;
    const migrate = db.transaction(() => {
      for (const sql of stmts) {
        db.exec(sql);
      }
      db.prepare(
        "INSERT OR REPLACE INTO schema_meta(key, value) VALUES ('version', ?)"
      ).run(String(v));
    });
    migrate();
  }
}
