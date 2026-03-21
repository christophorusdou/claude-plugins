---
name: check-in-protocol
description: Step-by-step protocol for conducting an AI efficiency check-in session. Load this skill when running /check-in to follow the correct review workflow.
---

# Check-In Protocol

## Review Cadence

| Type | Frequency | Command | Scope |
|------|-----------|---------|-------|
| Quick stats | Daily or as-needed | `/quick-stats` | Metrics only, read-only |
| Weekly review | Every 7 days | `/check-in quick` | Metrics + action item check |
| Full review | Monthly | `/check-in full` | Everything: metrics + survey + research + portfolio |
| Research-focused | After major tool updates | `/check-in research` | Metrics + feature discovery |
| Portfolio review | Monthly or quarterly | `/check-in portfolio` | Metrics + project health assessment |

The SessionStart hook nudges after 7 days without a check-in.

## Check-In Workflow (10 Steps)

### 1. Data Health Check
Verify sources are fresh. Flag issues immediately — stale data means stale recommendations.

### 2. Load Previous State
Read action-items.json, feature-adoption.json, latest check-in. Establish the review period.

### 3. Compute Metrics
Dispatch usage-analyzer agent. Wait for structured report before continuing.

### 4. Present Metrics
Show the user a clean summary. Highlight trends (improving/declining) and any metric in the "bad" range per metrics-catalog.md thresholds.

### 5. Review Action Items
For each active item, survey the user. Then cross-validate against data. Note discrepancies honestly.

### 6. Research (full/research modes)
Dispatch research-scout agent. Present findings grouped by relevance.

### 7. Portfolio Review (full/portfolio modes)
Dispatch portfolio-scout agent (feed research findings if available). Present health report.

### 8. Generate Action Items
Based on all findings, propose 3-7 new action items. Each must be:
- **Measurable**: "Reduce Opus usage to <80%" not "Use Sonnet more"
- **Time-bound**: "By next check-in" or specific date
- **Validatable**: Specify how to check against data
- **Specific**: One clear action, not a vague goal
- **Categorized**: try-feature | stop-doing | investigate | configure | stop-project | consolidate-projects | new-project | rearchitect

### 9. Save Results
Write check-in JSON and update data files. All changes go to `/Volumes/d50-970p-1t/projects/ai-efficiency/data/`.

### 10. Self-Evolution
Ask if the system should change. Log any changes.

## Validation Rules

How to cross-check self-reports against data:

| Self-report | Data check |
|------------|------------|
| "I use /voice now" | Check voiceEnabled in ~/.claude/settings.json |
| "I use Sonnet for simple tasks" | Check model mix from usage-analyzer |
| "I break up long sessions" | Check session duration distribution |
| "I use plan mode more" | Check plan_sessions ratio in history |
| "I stopped project X" | Check last git commit date |

## Action Item Categories

| Category | When to use | Example |
|----------|------------|---------|
| try-feature | Feature exists but isn't adopted | "Enable /voice for brainstorming sessions" |
| stop-doing | Anti-pattern detected | "Stop using Opus for commit messages" |
| investigate | Unclear if beneficial | "Test if /fast mode reduces wait time noticeably" |
| configure | Settings change needed | "Set effortLevel to 'low' for simple tasks" |
| stop-project | Project is obsolete/redundant | "Archive claude-code-usage — claude-dash covers it" |
| consolidate-projects | Overlapping projects | "Merge X's metrics into Y" |
| new-project | Gap identified | "Build a tool for X based on Y research finding" |
| rearchitect | Tech landscape shifted | "Migrate project from X to Y framework" |

## Self-Evolution Protocol

During step 10, evaluate:
1. Are all tracked metrics still useful? Drop ones that never change.
2. Should new metrics be added based on recent patterns?
3. Are the anti-pattern thresholds calibrated correctly?
4. Should the review cadence change?
5. Are there new data sources to integrate?

Log changes to evolution-log.json with: date, change_type (add-metric | drop-metric | adjust-threshold | add-data-source | change-cadence), description, rationale.
