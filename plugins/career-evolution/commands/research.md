---
name: research
description: Run a career research session — deep industry research, personal growth scan, and strategic recommendations
argument-hint: "[latest|topic <name>|review]"
---

# /research — Career Research Session

This command runs career research sessions to keep you informed about industry trends, job market shifts, and AI developments relevant to your career strategy.

## Modes

### `latest` (default — also used when no arguments provided)
Full research workflow. Invokes the `career-research` skill to execute the complete 7-phase research process:
1. Context loading from profile and previous sessions
2. Industry research via WebSearch across 4 domains
3. Personal growth scan via git log
4. Checkpoint for review
5. Report generation with trend tracking
6. Actionable recommendations
7. Discussion and decision recording

**Usage:** `/research` or `/research latest`

### `topic <name>`
Focused deep-dive on a specific topic. Uses the `career-research` skill but scopes all research queries to the given topic.

**Usage:** `/research topic MCP ecosystem` or `/research topic AI coding tools`

### `review`
Quick review of open recommendations, pending decisions, and strategic bet status — no new research performed.

**Usage:** `/research review`

## Behavior

For `latest` and `topic` modes:
- Invoke the `career-research` skill with the appropriate scope
- The skill handles the full 7-phase workflow including WebSearch, report generation, and SQLite tracking

For `review` mode:
1. Read the last research report from `research/` directory (sorted by date, newest first)
2. Read `decisions/_index.md` for open decisions
3. Read `profile/strategic-bets.md` for current bet status
4. Present a compact summary including:
   - Key findings from last session
   - Open recommendations and their status
   - Decisions past their review date
   - Strategic bet confidence levels
