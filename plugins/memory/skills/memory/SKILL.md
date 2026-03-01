---
name: memory
description: Cross-project memory system — store, recall, and manage persistent memories with semantic search, voting, and automatic project scoping
---

# Memory Skill

## When to Use

Use the memory MCP tools when:
- The user explicitly asks to remember/store/save something
- You discover a reusable pattern, gotcha, or insight during work
- You need to recall past decisions or project knowledge
- The user asks about preferences or conventions you should know

## Project Scoping

Memories are automatically scoped to the current project. The server detects the project from its working directory (package.json name, /projects/<name>/ path, or directory basename).

- **Omit `project`** — auto-detects from cwd (most common case)
- **Pass `project: null`** — explicitly store/recall as global
- **Pass `project: "name"`** — explicitly target a specific project

When recalling without an explicit project, the system runs a two-pass search (project-specific + global) and ranks project memories higher. If a project memory conflicts with a global one (e.g., project says "use npm" vs global "use pnpm"), the project memory wins.

### When to use global vs project scope
- **Global**: User preferences that apply everywhere ("always use pnpm", "prefer TypeScript")
- **Project-specific**: Decisions, patterns, gotchas tied to a specific codebase

## Auto-Capture Tiers

### Tier 1: Silent Auto-Capture (high confidence)
Store WITHOUT asking when:
- User states a direct preference: "always use pnpm", "never auto-commit"
- Error resolution after long debugging (the root cause + fix)
- Explicit gotcha that caused wasted time

Use `memory_store` with `source: "auto-captured"`, `confidence: 0.8`.

### Tier 2: Suggest-and-Confirm (medium confidence)
ASK "Want me to save this as a memory?" when:
- Architectural decisions made during planning
- Patterns discovered during code exploration
- Debug insights that might help future sessions

### Tier 3: Never Auto-Capture
Do NOT store:
- Speculative or unverified conclusions
- In-progress exploration state
- Session-specific context (current file being edited, etc.)
- Things that duplicate existing CLAUDE.md instructions

## Triggers

Triggers are keyword or regex patterns attached to a memory that boost its ranking when matched against a recall query. They give explicit control over when a memory surfaces.

### On Store
Add `triggers` when a memory should activate for specific terms that may not appear in the content itself:
```
memory_store content: "Use bind mounts with chmod 777 on macOS" triggers: ["docker", "bind mount", "/\.dockerfile$/i"]
```

### Trigger Syntax
- **Plain string**: case-insensitive substring match against the query (e.g. `"docker"` matches "How do I set up Docker?")
- **Regex**: `/pattern/flags` format. Default flag is `i` (case-insensitive). Example: `/\.tsx$/` matches queries mentioning `.tsx` files. Invalid regex falls back to substring match.
- **Safety**: Regex patterns with nested quantifiers (ReDoS-vulnerable) are rejected at store time and skipped at recall time.

### How It Works
When `memory_recall` runs, any memory whose triggers match the query gets a **+0.20 score boost** during re-ranking. Triggered memories show a `TRIGGER` tag in results. This is additive with scope boost (+0.15 for project matches), so a project memory with a trigger match can get up to +0.35 boost.

## Recall Strategy

When a memory might be relevant to the current task:
1. Call `memory_recall` with a natural language query (project is auto-detected)
2. If results are helpful, use them and consider calling `memory_upvote`
3. If results are wrong/outdated, call `memory_downvote`

## Freshness & Staleness

Memories can become outdated as libraries release new versions or models improve.

### On Store
For version-sensitive memories, include `version_context` (e.g. `"React 18.2"`, `"Node 20"`) and optionally `valid_until` (ISO date) for time-bounded facts. Example:
- Content: "React 18 doesn't support use() hook" → `version_context: "React 18"`, `valid_until: "2027-01-01"`

### On Recall
When a recalled memory looks outdated (e.g. a library version has changed, a workaround is no longer needed):
1. Call `memory_downvote` with a `detail` explaining why (this also marks it expired immediately)
2. Optionally store a corrected replacement memory

### Periodic Audit
Run `memory_audit` (or `/mem audit`) periodically to find:
- Expired memories past their `valid_until` date
- Memories expiring soon (within 30 days by default)
- Low-confidence memories that have been repeatedly downvoted

Review candidates and delete, update, or extend their `valid_until` as appropriate.

## Consolidation

Over time, related memories accumulate — different phrasings of the same insight, fragments that overlap. The dedup layer catches near-duplicates at store time (0.85 threshold), but doesn't help with existing memories that are related but distinct.

### Finding Groups
Run `memory_consolidate` (or `/mem consolidate`) to find groups of similar memories. The tool uses a lower similarity threshold (default 0.70) and groups connected memories via BFS.

Each group shows:
- **KEEP**: The suggested winner (highest score, most used, oldest)
- **DEL**: Candidates for deletion after merging their content into the winner

When `project` is omitted, consolidation searches across all projects — a global memory and a project-scoped memory about the same thing will be grouped together.

### Merging Workflow
1. Run `memory_consolidate` to find groups
2. Review each group — decide what content to keep
3. `memory_update` the winner with consolidated content
4. `memory_delete` the rest

Options:
- `threshold`: Similarity threshold (0.50–0.84, default 0.70). Lower finds more groups.
- `project`: Filter to a specific project, or `null` for global only.
- `limit`: Max groups to return (default 10).

## Formatting Memories

When storing, write concise, actionable content:
- Good: "In the homelab project, Docker bind mounts need `chmod 777` on macOS due to filesystem permissions"
- Bad: "There was an issue with Docker" (too vague)
- Bad: Long paragraphs (memories should be single statements)
