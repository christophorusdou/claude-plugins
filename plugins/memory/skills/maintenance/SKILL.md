---
name: mem-maintain
description: >-
  Run knowledge archive maintenance — diff against built-in memory for
  contradictions, audit for staleness, find consolidation candidates, and
  report results. Use periodically or when archive quality is suspect.
---

# Knowledge Archive Maintenance

Run this skill periodically (or when the SessionStart nudge fires) to keep the
knowledge archive healthy and aligned with built-in memory.

**What's already automatic (do not redo here):** lifecycle aging, WAL
checkpointing, journal/snapshot export, and git sync all run in the SessionEnd
maintenance hook. This skill covers the parts that need LLM judgment:
contradiction diffing, staleness review, and consolidation.

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
   key terms as the query (keyword search — pick distinctive nouns)
4. If a highly relevant match exists (rel > 0.7) with **contradicting
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

Report groups with their suggested winners and merge candidates. Do NOT
auto-merge — present for user review. For each approved merge: update the winner
with the consolidated content, then call `memory_manage` with `action: "merge"`,
`id: <loser>`, `merged_into: <winner>` — **never delete losers**; the merge action
keeps a recall-excluded tombstone that preserves provenance.

### Phase 4: Summary Report

Summarize:
- Contradictions found and auto-downvoted (Phase 1)
- Stale/expiring entries needing review (Phase 2)
- Consolidation groups found and merges applied (Phase 3)
- Total archive health via `action: "stats"` (includes `by_lifecycle`)
- Sync health via `action: "sync", operation: "status"` (last background push result)

(Lifecycle aging is NOT a phase anymore — it runs automatically at session end
every ~7 days. Run `action: "age"` manually only to tune `stale_days` /
`archive_days` or to preview with `dry_run: true`.)

## Notes

- This skill uses existing `memory_recall` and `memory_manage` tools — no
  special capabilities needed
- Phase 1 (diff) is the most important — it enforces the "built-in wins"
  authority rule
- Consolidation suggestions require user approval before merging
- The ledger `~/.claude-memory/curation-log.jsonl` and the `last-curation`
  stamp are written server-side by age/merge/delete — no manual bookkeeping
