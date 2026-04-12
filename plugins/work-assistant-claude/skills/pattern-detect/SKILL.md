---
name: pattern-detect
description: Analyze work data to detect patterns, inefficiencies, and self-improvement opportunities
allowed-tools: Read, Bash, Write
---

# Pattern Detection Skill

Analyze accumulated data to find non-obvious patterns and improvement opportunities.

## Input

Analysis window (default: 7 days). Can be overridden with a custom range.

## Workflow

### 1. Gather Data

Query all tables for the analysis window:

```sql
-- Sessions
SELECT * FROM synced_sessions WHERE session_date >= date('now', '-7 days');

-- Jira transitions
SELECT * FROM jira_transitions WHERE captured_at >= date('now', '-7 days');

-- Journal entries
SELECT * FROM journal_entries WHERE date >= date('now', '-7 days');

-- Standup entries
SELECT * FROM standup_entries WHERE date >= date('now', '-7 days');

-- Previous patterns (for context)
SELECT * FROM detected_patterns ORDER BY detected_at DESC LIMIT 20;
```

### 2. Analyze by Category

#### Workflow Patterns
- Look for: repeated manual commands, frequent tool usage patterns
- Example: "You ran /api-sync 8 times this sprint — should this be a post-merge hook?"
- Evidence: tool usage counts from sessions, command patterns

#### Time Patterns
- Look for: session duration distributions, time-of-day productivity, meeting impact
- Example: "Most productive coding 1-3pm, but architect meeting at 3pm Tuesdays interrupts"
- Evidence: session timestamps, durations, output metrics

#### Quality Patterns
- Look for: recurring bug types, test failures mentioned in journal, deployment issues
- Example: "3 blocker entries this week related to Squidex migrations"
- Evidence: journal entries of type 'blocker', Jira transitions to 'Blocked'

#### Sprint Patterns
- Look for: velocity trends, carry-over frequency, estimation accuracy
- Example: "Velocity dropped 20% — common theme: Squidex migration complexity"
- Evidence: Jira sprint data, story point history

#### Blocker Patterns
- Look for: recurring blocker themes, dependency bottlenecks
- Example: "Auth-related tickets blocked 4 times this quarter waiting on Okta admin"
- Evidence: jira_transitions to 'Blocked', journal blocker entries

#### Self-Improvement Patterns
- Look for: assistant feature usage, data freshness, which outputs are actually consumed
- Example: "Morning briefings generated 5/5 days but standup module unused"
- Evidence: wa_config timestamps, output file access patterns

### 3. Generate Findings

For each detected pattern:
- description: clear, actionable statement
- evidence: JSON with specific data points (dates, ticket keys, session IDs)
- suggestion: what to do about it
- pattern_type: category from above

### 4. Store and Output

- Insert new patterns into `detected_patterns` with status `new`
- Skip patterns similar to recently dismissed ones (check dismiss_reason)
- Write weekly report to `modules/patterns/output/YYYY-WXX.md`

## Project Path

All paths relative to `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
