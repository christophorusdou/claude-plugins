---
name: meeting-prep
description: Prepare for sprint review, planning, grooming, or architect meetings
argument-hint: "<sprint-review|sprint-planning|grooming|architect>"
---

# /meeting-prep — Meeting Preparation

Generate preparation materials for a specific meeting type.

## Behavior

1. Gather meeting-specific data:
   ```bash
   bash /Volumes/d50-970p-1t/projects/work/work-assistant-claude/scripts/wa-meeting-data.sh <type>
   ```

2. The script outputs structured sections relevant to the meeting type (completed tickets, carry-over risk, git activity, calendar, journal decisions, patterns, ADRs).

3. Format the data into a meeting prep markdown document with:
   - **sprint-review:** Demo script, per-member accomplishments, velocity, carry-over risk
   - **sprint-planning:** Carry-over items, backlog recommendations, capacity, risk flags
   - **grooming:** Technical feasibility, story breakdowns, acceptance criteria drafts
   - **architect:** Talking points, decision proposals, recent patterns, cross-team impacts

4. Write to: `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/modules/meeting-prep/output/<type>/YYYY-MM-DD.md`

If no argument provided, suggest based on the calendar:
```bash
/Volumes/d50-970p-1t/projects/work/work-assistant-claude/scripts/get-calendar 1 | jq -r '.[] | select(.all_day == false) | .title'
```
Match meeting titles against known types (Sprint Review, Sprint Planning, Refinement, Architecture).

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work/work-assistant-claude/`
