import Database from "better-sqlite3";
import { mkdirSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { initSchema, getSchemaVersion, SCHEMA_VERSION } from "./schema.js";
let _db = null;
let _dataDir = null;
/** MEMORY_DATA_DIR override exists so migration/tests can run against a DB copy. */
export function getDataDir() {
    if (!_dataDir) {
        _dataDir = process.env.MEMORY_DATA_DIR || join(homedir(), ".claude-memory");
    }
    return _dataDir;
}
export function getDb() {
    if (_db)
        return _db;
    const dataDir = getDataDir();
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
    }
    _db = new Database(join(dataDir, "memory.db"));
    _db.pragma("journal_mode = WAL");
    _db.pragma("synchronous = NORMAL");
    _db.pragma("foreign_keys = ON");
    _db.pragma("busy_timeout = 5000");
    // The server is routinely SIGKILLed (Claude Code never sends SIGTERM), so
    // close-time checkpoints cannot be relied on. A low auto-checkpoint threshold
    // (~800KB) plus an explicit passive checkpoint after each write keeps the main
    // DB file current instead of accumulating weeks of writes in the WAL.
    _db.pragma("wal_autocheckpoint = 200");
    const version = getSchemaVersion(_db);
    if (version > 0 && version < SCHEMA_VERSION) {
        backupBeforeMigration(_db, dataDir);
    }
    initSchema(_db);
    archiveV1Orphans(dataDir);
    return _db;
}
/** Fold the WAL in and VACUUM-snapshot the DB before a schema migration touches it. */
function backupBeforeMigration(db, dataDir) {
    try {
        db.pragma("wal_checkpoint(TRUNCATE)");
        const backupsDir = join(dataDir, "backups");
        if (!existsSync(backupsDir))
            mkdirSync(backupsDir, { recursive: true });
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const target = join(backupsDir, `pre-v${SCHEMA_VERSION}-${stamp}.db`);
        if (!existsSync(target)) {
            db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
        }
    }
    catch (err) {
        console.error("[memory] pre-migration backup failed:", err);
    }
}
/** v1 leftovers (Orama index, ad-hoc .bak) no longer participate in v2 — park them under backups/. */
function archiveV1Orphans(dataDir) {
    try {
        const orphans = [
            ["search-index.json", "search-index.v1.json"],
            ["memory.db.bak", "memory.db.bak"],
        ];
        for (const [from, to] of orphans) {
            const src = join(dataDir, from);
            if (!existsSync(src))
                continue;
            const backupsDir = join(dataDir, "backups");
            if (!existsSync(backupsDir))
                mkdirSync(backupsDir, { recursive: true });
            renameSync(src, join(backupsDir, to));
        }
    }
    catch {
        /* best-effort */
    }
}
export function checkpoint(mode = "PASSIVE") {
    try {
        _db?.pragma(`wal_checkpoint(${mode})`);
    }
    catch {
        /* best-effort */
    }
}
export function closeDb() {
    if (_db) {
        checkpoint("TRUNCATE");
        _db.close();
        _db = null;
    }
}
/** Test-only: reset module state so a new MEMORY_DATA_DIR takes effect. */
export function resetDbForTests() {
    if (_db) {
        _db.close();
        _db = null;
    }
    _dataDir = null;
}
//# sourceMappingURL=db.js.map