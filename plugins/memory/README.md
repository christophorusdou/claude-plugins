# Memory Plugin (v2)

Cross-project knowledge archive for Claude Code. Acts as a searchable data lake and fallback for built-in memory. Stores patterns, gotchas, debug insights, decisions, and facts in a **single SQLite database with FTS5 full-text search** — no embedding model, no separate index file, instant startup.

v2 replaced the v1 dual-store design (SQLite + a whole-file-rewritten Orama JSON index) whose shared index file was clobbered by concurrent sessions. The FTS index now lives inside the database and is maintained by SQL triggers inside each writing transaction, so it can neither race nor drift.

## Role & Authority

This plugin is a **data lake fallback**, not a replacement for Claude Code's built-in memory (MEMORY.md files).

- **Built-in memory is always authoritative** — if plugin data contradicts built-in, built-in wins
- **Built-in memory handles**: user preferences, session feedback, workflow corrections, project context
- **This plugin handles**: cross-project search, durable patterns/gotchas/insights, session capture

## Data & Durability

Data stored in `~/.claude-memory/` (override with `MEMORY_DATA_DIR` for testing):

- `memory.db` — SQLite (WAL mode, schema v7 with FTS5). Passive checkpoint after every write, so a SIGKILLed server never strands weeks of writes in the WAL.
- `journal.jsonl` — append-only mutation log, one JSON line per store/update/delete/vote/merge/age, written synchronously after each committed transaction. Human-readable recovery source if the DB is ever lost.
- `memories.jsonl` — full snapshot, regenerated at each maintenance pass.
- `backups/` — pre-migration VACUUM snapshots and archived v1 artifacts.
- Git repo (remote: forgejo `chris/claude-memory`): `journal.jsonl` + `memories.jsonl` + `curation-log.jsonl` are auto-committed at session end and pushed in a detached background process (debounced to 1/hour). A failed push is surfaced at the next SessionStart.

## Hooks

| Hook | What it does |
|------|--------------|
| SessionStart | Injects top-5 project + top-3 global memories (active only, ranked by the same module recall uses, ~2,000-char budget, `injected` events logged). Also surfaces failed background pushes and a consolidation nudge when curation is overdue AND near-duplicate groups actually exist. |
| Stop | On substantive sessions (≥5 tool uses, once per session), prompts Claude to capture non-obvious learnings via the `capture-learnings` skill (absorbed from the retired session-learnings plugin). |
| SessionEnd | `cli.js maintain`: WAL truncate → cadence-gated lifecycle aging (every ~7 days) → snapshot → git commit → debounced detached push. |

## Tools (3)

### memory_store
Store a knowledge entry (max 5,000 chars). Content is threat-scanned (memory is an injection surface — instruction-override/exfil-shaped text is rejected). Near-duplicates are detected via FTS + Jaccard over the top-5 candidates; pass `allow_similar: true` to override when genuinely distinct.

```
content: string           — The entry text (max 5000 chars)
category?: string         — pattern | gotcha | preference | decision | fact | debug-insight
project?: string          — Omit to auto-detect, null for global
tags?: string[]           — Filtering tags
triggers?: string[]       — Keyword/regex patterns for signal-based activation
source?: string           — manual | auto-captured
confidence?: number       — 0-1
version_context?: string  — Version info for staleness tracking (e.g. "React 18.2")
valid_until?: string      — ISO date when this entry expires (e.g. "2026-06-01")
allow_similar?: boolean   — Store despite a near-duplicate warning
```

### memory_recall
FTS5/BM25 keyword search (keywords beat prose). Two-pass project+global with scope boosting when project is auto-detected. Results truncate at 600 chars.

```
query: string       — Search query (keywords work best)
project?: string    — Omit for two-pass (project + global), null for global only
category?: string   — Filter by category
limit?: number      — Max results (default 5)
min_score?: number  — Minimum entry score
full?: boolean      — Return untruncated content
```

Ranking: `(0.6·normalizedBM25 + 0.15·effectiveRank + scopeBoost 0.15 + triggerBoost 0.20) × freshness × lifecycle`. Recall increments `use_count`; SessionStart injection only bumps `last_used_at` (so injection can't inflate ranking, and aging can't bury an injected entry).

### memory_manage
All other operations via the `action` parameter:

| Action | Description |
|--------|-------------|
| `get` | Full content + metadata + recent event history for one entry |
| `update` | Edit content, category, tags, or triggers of an existing entry |
| `delete` | Remove an entry by ID (prefer `merge` for consolidation) |
| `upvote` | +1 score, +0.05 confidence; reactivates stale/archived |
| `downvote` | −1 score, −0.05 confidence; score ≤ −2 → stale, ≤ −4 → archived |
| `list` | List entries with optional filters, sorted by score |
| `stats` | Counts by project, category, source, lifecycle, score distribution |
| `audit` | Find expired, near-expiry, and low-confidence entries |
| `consolidate` | Find groups of similar entries (Jaccard, default threshold 0.5) |
| `age` | Lifecycle aging (also runs automatically at session end) |
| `merge` | Absorb an entry into a winner — keeps a recall-excluded tombstone |
| `sync` | Git ops: push, pull, status, reindex (FTS self-heal) |
| `import` | Import from a MEMORY.md file, splitting by headers and bullets |

## Project Scoping

When `project` is omitted, detection walks up from the cwd looking for a `package.json` name (stopping at the git root), then falls back to a `/projects/<name>/` path match, else global. Hooks pass their own `cwd` per invocation — scoping is never frozen to the server's launch directory for hook paths.

### Conflict suppression
When both a project and global memory are highly relevant to the same query (both >0.7 normalized BM25, within 0.1, same category), the global one is suppressed — the project entry is the intentional override.

## Recovery

If `memory.db` is ever lost: clone the git repo, then `memory_manage action:"import"`-style restore from `memories.jsonl` (idempotent by content hash + scope), and replay newer `journal.jsonl` lines. The `verify` CLI (`node server/dist/cli.js verify`) checks schema version, row/FTS-index consistency, journal coverage, and runs golden recall queries.

## Development

```bash
cd server
pnpm install
pnpm typecheck && pnpm build && pnpm test
MEMORY_DATA_DIR=/tmp/memtest node dist/cli.js verify   # run against a DB copy
```
