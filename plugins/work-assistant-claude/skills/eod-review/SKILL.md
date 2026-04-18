---
name: eod-review
description: Summarize the day and write an automatic journal entry
allowed-tools: Read, Bash, Write, Grep
---

**Scope:** Work workspace only. Do not execute if CWD is outside `/Volumes/d50-970p-1t/projects/work/`.
# EOD Review Skill

End-of-day summary — what happened today across both machines.

## Workflow

### 1. Gather Today's Data

- Query `synced_sessions WHERE session_date = date('now')` for today's sessions
- Query `jira_transitions WHERE captured_at >= date('now')` for today's ticket movements
- Run `git -C <repo> log --since="today" --oneline` across work repos for today's commits
- Read today's journal entries

### 2. Summarize

Generate sections:
- **Sessions:** machine, project, branch, duration, what was accomplished
- **Commits:** repos with commits today, key changes
- **Jira:** tickets that moved status, new tickets assigned
- **Decisions:** any journal entries of type "decision"
- **Blockers:** active blockers, any resolved today

### 3. Flag Follow-ups

Identify incomplete work:
- In-progress sessions that didn't produce commits
- Jira tickets still in "In Progress" that weren't worked on
- Mentioned but unresolved blockers
- PRs that need attention tomorrow

### 4. Write Journal Entry

Insert `journal_entries` row:
- date: today
- entry_type: `auto-eod`
- content: structured summary
- source: `auto-eod`

### 5. Write Output

Write to `modules/eod-review/output/YYYY-MM-DD.md`
Update `wa_config` with `last_eod_review` timestamp

## Project Path

All paths relative to `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
