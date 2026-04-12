---
name: jira-sync
description: Pull Jira sprint data and detect ticket transitions
allowed-tools: Bash, Read, Write
---

# Jira Sync Skill

Sync Jira sprint board data into local SQLite.

## Workflow

### 1. Load Configuration

- Read `modules/jira/config.yaml` for Jira URL, board ID, project keys
- Read Jira token: `security find-generic-password -s work-assistant-jira -a chris -w`

### 2. Fetch Active Sprint

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$JIRA_URL/rest/agile/1.0/board/$BOARD_ID/sprint?state=active"
```

Extract sprint ID and name.

### 3. Fetch Sprint Issues

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$JIRA_URL/rest/agile/1.0/sprint/$SPRINT_ID/issue?maxResults=100&fields=summary,status,assignee,customfield_10016,labels,priority,comment"
```

Note: `customfield_10016` is typically story points (verify for your Jira instance).

### 4. Fetch Assigned Issues (Beyond Sprint)

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$JIRA_URL/rest/api/2/search?jql=assignee=currentUser()+AND+resolution=Unresolved&fields=summary,status,sprint,customfield_10016,labels,priority,comment"
```

### 5. Insert Snapshots

For each ticket, insert into `jira_snapshots`:
- ticket_key, summary, status, assignee, sprint, story_points, labels, priority
- last_comment (most recent comment text), last_comment_author

### 6. Detect Transitions

Compare current snapshot with previous snapshot for each ticket:

```sql
SELECT ticket_key, status FROM jira_snapshots
WHERE snapshot_at = (SELECT MAX(snapshot_at) FROM jira_snapshots WHERE snapshot_at < datetime('now', '-1 hour'))
```

If status changed → insert into `jira_transitions`.

### 7. Update Config

Update `wa_config` with `last_jira_sync` = now.

### 8. Report

Output: tickets synced count, transitions detected, any blocked tickets.

## Project Path

All paths relative to `/Volumes/d50-970p-1t/projects/work-assistant-claude/`
