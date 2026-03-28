---
name: career
description: View or update career profile, skills inventory, and strategic bets
argument-hint: "[summary|update|bets|skills]"
effort: low
---

# /career — Profile Management

Manage your career profile, skills inventory, and strategic bets.

## Modes

### `summary` (default)
Read and display a compact summary of your career profile. Reads:
- `profile/chris.md` — core profile and career context
- `profile/skill-inventory.md` — current skills and levels
- `profile/strategic-bets.md` — strategic paths and confidence levels

Format as a dashboard-style overview with key stats, current focus areas, and strategic direction at a glance.

### `update`
Interactive update of `profile/chris.md`. Ask what has changed:
- Current role or responsibilities
- Active projects
- Key concerns or anxieties
- Career direction or priorities

Update the file with new information while preserving the overall structure.

### `bets`
Review `profile/strategic-bets.md`. For each strategic bet:
1. Show the current confidence level and rationale
2. Ask if there is new evidence to add (positive or negative)
3. Update confidence levels and evidence log accordingly
4. Write changes back to the file

Require specific evidence for confidence changes — not vibes.

### `skills`
Review `profile/skill-inventory.md`. For each skill category:
1. Show the current table (skill, level, trajectory, strategic value)
2. Ask what has changed: new skills learned, level changes, trajectory shifts
3. Update the file with changes

Optionally take a skill snapshot to SQLite for tracking over time:
```bash
sqlite3 data/career.db "INSERT INTO skill_snapshots (date, skill, level, trajectory, strategic_value) VALUES ('$(date +%Y-%m-%d)', '<skill>', <level>, '<trajectory>', <strategic_value>);"
```
