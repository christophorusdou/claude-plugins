import { appendFileSync, writeFileSync, renameSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, getDataDir } from "./db.js";
import { rowToMemory } from "./types.js";
/**
 * The durability layer that answers "what if the plugin breaks?": every
 * mutation appends one self-contained JSON line to journal.jsonl right after
 * its SQLite transaction commits, and maintenance regenerates the full
 * memories.jsonl snapshot. Both files are human-readable and git-synced, so
 * the archive survives DB loss without double-writing into built-in MEMORY.md.
 */
const JOURNAL_FILE = "journal.jsonl";
export const SNAPSHOT_FILE = "memories.jsonl";
export function appendJournal(op, data) {
    try {
        appendFileSync(join(getDataDir(), JOURNAL_FILE), JSON.stringify({ ts: new Date().toISOString(), op, ...data }) + "\n");
    }
    catch (err) {
        // Journal is the backup, not the source of truth — never fail the tool call.
        console.error("[memory] journal append failed:", err);
    }
}
/** Full-table dump via temp-file + atomic rename (git never sees a torn file). */
export function writeSnapshot() {
    const db = getDb();
    const rows = db
        .prepare("SELECT * FROM memories ORDER BY created_at ASC")
        .all();
    const lines = rows.map((row) => JSON.stringify(rowToMemory(row)));
    const path = join(getDataDir(), SNAPSHOT_FILE);
    const tmp = path + ".tmp";
    writeFileSync(tmp, lines.join("\n") + (lines.length ? "\n" : ""));
    renameSync(tmp, path);
    return rows.length;
}
/** First-run bootstrap: seed the journal with one snapshot line per existing row. */
export function ensureJournalBootstrap() {
    const path = join(getDataDir(), JOURNAL_FILE);
    if (existsSync(path))
        return;
    try {
        const db = getDb();
        const rows = db
            .prepare("SELECT * FROM memories ORDER BY created_at ASC")
            .all();
        const ts = new Date().toISOString();
        const lines = rows.map((row) => JSON.stringify({ ts, op: "snapshot", memory: rowToMemory(row) }));
        writeFileSync(path, lines.join("\n") + (lines.length ? "\n" : ""));
    }
    catch (err) {
        console.error("[memory] journal bootstrap failed:", err);
    }
}
export function journalLineCount() {
    try {
        const content = readFileSync(join(getDataDir(), JOURNAL_FILE), "utf-8");
        return content.split("\n").filter((l) => l.trim()).length;
    }
    catch {
        return 0;
    }
}
/** Import from the snapshot JSONL. Idempotent via (content_hash, scope). */
export function importFromJsonl() {
    const path = join(getDataDir(), SNAPSHOT_FILE);
    if (!existsSync(path))
        return { imported: 0, skipped: 0 };
    const content = readFileSync(path, "utf-8").trim();
    if (!content)
        return { imported: 0, skipped: 0 };
    const db = getDb();
    let imported = 0;
    let skipped = 0;
    const insert = db.prepare(`INSERT INTO memories (id, content, category, project, tags, triggers, source, source_detail, confidence, score, use_count, created_at, updated_at, last_used_at, content_hash, version_context, valid_until, lifecycle_state, merged_into)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const exists = db.prepare("SELECT id FROM memories WHERE content_hash = ? AND COALESCE(project, '') = ?");
    const tx = db.transaction(() => {
        for (const line of content.split("\n")) {
            if (!line.trim())
                continue;
            const memory = JSON.parse(line);
            if (exists.get(memory.content_hash, memory.project ?? "")) {
                skipped++;
                continue;
            }
            insert.run(memory.id, memory.content, memory.category, memory.project, JSON.stringify(memory.tags), JSON.stringify(memory.triggers), memory.source, memory.source_detail, memory.confidence, memory.score, memory.use_count, memory.created_at, memory.updated_at, memory.last_used_at, memory.content_hash, memory.version_context ?? null, memory.valid_until ?? null, memory.lifecycle_state ?? "active", memory.merged_into ?? null);
            imported++;
        }
    });
    tx();
    return { imported, skipped };
}
//# sourceMappingURL=journal.js.map