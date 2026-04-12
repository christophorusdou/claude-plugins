---
name: meeting-prep
description: Generate preparation materials for sprint review, planning, grooming, or architect meetings
allowed-tools: Read, Bash, Write, Grep, Glob
---

# Meeting Prep Skill

Generate meeting-specific preparation documents.

## Input

Expects a meeting type argument: `sprint-review`, `sprint-planning`, `grooming`, or `architect`.

## Workflow

### 1. Load Configuration

- Read `modules/meeting-prep/config.yaml` for sprint calendar
- Calculate current sprint window (start date, end date, day number)
- Read `modules/core/config.yaml` for work repo paths

### 2. Gather Data (varies by meeting type)

#### sprint-review
- Jira: tickets completed this sprint (`status = 'Done'` in latest snapshot, sprint matches current)
- Jira transitions: all transitions this sprint
- Sessions: all sessions during sprint window (both machines)
- Git: `git log --since=<sprint_start>` across all work repos
- Journal: decisions and learnings this sprint
- PRs: merged PRs this sprint (via GitHub MCP or git log)

#### sprint-planning
- Jira: backlog tickets (not in current sprint, unresolved)
- Jira: velocity from last 3 sprints (completed points per sprint)
- Journal: tech debt entries, blocker patterns
- Capacity: team availability (from core config, manual adjustments)

#### grooming
- Jira: specific tickets to groom (passed as additional argument or from backlog)
- ADRs: relevant architecture decisions from `docs/adr/`
- Codebase: pattern files from `docs/patterns/`
- Previous grooming notes for context

#### architect
- Journal: decisions this week
- Patterns: detected patterns (all types)
- ADRs: recently created or modified
- Cross-team: any known impacts from this week's work
- Sessions: architecture-related work this week

### 3. Generate Document

- Read appropriate template from `modules/meeting-prep/templates/<type>.md`
- Fill in template with gathered data
- Apply judgment: prioritize, highlight risks, suggest talking points

### 4. Write Output

- Write to `modules/meeting-prep/output/<type>/YYYY-MM-DD.md`
- Present the document

## Project Path

Data repo: `/Volumes/d50-970p-1t/projects/work-assistant-claude/`
Work repos: `/Volumes/d50-970p-1t/projects/work/`
