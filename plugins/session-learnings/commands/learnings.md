---
name: learnings
description: Capture or review session learnings
---

# /learnings

Manually capture or review session learnings.

## Arguments

- No arguments: Reflect on the current session and capture any non-obvious learnings
- `review`: Show recent auto-captured learnings for the current project

## Behavior

### Capture (default)

Invoke the `capture-learnings` skill. Reflect on the session so far and
identify any non-obvious insights, gotchas, debugging discoveries, or
architectural decisions worth preserving. Follow the skill's storage and
formatting guidelines.

### Review

First load the MCP tool schema (it may be deferred):
```
ToolSearch(query: "select:mcp__plugin_memory_memory__memory_recall")
```

If the `memory_recall` MCP tool is available, call it with a broad query
scoped to the current project, filtering to source `"auto-captured"`.
Display results grouped by category.

If MCP is unavailable, read the project's auto-memory directory and list
recent entries, or check `CLAUDE.md` for a `## Session Learnings` section.
