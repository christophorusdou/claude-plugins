---
name: mem-maintain
description: >-
  Run knowledge archive maintenance — diff against built-in memory for
  contradictions, audit for staleness, find consolidation candidates, and
  report results. Use periodically or when archive quality is suspect.
---

# Knowledge Archive Maintenance

Run this skill periodically (weekly or when prompted) to keep the knowledge
archive healthy and aligned with built-in memory.

## Prerequisites

Before calling any MCP tools, load their schemas via ToolSearch to ensure
typed parameters are serialized correctly (schemas may be deferred):

```
ToolSearch(query: "select:mcp__plugin_memory_memory__memory_recall,mcp__plugin_memory_memory__memory_manage")
```

## Workflow

Execute these phases in order. Report results after each phase.

### Phase 1: Diff Against Built-in Memory

Compare archive entries against authoritative built-in memory to find
contradictions.

1. Find all MEMORY.md index files:
   ```
   ~/.claude/projects/*/memory/MEMORY.md
   ```
2. For each MEMORY.md, read the linked memory files (the `.md` files it
   points to)
3. For each built-in memory entry, call `memory_recall` with the entry's
   content as the query
4. If a high-similarity match exists (similarity > 0.7) with **contradicting
   content** (same topic, different advice):
   - The built-in entry is authoritative
   - Call `memory_manage` with `action: "downvote"` on the plugin entry,
     `detail: "Contradicts built-in memory: [brief summary]"`
   - Report the contradiction

**Skip** entries where the plugin entry and built-in entry agree — that's
fine (the plugin is a superset).

### Phase 2: Staleness Audit

Call `memory_manage` with `action: "audit"` to find:
- Expired entries (past `valid_until`)
- Near-expiry entries (within 30 days)
- Low-confidence entries with negative scores

Report candidates. For clearly expired entries, suggest deletion. For
near-expiry, suggest review.

### Phase 3: Consolidation Check

Call `memory_manage` with `action: "consolidate"` to find groups of similar
entries that could be merged.

Report groups with their suggested winners and deletion candidates. Do NOT
auto-merge — present for user review.

### Phase 4: Lifecycle Aging

Call `memory_manage` with `action: "age"` and `dry_run: true` to preview deterministic
active→stale→archived transitions (aging is reversible — recall and upvote reactivate an entry).
Present the proposed transitions, then apply with `action: "age"` (omit `dry_run`). Archived entries
are **kept** (recall ranks them far lower), never deleted. Tune with `stale_days` / `archive_days`.

### Phase 5: Summary Report

Summarize:
- Contradictions found and auto-downvoted (Phase 1)
- Stale/expiring entries needing review (Phase 2)
- Consolidation groups found (Phase 3)
- Lifecycle transitions applied (Phase 4)
- Total archive health via `action: "stats"` (now includes `by_lifecycle`)

### Phase 6: Record & Sync

1. Append one line to the curation ledger `~/.claude-memory/curation-log.jsonl`:
   `{"date":"YYYY-MM-DD","contradictions":N,"stale":N,"consolidation_groups":N,"aged_stale":N,"aged_archived":N,"actions":"<what you applied>"}`
2. Stamp the last-curation date (resets the SessionStart nudge):
   `date +%Y-%m-%d > ~/.claude-memory/last-curation`
3. Persist + back up: `memory_manage` with `action: "sync", operation: "push"` — commits `memories.jsonl`
   to `~/.claude-memory/.git` and pushes to the private forgejo remote if configured.

## Notes

- This skill uses existing `memory_recall` and `memory_manage` tools — no
  special capabilities needed
- Phase 1 (diff) is the most important — it enforces the "built-in wins"
  authority rule
- Consolidation suggestions require user approval before merging
- Run `action: "cleanup"` after maintenance to find any newly-qualifying
  low-value entries
