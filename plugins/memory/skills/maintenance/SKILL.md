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

### Phase 4: Summary Report

Summarize:
- Contradictions found and auto-downvoted
- Stale/expiring entries needing review
- Consolidation groups found
- Total archive health (entry count, score distribution via `action: "stats"`)

## Notes

- This skill uses existing `memory_recall` and `memory_manage` tools — no
  special capabilities needed
- Phase 1 (diff) is the most important — it enforces the "built-in wins"
  authority rule
- Consolidation suggestions require user approval before merging
- Run `action: "cleanup"` after maintenance to find any newly-qualifying
  low-value entries
