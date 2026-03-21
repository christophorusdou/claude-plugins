---
name: decisions
description: Review, record, or manage career decisions
argument-hint: "[list|new <title>|review]"
---

# /decisions — Decision Management

Track, record, and review career decisions with structured decision records.

## Modes

### `list` (default)
Read `decisions/_index.md` and display recent decisions with their status. Show:
- Decision title and date
- Current status (active, superseded, revisiting)
- Review date
- Brief summary

### `new <title>`
Create a new decision record:
1. Use the template at `templates/decision-record.md`
2. Walk through each section interactively (context, options considered, decision, rationale, risks, review date)
3. Write the completed record to `decisions/YYYY-MM-DD-<slug>.md` where `<slug>` is a URL-friendly version of the title
4. Update `decisions/_index.md` with the new entry

**Usage:** `/decisions new Focus on MCP ecosystem`

### `review`
Find decisions where the review date has passed:
1. Scan all decision files in `decisions/` for review dates
2. For each overdue decision, present the original decision and context
3. Ask: Is this still valid? Does it need revisiting? Has it been superseded?
4. Update the decision status based on the response
5. Update `decisions/_index.md` accordingly
