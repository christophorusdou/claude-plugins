import type Database from "better-sqlite3";
import type { Memory } from "./types.js";
/**
 * Shared ranking machinery for recall AND SessionStart injection. v1 had two
 * divergent implementations (TypeScript recall vs raw-SQL hook) that disagreed
 * on lifecycle filtering and freshness; a single module makes divergence
 * structurally impossible.
 */
export declare const TEXT_WEIGHT = 0.6;
export declare const RANK_WEIGHT = 0.15;
export declare const SCOPE_BOOST = 0.15;
export declare const TRIGGER_BOOST = 0.2;
/** Candidates whose normalized relevance falls below this are noise */
export declare const MIN_RELEVANCE = 0.1;
/** score + ln(use_count+1) − 0.01·daysSinceUsed (unused rows assume 30 days) */
export declare function effectiveRank(m: Memory, nowMs: number): number;
/** Sigmoid-normalized effective rank (0–1) */
export declare function normalizedRank(m: Memory, nowMs: number): number;
/** 1.0 fresh → 0.5 within a week of expiry → 0.3 expired */
export declare function freshnessMultiplier(m: Memory, nowMs: number): number;
/** active 1.0 / stale 0.4 / archived 0.1 */
export declare function stateMultiplier(m: Memory): number;
interface ScoreInputs {
    relevance: number;
    scopeBoosted: boolean;
    triggerMatched: boolean;
}
export declare function finalScore(m: Memory, inputs: ScoreInputs, nowMs: number): number;
export interface InjectionEntry {
    id: string;
    content: string;
    category: string;
    project: string | null;
    score: number;
}
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
export declare function selectForInjection(db: Database.Database, project: string | null): InjectionEntry[];
export {};
//# sourceMappingURL=rank.d.ts.map