import { getDb } from "../db.js";
import { removeFromIndex, saveSearchIndex } from "../search-index.js";
import { appendLedger } from "./lifecycle.js";

export async function deleteMemory(id: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare("SELECT id, content FROM memories WHERE id = ?")
    .get(id) as { id: string; content: string } | undefined;
  if (!existing) return false;

  // The 'deleted' event below is cascade-erased with the row (v4 FK ON DELETE CASCADE),
  // so the ledger file is the durable record of what was deleted and when.
  // Prefer action:"merge" for consolidation — delete is for genuinely unwanted content.
  appendLedger({ action: "delete", id, content: existing.content.slice(0, 120) });
  db.prepare(
    "INSERT INTO memory_events(memory_id, event_type, created_at) VALUES (?, 'deleted', ?)"
  ).run(id, now);

  // Remove from Orama index
  await removeFromIndex(id);
  await saveSearchIndex();

  // Delete memory from SQLite
  db.prepare("DELETE FROM memories WHERE id = ?").run(id);

  return true;
}
