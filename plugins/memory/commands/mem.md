# /mem

Memory management command. Usage:

- `/mem store <content>` — Store a new memory (auto-scoped to current project)
- `/mem store --global <content>` — Store as global memory
- `/mem recall <query>` — Search memories (two-pass: project + global)
- `/mem recall --global <query>` — Search global memories only
- `/mem get <id>` — Show one memory in full (content, metadata, event history)
- `/mem list [--project=X] [--category=Y]` — List memories with filters
- `/mem update <id> <new content>` — Update a memory
- `/mem delete <id>` — Delete a memory
- `/mem upvote <id>` — Upvote a helpful memory
- `/mem downvote <id>` — Downvote an unhelpful memory (repeated downvotes demote to stale/archived)
- `/mem stats` — Show memory statistics
- `/mem consolidate [--threshold=0.5] [--project=X]` — Find groups of similar memories to merge (Jaccard similarity)
- `/mem merge <id> --into=<winner-id>` — Absorb a memory into another (keeps a tombstone; never hard-deletes)
- `/mem audit [--days=N]` — Find expired, near-expiry, and low-confidence memories
- `/mem age [--dry-run]` — Preview/apply lifecycle aging (also runs automatically at session end every ~7 days)
- `/mem curate` — Judgment-based maintenance pass (diff vs built-in → audit → consolidate → report) via the mem-maintain skill
- `/mem sync [push|pull|status|reindex]` — Git sync ops (auto-sync runs at session end; `status` shows the last background push result; `reindex` rebuilds the FTS index after suspected corruption)
- `/mem import <path>` — Import from a MEMORY.md file

## Behavior

When the user invokes `/mem`, parse their intent and call the appropriate MCP tool:

1. **store**: Call `memory_store` with the content. Project is auto-detected from cwd unless `--global` is specified (pass `project: null`). If they specify a category or project, include those. On a near-duplicate response, show the candidates and ask whether to update the existing entry or retry with `allow_similar: true`.
2. **recall**: Call `memory_recall` with the query text (keywords work best). Omit `project` for two-pass search (project + global with scope boosting). Use `project: null` if `--global` specified.
3. **get**: Call `memory_manage` with `action:"get"`, `id`.
4. **list**: Call `memory_manage` with `action:"list"` and any filters mentioned.
5. **update**: Call `memory_manage` with `action:"update"`, the ID, and new fields.
6. **delete**: Call `memory_manage` with `action:"delete"`. Confirm with user first.
7. **upvote/downvote**: Call `memory_manage` with `action:"upvote"` / `action:"downvote"`.
8. **stats**: Call `memory_manage` with `action:"stats"`.
9. **audit**: Call `memory_manage` with `action:"audit"`. If `--days=N` specified, pass `days_warning: N`. Present candidates and suggest actions (delete, update, extend).
10. **consolidate**: Call `memory_manage` with `action:"consolidate"`. If `--threshold=N` specified, pass `threshold: N`. If `--project=X` specified, pass `project: X`. Present groups and guide the user through the merge workflow: update the winner with consolidated content, then `memory_manage action:"merge"` each loser with `merged_into: <winner id>` — never delete losers (tombstones keep provenance and sync-safety).
11. **sync**: Call `memory_manage` with `action:"sync"` and the operation (default: push).
12. **import**: Call `memory_manage` with `action:"import"` and the file path.
13. **age**: Call `memory_manage` with `action:"age"`. If `--dry-run`, pass `dry_run:true` (preview, no changes). Aging also runs automatically at session end, so manual runs are for tuning `stale_days` / `archive_days`.
14. **merge**: Call `memory_manage` with `action:"merge"`, `id: <loser>`, `merged_into: <winner>`. Confirm with the user first.
15. **curate**: Run the **mem-maintain** skill — the judgment-based maintenance pass (diff built-in memory → audit → consolidate → report). Get approval before any merges/deletes. Aging and sync are automatic and not part of this pass.

If no subcommand is given, show this help.
