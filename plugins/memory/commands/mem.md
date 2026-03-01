# /mem

Memory management command. Usage:

- `/mem store <content>` — Store a new memory (auto-scoped to current project)
- `/mem store --global <content>` — Store as global memory
- `/mem recall <query>` — Search memories (two-pass: project + global)
- `/mem recall --global <query>` — Search global memories only
- `/mem list [--project=X] [--category=Y]` — List memories with filters
- `/mem update <id> <new content>` — Update a memory
- `/mem delete <id>` — Delete a memory
- `/mem upvote <id>` — Upvote a helpful memory
- `/mem downvote <id>` — Downvote an unhelpful memory
- `/mem stats` — Show memory statistics
- `/mem cleanup` — Find low-value memories to prune
- `/mem consolidate [--threshold=0.70] [--project=X]` — Find groups of similar memories to merge
- `/mem audit [--days=N]` — Find expired, near-expiry, and low-confidence memories
- `/mem sync [push|pull]` — Sync via git (default: push)
- `/mem import <path>` — Import from a MEMORY.md file

## Behavior

When the user invokes `/mem`, parse their intent and call the appropriate MCP tool:

1. **store**: Call `memory_store` with the content. Project is auto-detected from cwd unless `--global` is specified (pass `project: null`). If they specify a category or project, include those.
2. **recall**: Call `memory_recall` with the query text. Omit `project` for two-pass search (project + global with scope boosting). Use `project: null` if `--global` specified.
3. **list**: Call `memory_list` with any filters mentioned.
4. **update**: Call `memory_update` with the ID and new fields.
5. **delete**: Call `memory_delete` with the ID. Confirm with user first.
6. **upvote/downvote**: Call `memory_upvote` or `memory_downvote` with the ID.
7. **stats**: Call `memory_stats`.
8. **cleanup**: Call `memory_cleanup`, then present candidates and ask which to delete.
9. **audit**: Call `memory_audit`. If `--days=N` specified, pass `days_warning: N`. Present candidates and suggest actions (delete, update, extend).
10. **consolidate**: Call `memory_consolidate`. If `--threshold=N` specified, pass `threshold: N`. If `--project=X` specified, pass `project: X`. Present groups and guide the user through the merge workflow (update winner, delete rest).
11. **sync**: Call `memory_sync` with the operation.
12. **import**: Call `memory_import` with the file path.

If no subcommand is given, show this help.
