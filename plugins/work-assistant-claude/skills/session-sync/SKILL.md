---
name: session-sync
description: Sync session data from Claude Dash API and SMB incoming files
allowed-tools: Bash, Read, Write, Glob
---

# Session Sync Skill

Ingest session data from both Claude Dash API and SMB file share.

## Workflow

### 1. Claude Dash API Sync

```bash
curl -s http://192.168.130.160:8090/api/status
```

Parse JSON response:
- Extract sessions from all state groups (active, awaiting, idle, inactive)
- For each session: detect machine from CWD path
- Insert into `synced_sessions` with `source = 'claude_dash_api'`
- Skip if `session_id` already exists (deduplication)

### 2. SMB Incoming Files

List `sync/incoming/*.jsonl`:
- For each file:
  1. Read and parse JSONL (each line is a conversation turn)
  2. Extract: session_id from filename, project from path context
  3. Generate summary: key files edited, tools used, git operations performed
  4. Determine machine from path patterns in content
  5. Insert into `synced_sessions` with `source = 'smb_transcript'`
  6. If session_id exists from API: merge (transcript enriches API data)
  7. Move file to `sync/processed/$(date +%Y%m%d)_<filename>`

### 3. Deduplication

If both sources provide the same session_id:
- Keep transcript summary (richer context)
- Keep API cost/token data (more accurate)
- Update source to `smb_transcript` (indicates full data available)

### 4. Update Config

Update `wa_config` with `last_session_sync` = now.

### 5. Report

Output: new sessions synced, machines, projects, any errors.

## Project Path

All paths relative to `/Volumes/d50-970p-1t/projects/work-assistant-claude/`
