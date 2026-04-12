---
name: morning-briefing
description: Generate the daily morning briefing with session data, Jira status, git state, and patterns
allowed-tools: Read, Bash, Glob, Grep, Write
---

# Morning Briefing Skill

Generate a comprehensive morning intelligence briefing.

## Workflow

### 1. Load Configuration

- Read `modules/core/config.yaml` for work repo paths and timezone
- Read `modules/meeting-prep/config.yaml` for sprint calendar
- Read `modules/session-sync/config.yaml` for Claude Dash API URL

### 2. Sync Session Data

- Query Claude Dash API: `curl -s http://192.168.130.160:8090/api/status`
- Parse response for sessions from last 24 hours
- Detect machine from CWD path patterns
- Insert new sessions into `synced_sessions` table
- Process any `.jsonl` files in `sync/incoming/`

### 3. Sync Jira Data

- Read Jira token: `security find-generic-password -s work-assistant-jira -a chris -w`
- Read `modules/jira/config.yaml` for Jira URL and board ID
- Call Jira REST API for active sprint tickets
- Compare with last snapshot to detect transitions
- Insert new `jira_snapshots` and `jira_transitions` rows

### 4. Check Git Status

- For each repo in `/Volumes/d50-970p-1t/projects/work/`:
  - `git -C <repo> status --porcelain` for dirty files
  - `git -C <repo> branch --show-current` for current branch
  - Check for open PRs if GitHub MCP available

### 5. Calculate Sprint Context

- From sprint calendar config: determine current sprint day, days remaining
- From Jira snapshots: count completed/in-progress/blocked tickets and points
- Assess velocity vs previous sprint

### 6. Check Patterns

- Query `detected_patterns WHERE status = 'new'` for unreviewed patterns

### 7. Determine Today's Meetings

- From sprint calendar config: check which meetings fall on today's weekday
- Check if today is a sprint ceremony day

### 8. Generate Briefing

- Read template from `modules/briefing/templates/morning-briefing.md`
- Fill in all sections with gathered data
- Write to `modules/briefing/output/YYYY-MM-DD.md`
- Update `wa_config` with `last_briefing` timestamp

### 9. Present

- Display the generated briefing to the user

## Data Sources

| Source | What We Get |
|--------|------------|
| Claude Dash API | Session metadata (both machines) |
| sync/incoming/ | Full session transcripts (Windows) |
| Jira REST API | Sprint tickets, transitions |
| git CLI | Repo status, branches, dirty files |
| detected_patterns table | Unreviewed patterns |
| meeting-prep config | Sprint calendar, meeting schedule |

## Project Path

All paths relative to `/Volumes/d50-970p-1t/projects/work-assistant-claude/`
