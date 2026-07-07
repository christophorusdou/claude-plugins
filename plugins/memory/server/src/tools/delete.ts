import { getDb, checkpoint } from "../db.js";
import { appendJournal } from "../journal.js";
import { maybeScheduleSync } from "../gitsync.js";
import { appendLedger } from "./lifecycle.js";

export function deleteMemory(id: string): boolean {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare("SELECT id, content FROM memories WHERE id = ?")
    .get(id) as { id: string; content: string } | undefined;
  if (!existing) return false;

  // The 'deleted' event below is cascade-erased with the row (v4 FK ON DELETE CASCADE),
  // so the ledger + journal are the durable record of what was deleted and when.
  // Prefer action:"merge" for consolidation — delete is for genuinely unwanted content.
  appendLedger({ action: "delete", id, content: existing.content.slice(0, 120) });
  appendJournal("delete", { id, content: existing.content.slice(0, 120) });

  const tx = db.transaction(() => {
    db.prepare(
      "INSERT INTO memory_events(memory_id, event_type, created_at) VALUES (?, 'deleted', ?)"
    ).run(id, now);
    // FTS row is removed by the memories_fts_ad trigger in this same transaction.
    db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  });
  tx();

  checkpoint();
  maybeScheduleSync();
  return true;
}
