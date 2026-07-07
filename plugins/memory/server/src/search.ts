import type Database from "better-sqlite3";
import type { MemoryRow } from "./types.js";

/**
 * FTS5/BM25 lexical search — the single query path (replaces the Orama
 * hybrid index). The FTS table is trigger-maintained inside every writing
 * transaction, so no separate index file exists to race or rebuild.
 */

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "was", "are", "has",
  "have", "not", "you", "your", "when", "how", "why", "what", "which", "can",
  "into", "than", "then", "them", "its", "also", "but", "all", "any", "use",
  "using", "does", "did", "will", "should", "would", "about", "there",
]);

const MAX_TERMS = 12;

/**
 * Turn a natural-language query into an OR-of-phrases FTS5 MATCH expression.
 * Each term is double-quoted (phrase syntax) so FTS5 operators and punctuation
 * in user text can't break the query. Returns null when nothing survives.
 */
export function buildMatch(query: string): string | null {
  const raw = query.toLowerCase().match(/[a-z0-9_.-]{2,}/g) ?? [];
  const terms = [...new Set(raw.filter((t) => !STOPWORDS.has(t)))].slice(0, MAX_TERMS);
  if (terms.length === 0) return null;
  return terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(" OR ");
}

export interface FtsCandidate {
  row: MemoryRow;
  /** Negated bm25() — higher is better, unnormalized */
  bm25: number;
}

interface SearchOptions {
  /** undefined = no scope filter; null = global only; string = that project only */
  project?: string | null;
  category?: string | null;
  limit?: number;
}

export function ftsSearch(
  db: Database.Database,
  match: string,
  opts: SearchOptions = {}
): FtsCandidate[] {
  const conditions: string[] = ["memories_fts MATCH ?", "m.lifecycle_state != 'merged'"];
  const params: (string | number)[] = [match];

  if (opts.project !== undefined) {
    if (opts.project === null) {
      conditions.push("m.project IS NULL");
    } else {
      conditions.push("m.project = ?");
      params.push(opts.project);
    }
  }
  if (opts.category) {
    conditions.push("m.category = ?");
    params.push(opts.category);
  }

  const limit = opts.limit ?? 20;

  let rows: Array<MemoryRow & { bm25_rank: number }>;
  try {
    rows = db
      .prepare(
        `SELECT m.*, -bm25(memories_fts, 4.0, 2.0, 1.0) AS bm25_rank
         FROM memories_fts
         JOIN memories m ON m.rowid = memories_fts.rowid
         WHERE ${conditions.join(" AND ")}
         ORDER BY bm25_rank DESC
         LIMIT ?`
      )
      .all(...params, limit) as Array<MemoryRow & { bm25_rank: number }>;
  } catch {
    // Malformed MATCH despite quoting — treat as no hits; caller falls back to LIKE
    return [];
  }

  return rows.map((r) => {
    const { bm25_rank, ...row } = r;
    return { row: row as MemoryRow, bm25: bm25_rank };
  });
}

/** Substring fallback for queries that produce no usable FTS terms or no hits. */
export function likeSearch(
  db: Database.Database,
  query: string,
  opts: SearchOptions = {}
): FtsCandidate[] {
  const conditions: string[] = [
    "content LIKE '%' || ? || '%'",
    "lifecycle_state != 'merged'",
  ];
  const params: (string | number)[] = [query];

  if (opts.project !== undefined) {
    if (opts.project === null) {
      conditions.push("project IS NULL");
    } else {
      conditions.push("project = ?");
      params.push(opts.project);
    }
  }
  if (opts.category) {
    conditions.push("category = ?");
    params.push(opts.category);
  }

  const rows = db
    .prepare(
      `SELECT * FROM memories WHERE ${conditions.join(" AND ")}
       ORDER BY score DESC, use_count DESC
       LIMIT ?`
    )
    .all(...params, opts.limit ?? 10) as MemoryRow[];

  return rows.map((row) => ({ row, bm25: 1 }));
}
