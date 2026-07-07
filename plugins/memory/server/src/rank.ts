import type Database from "better-sqlite3";
import type { Memory, MemoryRow } from "./types.js";
import { rowToMemory } from "./types.js";

/**
 * Shared ranking machinery for recall AND SessionStart injection. v1 had two
 * divergent implementations (TypeScript recall vs raw-SQL hook) that disagreed
 * on lifecycle filtering and freshness; a single module makes divergence
 * structurally impossible.
 */

export const TEXT_WEIGHT = 0.6;
export const RANK_WEIGHT = 0.15;
export const SCOPE_BOOST = 0.15;
export const TRIGGER_BOOST = 0.2;
/** Candidates whose normalized relevance falls below this are noise */
export const MIN_RELEVANCE = 0.1;

/** score + ln(use_count+1) − 0.01·daysSinceUsed (unused rows assume 30 days) */
export function effectiveRank(m: Memory, nowMs: number): number {
  const daysSinceUsed = m.last_used_at
    ? (nowMs - new Date(m.last_used_at).getTime()) / 86400000
    : 30;
  return m.score + Math.log(m.use_count + 1) - 0.01 * daysSinceUsed;
}

/** Sigmoid-normalized effective rank (0–1) */
export function normalizedRank(m: Memory, nowMs: number): number {
  return 1 / (1 + Math.exp(-effectiveRank(m, nowMs) / 5));
}

/** 1.0 fresh → 0.5 within a week of expiry → 0.3 expired */
export function freshnessMultiplier(m: Memory, nowMs: number): number {
  if (!m.valid_until) return 1.0;
  const daysLeft = (new Date(m.valid_until).getTime() - nowMs) / 86400000;
  if (daysLeft <= 0) return 0.3;
  if (daysLeft <= 7) return 0.5 + 0.5 * (daysLeft / 7);
  return 1.0;
}

/** active 1.0 / stale 0.4 / archived 0.1 */
export function stateMultiplier(m: Memory): number {
  if (m.lifecycle_state === "archived") return 0.1;
  if (m.lifecycle_state === "stale") return 0.4;
  return 1.0;
}

interface ScoreInputs {
  relevance: number;
  scopeBoosted: boolean;
  triggerMatched: boolean;
}

export function finalScore(m: Memory, inputs: ScoreInputs, nowMs: number): number {
  return (
    (inputs.relevance * TEXT_WEIGHT +
      normalizedRank(m, nowMs) * RANK_WEIGHT +
      (inputs.scopeBoosted ? SCOPE_BOOST : 0) +
      (inputs.triggerMatched ? TRIGGER_BOOST : 0)) *
    freshnessMultiplier(m, nowMs) *
    stateMultiplier(m)
  );
}

export interface InjectionEntry {
  id: string;
  content: string;
  category: string;
  project: string | null;
  score: number;
}

const INJECT_PROJECT_LIMIT = 5;
const INJECT_GLOBAL_LIMIT = 3;
const INJECT_ENTRY_CHARS = 200;
const INJECT_TOTAL_CHARS = 2000;

/**
 * Pick the memories to inject at SessionStart: lifecycle-filtered (active
 * only), ranked with the same multipliers as recall, char-budgeted.
 *
 * Use accounting is deliberately asymmetric vs recall: injection bumps
 * last_used_at and logs an `injected` event so aging never buries a memory
 * that is being shown every session, but it does NOT increment use_count —
 * unconditional injection must not inflate the ln(use_count) term that
 * query-driven retrieval earns.
 */
export function selectForInjection(
  db: Database.Database,
  project: string | null
): InjectionEntry[] {
  const nowMs = Date.now();

  const pickTop = (scope: string | null, n: number): Memory[] => {
    const rows = (
      scope === null
        ? db
            .prepare("SELECT * FROM memories WHERE lifecycle_state = 'active' AND project IS NULL")
            .all()
        : db
            .prepare("SELECT * FROM memories WHERE lifecycle_state = 'active' AND project = ?")
            .all(scope)
    ) as MemoryRow[];

    return rows
      .map(rowToMemory)
      .map((m) => ({ m, rank: normalizedRank(m, nowMs) * freshnessMultiplier(m, nowMs) }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, n)
      .map((x) => x.m);
  };

  const picked = [
    ...(project ? pickTop(project, INJECT_PROJECT_LIMIT) : []),
    ...pickTop(null, project ? INJECT_GLOBAL_LIMIT : INJECT_PROJECT_LIMIT),
  ];

  const entries: InjectionEntry[] = [];
  let total = 0;
  for (const m of picked) {
    const content =
      m.content.length > INJECT_ENTRY_CHARS
        ? m.content.slice(0, INJECT_ENTRY_CHARS) + "…"
        : m.content;
    if (total + content.length > INJECT_TOTAL_CHARS) break;
    total += content.length;
    entries.push({
      id: m.id,
      content,
      category: m.category,
      project: m.project,
      score: m.score,
    });
  }

  if (entries.length > 0) {
    const nowIso = new Date().toISOString();
    const touch = db.prepare("UPDATE memories SET last_used_at = ? WHERE id = ?");
    const log = db.prepare(
      "INSERT INTO memory_events(memory_id, event_type, created_at) VALUES (?, 'injected', ?)"
    );
    const tx = db.transaction(() => {
      for (const e of entries) {
        touch.run(nowIso, e.id);
        log.run(e.id, nowIso);
      }
    });
    tx();
  }

  return entries;
}
