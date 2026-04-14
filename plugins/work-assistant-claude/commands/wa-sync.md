---
name: wa-sync
description: Force immediate data sync — sessions, Jira, or all
argument-hint: "[sessions|jira|all]"
---

# /wa-sync — Force Data Sync

Trigger immediate data synchronization.

## Behavior

### For sessions and all:

Run the sync script:
```bash
bash /Volumes/d50-970p-1t/projects/work/work-assistant-claude/scripts/wa-sync.sh <mode>
```

Where `<mode>` is `sessions`, `jira`, or `all` (default).

### For jira (in interactive session with Atlassian MCP):

If the Atlassian MCP tools are available (mcp__atlassian__searchJiraIssuesUsingJql), prefer using them over the curl-based script — they handle OAuth automatically.

Query with cloudId `748898e2-ca0a-43b6-981b-09e249be204c`:
1. `project = PARKS AND sprint in openSprints() ORDER BY rank ASC` for sprint tickets
2. `assignee = currentUser() AND resolution = Unresolved AND project = PARKS` for assigned tickets

Parse results and insert into jira_snapshots table via sqlite3.

If Atlassian MCP is not available, fall back to the script (requires Jira token in Keychain).

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
