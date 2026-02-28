import { getDb } from "../db.js";
import type { Memory, MemoryRow } from "../types.js";
import { rowToMemory } from "../types.js";

interface VoteResult {
  memory: Memory;
  new_score: number;
  new_confidence: number;
}

function vote(id: string, direction: "up" | "down", detail?: string): VoteResult | null {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare("SELECT * FROM memories WHERE id = ?")
    .get(id) as MemoryRow | undefined;

  if (!existing) return null;

  const scoreDelta = direction === "up" ? 1 : -1;
  const confidenceDelta = direction === "up" ? 0.05 : -0.05;
  const newConfidence = Math.max(0, Math.min(1, existing.confidence + confidenceDelta));
  const eventType = direction === "up" ? "upvoted" : "downvoted";

  if (direction === "down") {
    // Downvote marks as expired for immediate freshness decay,
    // but only if valid_until is not already set (preserves user-set expiry dates)
    db.prepare(
      `UPDATE memories SET score = score + ?, confidence = ?, updated_at = ?,
       valid_until = CASE WHEN valid_until IS NULL THEN ? ELSE valid_until END
       WHERE id = ?`
    ).run(scoreDelta, newConfidence, now, now, id);
  } else {
    db.prepare(
      "UPDATE memories SET score = score + ?, confidence = ?, updated_at = ? WHERE id = ?"
    ).run(scoreDelta, newConfidence, now, id);
  }

  db.prepare(
    "INSERT INTO memory_events(memory_id, event_type, detail, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, eventType, detail ?? null, now);

  const updated = db
    .prepare("SELECT * FROM memories WHERE id = ?")
    .get(id) as MemoryRow;

  return {
    memory: rowToMemory(updated),
    new_score: updated.score,
    new_confidence: updated.confidence,
  };
}

export function upvoteMemory(id: string, detail?: string): VoteResult | null {
  return vote(id, "up", detail);
}

export function downvoteMemory(id: string, detail?: string): VoteResult | null {
  return vote(id, "down", detail);
}
