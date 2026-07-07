import { getDb } from "../db.js";
import type { Memory, MemoryEvent, MemoryRow } from "../types.js";
import { rowToMemory } from "../types.js";

export interface GetResult {
  memory: Memory;
  events: MemoryEvent[];
}

/** Fetch one memory in full (recall output truncates) plus its recent history. */
export function getMemory(id: string): GetResult | null {
  const db = getDb();

  const row = db
    .prepare("SELECT * FROM memories WHERE id = ?")
    .get(id) as MemoryRow | undefined;
  if (!row) return null;

  const events = db
    .prepare(
      "SELECT * FROM memory_events WHERE memory_id = ? ORDER BY id DESC LIMIT 10"
    )
    .all(id) as MemoryEvent[];

  return { memory: rowToMemory(row), events };
}
