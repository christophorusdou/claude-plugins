---
name: standup-prep
description: Generate concise standup talking points (yesterday/today/blockers)
allowed-tools: Read, Bash, Write
---

# Standup Prep Skill

Generate a ~30-second standup script.

## Workflow

### 1. Gather Yesterday's Work

- Read today's briefing if available (`modules/briefing/output/YYYY-MM-DD.md`)
- Query `synced_sessions WHERE session_date = date('now', '-1 day')` for yesterday's sessions
- Query `journal_entries WHERE date = date('now', '-1 day')` for yesterday's journal entries
- Query `jira_transitions` for yesterday's ticket movements

### 2. Determine Today's Plan

- Query `jira_snapshots` for tickets assigned to Chris with status "In Progress"
- Read this morning's journal entries (if any)
- Check briefing's "Today's Focus" section

### 3. Identify Blockers

- Query `jira_snapshots` for tickets with status "Blocked" or blocker flag
- Query `journal_entries WHERE entry_type = 'blocker' AND date >= date('now', '-2 days')`

### 4. Generate Standup Script

Format:

```
**Yesterday:**
- [Concise bullet points of work done]

**Today:**
- [Planned work items with ticket references]

**Blockers:**
- [Active blockers, or "None"]
```

### 5. Store and Output

- Insert into `standup_entries` table (upsert on date)
- Write to `modules/standup/output/YYYY-MM-DD.md`
- Present the standup script

## Project Path

All paths relative to `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
