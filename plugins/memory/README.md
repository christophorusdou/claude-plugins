# Memory Plugin

Cross-project knowledge archive for Claude Code. Acts as a searchable data lake and fallback for built-in memory. Stores patterns, gotchas, debug insights, decisions, and facts with semantic search and automatic project scoping.

## Role & Authority

This plugin is a **data lake fallback**, not a replacement for Claude Code's built-in memory (MEMORY.md files).

- **Built-in memory is always authoritative** — if plugin data contradicts built-in, built-in wins
- **Built-in memory handles**: user preferences, session feedback, workflow corrections, project context
- **This plugin handles**: cross-project search, durable patterns/gotchas/insights, semantic retrieval

The plugin is purely on-demand — no SessionStart injection. It only surfaces when `memory_recall` is explicitly called.

## Installation

Installed as a Claude Code plugin (`memory@chris-plugins`). The MCP server runs automatically when Claude Code starts.

Data stored in `~/.claude-memory/`:
- `memory.db` — SQLite database (WAL mode)
- `search-index.json` — Orama hybrid search index
- `memories.jsonl` — Portable sync format

## Tools (3)

### memory_store
Store a new knowledge entry. For patterns, gotchas, debug insights, decisions, or facts. NOT for user preferences or session feedback. Content is limited to 5,000 characters.

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
```

### memory_recall
Search the knowledge archive using semantic + keyword hybrid search. Use as a fallback when built-in memory doesn't have relevant context, or for cross-project search.

```
query: string       — Natural language search
project?: string    — Omit for two-pass (project + global), null for global only
category?: string   — Filter by category
limit?: number      — Max results (default 10)
min_score?: number  — Minimum entry score
```

### memory_manage
All other operations via the `action` parameter:

| Action | Description |
|--------|-------------|
| `update` | Edit content, category, tags, or triggers of an existing entry |
| `delete` | Remove an entry by ID |
| `upvote` | +1 score, +0.05 confidence (entry was helpful) |
| `downvote` | -1 score, -0.05 confidence (entry was wrong/stale) |
| `list` | List entries with optional filters, sorted by score |
| `stats` | Counts by project, category, source, and score distribution |
| `cleanup` | Suggest low-value entries for deletion |
| `audit` | Find expired, near-expiry, and low-confidence entries |
| `consolidate` | Find groups of similar entries that could be merged |
| `sync` | Git-based sync: push, pull, export (JSONL), rebuild (DB from JSONL) |
| `import` | Import from a MEMORY.md file, splitting by headers and bullet points |

## Project Scoping

The memory system automatically detects the current project and scopes memories accordingly.

### Auto-detection
When `project` is omitted from store/recall, the server detects the project from `process.cwd()`:
1. `package.json` name field (strips `@scope/` prefix)
2. Regex match `/projects/<name>/` in path
3. Falls back to `null` (global scope)

There is no basename fallback — this avoids false positives from generic directory names like `src`, `lib`, `app`, etc.

### Two-pass recall
When a project is detected and `project` is omitted from recall:
1. Searches project-specific memories (limit 20)
2. Searches global memories (limit 15)
3. Merges and deduplicates by memory ID
4. Re-ranks with scope boost: project memories get +0.15

### Conflict suppression
When both a project and global memory score highly on the same query (both >0.7 vector similarity, within 0.1 of each other, same category), the global memory is suppressed. This means a project-specific "use npm" overrides a global "use pnpm". Comparison uses raw vector similarity to avoid scope-boost bias.

### Scope-aware dedup
The same content can exist as both global and project-specific — they have different scopes and won't be flagged as duplicates. Dedup checks (both hash and vector similarity) are scoped to the same project.

### Explicit scoping
- `project: null` — Global only (no project memories)
- `project: "my-project"` — Only that project's memories
- `project` omitted — Auto-detect, two-pass search

## Architecture

### Retrieval pipeline
1. **Orama hybrid search** — Combined vector (384-dim embeddings via `@huggingface/transformers`) + full-text search
2. **SQLite enrichment** — Load full memory records with metadata
3. **Re-ranking** — `(0.7 * orama_score + 0.15 * effective_rank + scope_boost + trigger_boost) * freshness`
   - Effective rank = `score + ln(use_count + 1) - 0.01 * days_since_used`
   - Scope boost = +0.15 for project-specific memories in two-pass mode
   - Trigger boost = +0.20 when a trigger pattern matches the query
   - Freshness = 0.3 if expired, ramps 0.5→1.0 in final 7 days, 1.0 otherwise

### Deduplication
Two-layer dedup on store:
1. **Content hash** — SHA-256 of trimmed content, scoped to (hash, project)
2. **Vector similarity** — >0.85 cosine similarity within same scope

### Embedding
- Model: `Xenova/all-MiniLM-L6-v2` (384 dimensions)
- LRU cache: 256 entries with proper delete+re-insert on access
- Batch embedding: uses native HuggingFace pipeline batching for consolidation operations
- Model is preloaded at server startup to avoid cold-start latency

### Data integrity
- **Write mutex**: Search index saves are serialized via promise chain to prevent corruption from concurrent tool calls
- **Shutdown save**: Search index is persisted on SIGINT/SIGTERM before process exit
- **Index rebuild**: `memory_manage` with `action: "sync", operation: "rebuild"` clears the existing index before rebuilding to prevent ghost entries
- **FK cascade**: `memory_events` has `ON DELETE CASCADE` to `memories`, preventing orphaned events

### Schema
SQLite with WAL mode. Migrations tracked in `schema_meta` table. Current version: 4.
