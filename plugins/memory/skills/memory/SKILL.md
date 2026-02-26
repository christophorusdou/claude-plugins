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

## Recall Strategy

When a memory might be relevant to the current task:
1. Call `memory_recall` with a natural language query (project is auto-detected)
2. If results are helpful, use them and consider calling `memory_upvote`
3. If results are wrong/outdated, call `memory_downvote`

## Formatting Memories

When storing, write concise, actionable content:
- Good: "In the homelab project, Docker bind mounts need `chmod 777` on macOS due to filesystem permissions"
- Bad: "There was an issue with Docker" (too vague)
- Bad: Long paragraphs (memories should be single statements)
