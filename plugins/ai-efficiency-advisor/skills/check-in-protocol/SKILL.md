---
name: check-in-protocol
description: This skill should be used when conducting an AI efficiency check-in, reviewing the check-in workflow, understanding review cadence (quick/full/research/portfolio modes), generating or reviewing action items, conducting self-report surveys with data validation, managing action item categories, or running the self-evolution protocol. Relevant when running /check-in or asking about the efficiency review process.
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

## Check-In Workflow

The step-by-step execution is defined in `commands/check-in.md`. This skill provides the reference context (cadence, validation rules, action item format, self-evolution protocol) that the command relies on.

## Action Item Requirements

Every action item generated must be:
- **Measurable**: "Reduce Opus usage to <80%" not "Use Sonnet more"
- **Time-bound**: "By next check-in" or specific date
- **Validatable**: Specify how to check against data
- **Specific**: One clear action, not a vague goal
- **Categorized**: One of the categories below
- **Self-contained**: Includes `workFrom` field, full implementation details, enough context to act on from the relevant project directory

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
