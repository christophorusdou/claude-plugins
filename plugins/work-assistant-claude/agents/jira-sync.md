---
name: jira-sync
description: Periodic Jira sprint data sync
schedule: "0 8,10,12,14,16 * * 1-5"
cwd: /Volumes/d50-970p-1t/projects/work/work-assistant-claude
---

# Jira Sync Agent

Runs every 2 hours during work hours (8am, 10am, 12pm, 2pm, 4pm), Monday through Friday.

## Prompt

Sync Jira sprint data by invoking the `jira-sync` skill. This is an unattended scheduled run — do not ask for user input.

Pull active sprint tickets and assigned issues from Jira REST API. Detect status transitions since last sync. Update the jira_snapshots and jira_transitions tables. Report count of tickets synced and transitions detected.
