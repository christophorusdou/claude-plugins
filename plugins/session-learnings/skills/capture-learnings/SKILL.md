---
name: capture-learnings
description: >-
  Capture session learnings at session end. Used when the session-learnings Stop
  hook blocks to persist non-obvious insights, debugging discoveries, architectural
  decisions, or gotchas. Also invoked when the user asks to "save what we learned",
  "capture session insights", or "remember this for next time".
---

# Capture Learnings

## Storage Decision

Choose the storage target based on what is available.

### Primary: Knowledge archive (when memory_store tool is available)

**Before calling memory_store**, load its schema to ensure typed parameters
(arrays, numbers) are serialized correctly:

```
ToolSearch(query: "select:mcp__plugin_memory_memory__memory_store")
```

This is required because MCP tool schemas may be deferred (evicted from
context) by the time a stop hook triggers this skill. Without the schema,
array and number parameters get serialized as strings and fail validation.

Then call `memory_store` for each distinct learning with:
- `source`: `"auto-captured"`
- `confidence`: `0.8`
- `category`: one of `pattern`, `gotcha`, `debug-insight`, `decision`
- `triggers`: 2-4 keywords a developer would search when they need this insight
- Omit `project` — let auto-detection scope it from cwd

Do NOT capture user preferences or workflow feedback here — those belong
in built-in memory (MEMORY.md files).

### Fallback: Auto-memory files (when memory MCP is unavailable)

1. Check if a `MEMORY.md` index exists under the project's
   `~/.claude/projects/<project-path>/memory/` directory
2. If it exists, write each learning as a separate `.md` file:

```markdown
---
name: <kebab-case-identifier>
description: <one-line summary for index matching>
type: project
---

<The learning as an actionable statement>
**Context:** <When/why this was discovered>
**Applies when:** <Conditions where this is relevant>
```

3. Add a pointer to each new file in `MEMORY.md`
4. If no memory directory exists, append to the project's `CLAUDE.md`
   under a `## Session Learnings` section

## Formatting Rules

Write each learning as a single actionable statement — advice to a future
developer hitting the same situation.

**Good:**
- "pgx v5 `QueryRow().Scan()` silently returns zero values on column type
  mismatch instead of erroring — always verify column types match Go types
  when queries return unexpected zeros"
- "SvelteKit `load` functions in `+page.server.ts` run on every navigation
  including client-side, not just initial page load — cache expensive
  operations or they fire on every route change"

**Bad:**
- "Fixed a bug in the auth module" (no insight)
- "TypeScript is good for type safety" (obvious)
- "Updated the database schema" (in git)

## What NOT to Store

- Information already in CLAUDE.md or project docs
- Implementation details obvious from reading the code
- Task-specific state ("we were working on X")
- Speculative conclusions not verified during the session

## Multiple Learnings

Store each distinct learning separately. Do not combine unrelated insights
into a single entry.

## After Capturing

Briefly summarize what was captured (one line per learning) so the user
knows what was saved. Then allow the session to end.
