---
name: memory
description: >-
  Cross-project knowledge archive — searchable data lake and fallback for
  built-in memory. Use for cross-project search, past debugging insights,
  architectural decisions, and patterns.
---

# Knowledge Archive

## Role & Authority

This plugin is a **data lake fallback**, not a replacement for Claude Code's built-in memory.

- **Built-in MEMORY.md is always authoritative.** If the plugin contradicts built-in memory, built-in wins. Downvote the conflicting plugin entry.
- **Built-in memory handles**: user preferences, session feedback, workflow corrections, project-specific context
- **This plugin handles**: cross-project knowledge, durable patterns/gotchas/insights, semantic search over past learnings

Do NOT store user preferences or session feedback here. Those belong in built-in memory.

## When to Use memory_recall

Use `memory_recall` when:
- **Cross-project search** — looking for how something was done in a different project (built-in memory can't do this)
- **Past debugging insights** — searching for a gotcha or root cause from a previous session
- **Architectural decisions** — recalling trade-offs considered in past work
- **Built-in memory doesn't have it** — fallback when context isn't in the current project's MEMORY.md

Do NOT use as a first resort. Check built-in memory first.

## When to Use memory_store

Store entries that are:
- **Cross-project relevant** — patterns, gotchas, insights that apply beyond one project
- **Worth semantic search** — content that benefits from vector similarity matching
- **Durable knowledge** — debug discoveries, architectural decisions, reusable facts

### Auto-Capture Tiers

**Tier 1: Silent capture** (high confidence)
Store without asking when:
- Error resolution after long debugging (root cause + fix)
- Explicit gotcha that caused wasted time
- Non-obvious integration behavior between systems

Use `memory_store` with `source: "auto-captured"`, `confidence: 0.8`.

**Tier 2: Suggest-and-confirm** (medium confidence)
Ask "Want me to save this to the knowledge archive?" when:
- Architectural decisions made during planning
- Patterns discovered during code exploration
- Debug insights that might help future sessions

**Tier 3: Never capture**
Do NOT store:
- User preferences ("always use pnpm") — use built-in memory
- Session feedback ("don't summarize") — use built-in memory
- Speculative or unverified conclusions
- In-progress exploration state
- Things that duplicate built-in MEMORY.md or CLAUDE.md instructions

## Project Scoping

Entries are automatically scoped to the current project from the working directory.

- **Omit `project`** — auto-detects from cwd (most common)
- **Pass `project: null`** — explicitly global
- **Pass `project: "name"`** — target a specific project

### Two-pass recall
When project is auto-detected, recall searches project-specific entries first, then global, and ranks project entries higher (+0.15 boost). If a project entry conflicts with a global one, the project entry wins.

### Global scope
Use global for cross-project knowledge: infrastructure patterns, tool behaviors, library gotchas that apply everywhere.

## Tools

Three MCP tools:

### memory_store
Store a new knowledge entry. See "When to Use memory_store" above.

### memory_recall
Semantic + keyword hybrid search. See "When to Use memory_recall" above.

### memory_manage
All other operations via the `action` parameter:
- `update` — edit content, category, tags, triggers of an existing entry
- `delete` — remove an entry by ID
- `upvote` / `downvote` — vote on entry quality (affects ranking)
- `list` — list entries with filters
- `stats` — counts by project, category, source
- `cleanup` — suggest low-value entries for deletion
- `audit` — find expired, near-expiry, and low-confidence entries
- `consolidate` — find groups of similar entries that could be merged
- `sync` — git-based sync (push/pull/export/rebuild)
- `import` — import from a MEMORY.md file

## Triggers

Triggers are keyword/regex patterns that boost an entry's ranking when matched against a recall query (+0.20 boost).

```
memory_store content: "Use bind mounts with chmod 777 on macOS" triggers: ["docker", "bind mount"]
```

- **Plain string**: case-insensitive substring match
- **Regex**: `/pattern/flags` format (default flag: `i`)
- Patterns with nested quantifiers (ReDoS-vulnerable) are rejected at store time

## Freshness & Staleness

For version-sensitive entries, include `version_context` and optionally `valid_until`:
- `version_context: "React 18"`, `valid_until: "2027-01-01"`
- Expired entries rank lower (0.3x freshness multiplier)
- Entries approaching expiry ramp down (0.5x-1.0x in final 7 days)

When a recalled entry looks outdated: downvote it with detail explaining why, then optionally store a corrected replacement.

## Formatting

Write concise, actionable content (max 5,000 characters):
- Good: "In the homelab project, Docker bind mounts need chmod 777 on macOS due to filesystem permissions"
- Bad: "There was an issue with Docker" (too vague)
- Bad: Long paragraphs (entries should be single actionable statements)
