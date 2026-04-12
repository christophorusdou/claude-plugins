---
name: wa-sync
description: Force immediate data sync — sessions, Jira, or all
argument-hint: "[sessions|jira|all]"
---

# /wa-sync — Force Data Sync

Trigger immediate data synchronization.

## Modes

### `sessions`

Sync session data from both sources:
1. Query Claude Dash API for recent sessions (both machines)
2. Process any `.jsonl` files in `sync/incoming/`
3. Report: new sessions found, machines, projects

**Usage:** `/wa-sync sessions`

### `jira`

Sync Jira sprint data:
1. Read Jira token from macOS Keychain
2. Call Jira REST API for active sprint and assigned tickets
3. Detect status transitions since last sync
4. Report: tickets synced, transitions detected

**Usage:** `/wa-sync jira`

### `all` (default)

Run both sessions and Jira sync.

**Usage:** `/wa-sync` or `/wa-sync all`

## Behavior

Invokes the appropriate skill(s):
- `sessions` → `session-sync` skill
- `jira` → `jira-sync` skill
- `all` → both skills sequentially

After sync, update `wa_config` timestamps and report results.

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
