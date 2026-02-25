import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { initSchema } from "./schema.js";

const DATA_DIR = join(homedir(), ".claude-memory");
const DB_PATH = join(DATA_DIR, "memory.db");

let _db: Database.Database | null = null;

export function getDataDir(): string {
  return DATA_DIR;
}

export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);

  // Performance pragmas
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("foreign_keys = ON");

  // Initialize schema
  initSchema(_db);

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
