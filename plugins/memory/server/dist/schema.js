const SCHEMA_VERSION = 1;
const MIGRATIONS = {
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
};
export function initSchema(db) {
    // Check current version
    let currentVersion = 0;
    try {
        const row = db
            .prepare("SELECT value FROM schema_meta WHERE key = 'version'")
            .get();
        if (row) {
            currentVersion = parseInt(row.value, 10);
        }
    }
    catch {
        // Table doesn't exist yet — version 0
    }
    if (currentVersion >= SCHEMA_VERSION)
        return;
    // Apply migrations
    for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
        const stmts = MIGRATIONS[v];
        if (!stmts)
            continue;
        const migrate = db.transaction(() => {
            for (const sql of stmts) {
                db.exec(sql);
            }
            db.prepare("INSERT OR REPLACE INTO schema_meta(key, value) VALUES ('version', ?)").run(String(v));
        });
        migrate();
    }
}
//# sourceMappingURL=schema.js.map