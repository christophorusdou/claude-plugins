---
description: Run an AI efficiency check-in — review usage stats, track improvements, discover new features, assess project portfolio
argument-hint: [quick|full|research|portfolio]
allowed-tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch", "Agent", "AskUserQuestion", "Skill"]
---

# AI Efficiency Check-In

Load the efficiency-metrics and check-in-protocol skills first using the Skill tool for context on metrics and workflow.

## Determine Mode

Parse `$ARGUMENTS` to determine check-in mode (default: `full`):
- **quick** — metrics + anti-patterns only, no survey/research/portfolio
- **full** — everything: metrics + action item review + research + portfolio
- **research** — metrics + feature/tool research only
- **portfolio** — metrics + project portfolio review only

## Step 1: Data Health Check

Verify data sources are fresh before analyzing:

1. Check `~/.claude/cache/session-snapshots/` — find the newest file, report its age
2. Check `~/.claude/stats-cache.json` — verify it exists and report last-modified
3. Try `http://192.168.130.160:8090/api/heartbeat` via WebFetch — report if claude-dash is up (don't fail if down)

Present: "Data health: snapshots [status], stats-cache [status], claude-dash [status]"

If any source is stale (>24hr for snapshots, >7d for stats-cache), flag it as an action item to investigate.

## Step 2: Load Previous State

Read from `/Volumes/d50-970p-1t/projects/ai-efficiency/data/`:
- `action-items.json` — current improvement goals
- `feature-adoption.json` — feature tracking state
- Latest file from `check-ins/` — to establish review period (date of last check-in)

If no previous check-in exists, this is the baseline session — note that.

## Step 3: Compute Metrics

Dispatch the **usage-analyzer** agent with prompt:
> "Analyze Claude Code usage since [last check-in date or 'all time' if first check-in]. Read session snapshots from ~/.claude/cache/session-snapshots/, stats from ~/.claude/stats-cache.json, and try claude-dash API at http://192.168.130.160:8090/api/sessions. Return structured metrics: cost/session, lines/dollar, zero-output rate, context exhaustion, model mix, session duration distribution, top projects, and any anti-patterns detected."

Present results to the user in a clean table format. Highlight:
- Cost trend (up/down/flat vs last period)
- Model selection: what % Opus vs Sonnet? Flag if Sonnet is underused.
- Anti-patterns found with severity

## Step 4: Review Action Items (skip in quick mode)

For each active item in action-items.json:

Use AskUserQuestion with:
- Question: "Action item: [description]. How's your progress?"
- Header: short label (max 12 chars)
- Options: Done, Partial progress, Not started, Abandoned

After each self-report, validate against data where possible:
- "Use /voice more" → check `voiceEnabled` in `~/.claude/settings.json`
- "Use Sonnet for simple tasks" → check model mix from metrics
- "Break marathon sessions" → check session duration distribution

Note any discrepancies: "You reported [X] but the data shows [Y]"

Update item status based on response.

## Step 5: Research (full/research modes only)

Dispatch the **research-scout** agent with prompt:
> "Search for new Claude Code features, plugin releases, and AI coding tool innovations since [last check-in date]. Read the user's current settings at ~/.claude/settings.json and the current feature adoption data at /Volumes/d50-970p-1t/projects/ai-efficiency/data/feature-adoption.json. Compare what's available vs what's being used. Check if opportunity-radar's SearXNG is available at http://192.168.130.160:8888. Return findings with relevance scores."

Present findings grouped by relevance (high/medium/low). For each high-relevance finding, explain why it matters for the user's specific workflow.

## Step 6: Portfolio Review (full/portfolio modes only)

Dispatch the **portfolio-scout** agent with prompt:
> "Scan ~/projects/* for project health. Check git commit dates, CLAUDE.md presence, tech stacks, and overlaps. Also check ~/projects/ideas/ for the ideas portfolio. [If research findings exist: 'Cross-reference with these research findings: [summary]']. Categorize each project and recommend: continue, stop, consolidate, repurpose, rearchitect, or new-idea."

Present the portfolio health report. Highlight:
- Stalled projects that deserve attention
- Projects to stop or consolidate (with reasoning)
- New project ideas worth considering
- Missing CLAUDE.md on active projects

## Step 7: Generate New Action Items

Based on everything gathered, propose new action items. Each must have:
- **id**: Generate a short unique ID (e.g., "ai-2026-03-21-001")
- **category**: try-feature | stop-doing | investigate | configure | stop-project | consolidate-projects | new-project | rearchitect
- **description**: What to do
- **measurable**: How to know if done
- **validationMethod**: How to check against data

Present proposed items to user via AskUserQuestion (multiSelect) and confirm which to add.

## Step 8: Save Results

Write check-in record to `data/check-ins/YYYY-MM-DD.json` with:
```json
{
  "date": "YYYY-MM-DD",
  "mode": "[mode]",
  "metrics": { ... },
  "actionItemsReviewed": [ ... ],
  "newActionItems": [ ... ],
  "researchFindings": [ ... ],
  "portfolioReport": { ... },
  "selfEvolution": { ... }
}
```

Update `data/action-items.json` with new items and status changes.
Update `data/feature-adoption.json` if new features were discovered.

## Step 9: Self-Evolution Check

Ask: "Based on this check-in, should we change how we track efficiency? New metrics to add? Old ones to drop? Protocol changes?"

If yes, log the change to `data/evolution-log.json` with date, change type, description, and rationale.

## Step 10: Summary

End with a brief summary:
- Key metric: cost trend and top efficiency insight
- Action items: count of new items, count of completed items
- Next check-in: suggest timing based on cadence (weekly for quick, monthly for full)
