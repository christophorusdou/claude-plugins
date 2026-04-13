#!/bin/bash
# Work Assistant Claude — Session Start Context
# Shows ambient context when in work-assistant-claude/ or work/ directories

WA_DIR_1="/Volumes/d50-970p-1t/projects/work/work-assistant-claude"
WA_DIR_2="/Users/chris/projects/work/work-assistant-claude"
WORK_DIR_1="/Volumes/d50-970p-1t/projects/work"
WORK_DIR_2="/Users/chris/projects/work"

# Only show context in relevant directories
if [[ "$PWD" != "$WA_DIR_1"* ]] && [[ "$PWD" != "$WA_DIR_2"* ]] && \
   [[ "$PWD" != "$WORK_DIR_1"* ]] && [[ "$PWD" != "$WORK_DIR_2"* ]]; then
  exit 0
fi

# Find the data repo
if [ -d "$WA_DIR_1/data" ]; then
  WA_DIR="$WA_DIR_1"
elif [ -d "$WA_DIR_2/data" ]; then
  WA_DIR="$WA_DIR_2"
else
  echo "Work Assistant: data repo not found. Expected at $WA_DIR_1"
  exit 0
fi

DB="$WA_DIR/data/assistant.db"

# Check if database exists
if [ ! -f "$DB" ]; then
  echo "Work Assistant: database not initialized. Run: sqlite3 $DB < $WA_DIR/data/schema.sql"
  echo "Commands: /briefing /standup /journal /meeting-prep /wa-status /wa-sync"
  exit 0
fi

echo "── Work Assistant ──────────────────────────"

# Check briefing
TODAY=$(date +%Y-%m-%d)
BRIEFING="$WA_DIR/modules/briefing/output/${TODAY}.md"
if [ -f "$BRIEFING" ]; then
  echo " Briefing: ready (${TODAY})"
else
  echo " Briefing: not yet generated — run /briefing"
fi

# Check Jira attention items
JIRA_COUNT=$(sqlite3 "$DB" "SELECT COUNT(DISTINCT ticket_key) FROM jira_snapshots js WHERE (js.status LIKE '%Blocked%' OR js.status LIKE '%Review%') AND js.snapshot_at = (SELECT MAX(snapshot_at) FROM jira_snapshots WHERE ticket_key = js.ticket_key);" 2>/dev/null || echo "0")
if [ "$JIRA_COUNT" -gt 0 ] 2>/dev/null; then
  echo " Jira: $JIRA_COUNT tickets need attention"
fi

# Check last Windows session
LAST_WIN=$(sqlite3 "$DB" "SELECT session_date || ' (' || project || ')' FROM synced_sessions WHERE machine='windows' ORDER BY synced_at DESC LIMIT 1;" 2>/dev/null)
if [ -n "$LAST_WIN" ]; then
  echo " Last Win session: $LAST_WIN"
fi

# Next meeting (from calendar)
NEXT_MTG=$(swift "$WA_DIR/scripts/get-calendar.swift" 0 2>/dev/null | jq -r '[.[] | select(.all_day == false)] | sort_by(.start) | .[0] | "\(.start[11:16]) \(.title)"' 2>/dev/null)
if [ -n "$NEXT_MTG" ] && [ "$NEXT_MTG" != "null null" ]; then
  echo " Next: $NEXT_MTG"
fi

# Email unread count (Exchange only)
EMAIL_UNREAD=$(osascript -e 'tell application "Mail" to return unread count of mailbox "Inbox" of account "Exchange"' 2>/dev/null)
if [ -n "$EMAIL_UNREAD" ] && [ "$EMAIL_UNREAD" -gt 0 ] 2>/dev/null; then
  echo " Email: $EMAIL_UNREAD unread (Exchange)"
fi

# Check for new patterns
PATTERN_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM detected_patterns WHERE status='new';" 2>/dev/null || echo "0")
if [ "$PATTERN_COUNT" -gt 0 ] 2>/dev/null; then
  echo " Patterns: $PATTERN_COUNT new suggestions"
fi

echo "────────────────────────────────────────────"
echo "Commands: /briefing /standup /journal /meeting-prep /wa-status /wa-sync"

exit 0
