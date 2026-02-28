import { getDb } from "../db.js";
import type { CleanupCandidate, MemoryRow } from "../types.js";
import { rowToMemory } from "../types.js";

export function getCleanupCandidates(): CleanupCandidate[] {
  const db = getDb();
  const candidates: CleanupCandidate[] = [];
  const now = Date.now();

  // Low score memories (score < -1)
  const lowScore = db
    .prepare("SELECT * FROM memories WHERE score < -1 ORDER BY score ASC LIMIT 20")
    .all() as MemoryRow[];
  for (const row of lowScore) {
    candidates.push({
      memory: rowToMemory(row),
      reason: `Low score (${row.score})`,
    });
  }

  // Unused for 90+ days
  const cutoff = new Date(now - 90 * 86400000).toISOString();
  const unused = db
    .prepare(
      `SELECT * FROM memories
       WHERE (last_used_at IS NULL AND created_at < ?)
          OR (last_used_at IS NOT NULL AND last_used_at < ?)
       ORDER BY COALESCE(last_used_at, created_at) ASC
       LIMIT 20`
    )
    .all(cutoff, cutoff) as MemoryRow[];
  for (const row of unused) {
    // Skip if already in candidates
    if (candidates.some((c) => c.memory.id === row.id)) continue;
    const lastDate = row.last_used_at ?? row.created_at;
    const days = Math.floor((now - new Date(lastDate).getTime()) / 86400000);
    candidates.push({
      memory: rowToMemory(row),
      reason: `Unused for ${days} days`,
    });
  }

  // Low confidence auto-captured
  const lowConfidence = db
    .prepare(
      "SELECT * FROM memories WHERE source = 'auto-captured' AND confidence < 0.3 ORDER BY confidence ASC LIMIT 10"
    )
    .all() as MemoryRow[];
  for (const row of lowConfidence) {
    if (candidates.some((c) => c.memory.id === row.id)) continue;
    candidates.push({
      memory: rowToMemory(row),
      reason: `Low confidence auto-capture (${row.confidence.toFixed(2)})`,
    });
  }

  // Stale: expired valid_until
  const stale = db
    .prepare(
      `SELECT * FROM memories
       WHERE valid_until IS NOT NULL AND valid_until < datetime('now')
       ORDER BY valid_until ASC
       LIMIT 20`
    )
    .all() as MemoryRow[];
  for (const row of stale) {
    if (candidates.some((c) => c.memory.id === row.id)) continue;
    candidates.push({
      memory: rowToMemory(row),
      reason: `Expired (valid_until: ${row.valid_until})`,
    });
  }

  return candidates;
}
