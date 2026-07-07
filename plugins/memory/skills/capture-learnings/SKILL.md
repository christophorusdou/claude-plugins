---
name: capture-learnings
description: >-
  Capture session learnings at session end. Used when the memory plugin's Stop
  hook blocks to persist non-obvious insights, debugging discoveries, architectural
  decisions, or gotchas. Also invoked when the user asks to "save what we learned",
  "capture session insights", or "remember this for next time".
effort: low
---

# Capture Learnings

## Storage Decision

Choose the storage target based on what the learning IS, then on tool availability.

**Routing rule (authority model):**
- Durable **user/project preferences and workflow corrections** → built-in memory
  (`~/.claude/projects/<slug>/memory/`) — it is authoritative for those.
- **Cross-project technical insights** (gotchas, debug root causes, patterns,
  decisions) → the knowledge archive via `memory_store`.

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

### Fallback: Built-in memory files (when memory MCP is unavailable)

1. Write each learning as a separate `.md` file under
   `~/.claude/projects/<project-path>/memory/` (built-in per-fact format with
   frontmatter), and add a pointer line to `MEMORY.md`
2. If no memory directory exists, append to the project's `CLAUDE.md`
   under a `## Session Learnings` section
3. **TELL THE USER, visibly**: "memory plugin unavailable — learnings saved to
   built-in memory instead. Run `/mem import <file>` later to move them into
   the archive." Never fall back silently — a quiet destination switch is how
   knowledge gets lost.

## Formatting Rules

**Write declarative facts about how the world behaves, never imperatives to
yourself.** Imperative phrasing gets re-read as a directive in later sessions
and can override the user's actual request.

**Good (declarative):**
- "pgx v5 `QueryRow().Scan()` silently returns zero values on column type
  mismatch instead of erroring"
- "SvelteKit `load` functions in `+page.server.ts` run on every navigation
  including client-side, not just initial page load"

**Bad:**
- "Always verify column types before scanning" (imperative — store the behavior, not the order)
- "Fixed a bug in the auth module" (no insight)
- "TypeScript is good for type safety" (obvious)

## What NOT to Capture

These become persistent self-imposed constraints that bite later:

- **Environment-dependent failures**: missing binaries, unconfigured
  credentials, "command not found", fresh-install or path-migration errors.
  The user can fix these; they are not durable knowledge. If the failure was
  setup-state, capture the FIX (install command, config step) — never the failure.
- **Negative claims about tools/features** ("X tool is broken", "cannot use Y").
  These harden into refusals cited for months after the problem was fixed.
- **Transient errors that resolved within the session.** If retrying worked,
  the lesson is the retry pattern, not the failure.
- **One-off task narratives**, task progress, session state, or anything
  already in git history, CLAUDE.md, or project docs.
- Implementation details obvious from reading the code, or speculative
  conclusions not verified during the session.

## Limits & Duplicates

- **At most 5 learnings per session** — pick the ones a future session would
  actually need.
- If `memory_store` reports a **near-duplicate**, update or upvote the
  existing entry instead of rephrasing to force a new one. Use
  `allow_similar: true` only when the new entry is genuinely distinct.
- **Thrash cap**: after 3 failed store attempts in one capture pass, stop and
  report the failure instead of retrying.

## Multiple Learnings

Store each distinct learning separately. Do not combine unrelated insights
into a single entry.

## After Capturing

Briefly summarize what was captured (one line per learning) so the user
knows what was saved. Then allow the session to end.
