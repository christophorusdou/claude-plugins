---
name: jira-sync
description: Pull Jira sprint data and assigned tickets via Atlassian MCP
allowed-tools: Read, Bash, Write, mcp__atlassian__searchJiraIssuesUsingJql, mcp__atlassian__getJiraIssue
---

# Jira Sync Skill

Sync Jira sprint board data and assigned tickets into local SQLite.

## Integration

Uses the **Atlassian MCP server** (OAuth-authenticated) rather than raw REST API calls. No token management needed — the MCP server handles authentication.

## Workflow

### 1. Load Configuration

- Read `modules/jira/config.yaml` for cloud_id, project_keys, JQL filters

### 2. Fetch Active Sprint Tickets

Use the Atlassian MCP tool:
```
mcp__atlassian__searchJiraIssuesUsingJql({
  cloudId: "<cloud_id from config>",
  jql: "project = PARKS AND sprint in openSprints() ORDER BY rank ASC",
  fields: ["summary", "status", "assignee", "priority", "labels", "customfield_10016"],
  maxResults: 100,
  responseContentFormat: "markdown"
})
```

### 3. Fetch Assigned Tickets (Beyond Sprint)

```
mcp__atlassian__searchJiraIssuesUsingJql({
  cloudId: "<cloud_id>",
  jql: "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
  fields: ["summary", "status", "priority", "labels", "customfield_10016"],
  maxResults: 50,
  responseContentFormat: "markdown"
})
```

### 4. Parse and Insert

For each ticket from both queries:
- Extract: key, summary, status, assignee, sprint, story_points, labels, priority
- Generate SQL INSERT statements
- Apply to `jira_snapshots` table (use `INSERT OR IGNORE` for deduplication)

### 5. Detect Transitions

Compare current snapshot with previous snapshot for each ticket:

```sql
-- Get previous snapshot for each ticket
SELECT ticket_key, status FROM jira_snapshots
WHERE snapshot_at < datetime('now', '-1 hour')
GROUP BY ticket_key
HAVING snapshot_at = MAX(snapshot_at)
```

If status changed → insert into `jira_transitions`.

### 6. Update Config

```sql
INSERT OR REPLACE INTO wa_config (key, value, module)
VALUES ('last_jira_sync', datetime('now'), 'jira');
```

### 7. Report

Output: tickets synced count, transitions detected, any blocked tickets.

## Fallback

If the Atlassian MCP server is not available (not authenticated), fall back to REST API with macOS Keychain token:
```bash
TOKEN=$(security find-generic-password -s work-assistant-jira -a chris -w)
curl -s -H "Authorization: Bearer $TOKEN" "https://tylertech.atlassian.net/rest/api/3/search?jql=..."
```

## Project Path

All paths relative to `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
