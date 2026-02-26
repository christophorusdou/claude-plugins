# Memory Plugin

Centralized cross-project memory system for Claude Code. Stores facts, preferences, patterns, decisions, and debug insights with semantic search and automatic project scoping.

## Installation

Installed as a Claude Code plugin (`memory@chris-plugins`). The MCP server runs automatically when Claude Code starts.

Data stored in `~/.claude-memory/`:
- `memory.db` — SQLite database (WAL mode)
- `search-index.json` — Orama hybrid search index
- `memories.jsonl` — Portable sync format

## Tools

### memory_store
Store a new memory. Auto-detects category and project scope.

```
content: string     — The memory text
category?: string   — pattern | gotcha | preference | decision | fact | debug-insight
project?: string    — Omit to auto-detect, null for global
tags?: string[]     — Filtering tags
triggers?: string[] — Keyword patterns for signal-based activation
source?: string     — manual | auto-captured
confidence?: number — 0-1
```

### memory_recall
Semantic + keyword hybrid search with scope-aware ranking.

```
query: string       — Natural language search
project?: string    — Omit for two-pass (project + global), null for global only
category?: string   — Filter by category
limit?: number      — Max results (default 10)
min_score?: number  — Minimum memory score
```

### memory_update
Update content, category, project, tags, or triggers of an existing memory.

### memory_delete
Delete a memory by ID.

### memory_upvote / memory_downvote
Vote on memory quality. Affects ranking in future recalls.

### memory_list
List memories with optional filters, sorted by score.

### memory_stats
Counts by project, category, source, and score distribution.

### memory_cleanup
Suggest low-value memories for deletion.

### memory_sync
Git-based sync: push, pull, export (JSONL), rebuild (DB from JSONL).

### memory_import
Import from a MEMORY.md file, splitting by headers and bullet points.

## Project Scoping

The memory system automatically detects the current project and scopes memories accordingly.

### Auto-detection
When `project` is omitted from store/recall, the server detects the project from `process.cwd()`:
1. `package.json` name field (strips `@scope/` prefix)
2. Regex match `/projects/<name>/` in path
3. Directory basename (skips home dir and generic names)
4. Falls back to `null` (global scope)

### Two-pass recall
When a project is detected and `project` is omitted from recall:
1. Searches project-specific memories (limit 20)
2. Searches global memories (limit 15)
3. Merges and deduplicates by memory ID
4. Re-ranks with scope boost: project memories get +0.15

### Conflict suppression
When both a project and global memory score highly on the same query (both >0.5, within 0.2 of each other), the global memory is suppressed. This means a project-specific "use npm" overrides a global "use pnpm".

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
3. **Re-ranking** — `0.7 * orama_score + 0.15 * effective_rank + 0.15 * scope_boost`
   - Effective rank = `score + ln(use_count + 1) - 0.01 * days_since_used`
   - Scope boost = +0.15 for project-specific memories in two-pass mode

### Deduplication
Two-layer dedup on store:
1. **Content hash** — SHA-256 of trimmed content, scoped to (hash, project)
2. **Vector similarity** — >0.85 cosine similarity within same scope

### Schema
SQLite with WAL mode. Migrations tracked in `schema_meta` table. Current version: 2.
