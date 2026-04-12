---
name: meeting-prep
description: Prepare for sprint review, planning, grooming, or architect meetings
argument-hint: "<sprint-review|sprint-planning|grooming|architect>"
---

# /meeting-prep — Meeting Preparation

Generate preparation materials for a specific meeting type.

## Usage

- `/meeting-prep sprint-review` — demo script, accomplishments, velocity
- `/meeting-prep sprint-planning` — capacity, ticket recommendations, risks
- `/meeting-prep grooming` — feasibility, story breakdowns, acceptance criteria
- `/meeting-prep architect` — talking points, decision proposals, cross-team impacts

## Behavior

1. Parse the meeting type argument
2. Invoke the `meeting-prep` skill with the type
3. Skill gathers data from Jira, sessions, journal, git log
4. Generates preparation document using the appropriate template
5. Writes to `modules/meeting-prep/output/<type>/YYYY-MM-DD.md`
6. Presents the preparation document

If no argument provided, show available meeting types and suggest based on sprint calendar (e.g., "Sprint review is Wednesday — did you mean sprint-review?").

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work-assistant-claude/`
Sprint calendar: `modules/meeting-prep/config.yaml`
