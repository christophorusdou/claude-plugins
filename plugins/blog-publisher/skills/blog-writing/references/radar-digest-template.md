# Radar Digest & Deep-Dive Templates

Templates for blog posts generated from Opportunity Radar scan findings.

## Digest Post Structure

A digest post aggregates all findings from a single radar scan into a newsletter-style roundup.

### Frontmatter

```yaml
---
title: "{Domain} Radar: {Date}"
description: "Top {N} findings from scanning {sources_description} — {brief hook from highest-scored finding}"
pubDate: {YYYY-MM-DD}
category: "{mode_category}"
unlisted: true
tags: [{derived_tags}]
readTime: {estimated}
---
```

**Category mapping:**
- `intelligence` mode → `intelligence` category
- `opportunities` mode → `opportunities` category

**Tag derivation:** Combine the scan domain slug + unique finding_type values + "radar" + "digest". Example: `["ai-tools", "radar", "digest", "tools", "techniques", "news"]`

### Body Structure

```markdown
{Scan digest summary — 2-3 paragraphs from scan.summary field. This is the executive overview written by Claude during synthesis. Use it verbatim or lightly edit for flow.}

---

## {Finding 1 Title}

**Signal: {score}/10** · **{finding_type}**

{summary}

{if why_it_matters}
**Why it matters:** {why_it_matters}
{/if}

{if actionability}
**Next step:** {actionability}
{/if}

{if key_links}
**Links:** {key_links as markdown links}
{/if}

---

## {Finding 2 Title}

{... repeat for each finding, ordered by score descending ...}

---

*Findings sourced from {sources list}. Scanned and synthesized by [Opportunity Radar](https://github.com/chris/opportunity-radar).*
```

### Digest Writing Rules

- Use the scan's `summary` field as the intro — it's already a well-written digest
- Order findings by score (highest first)
- Keep finding sections concise — the structured data IS the content
- Don't add fluff between findings; the signal-to-noise ratio is the value
- Include ALL findings from the scan (don't cherry-pick for digests)
- Use the finding's `finding_type` as a category badge: tip, tool, project, technique, idea, news
- Key links should be rendered as clickable markdown links with descriptive text

---

## Deep-Dive Post Structure

A deep-dive expands a single high-scoring finding into a full editorial blog post.

### Frontmatter

```yaml
---
title: "{Editorial title based on finding}"
description: "{1-2 sentence hook — what makes this worth a full post}"
pubDate: {YYYY-MM-DD}
category: "{mode_category}"
unlisted: true
tags: [{finding-specific tags}]
readTime: {estimated, usually 4-8 min}
---
```

### Body Structure

Write 800-1500 words following the blog style guide. Structure:

1. **Opening hook** — Lead with the most interesting aspect. Why should the reader care?
2. **Context** — What is this? Technical background for practitioners
3. **Analysis** — Dig into the details. What's novel? How does it compare?
4. **Practical implications** — What can developers/teams do with this?
5. **Assessment** — Is this signal or noise? Your take on significance
6. **Next steps** — Concrete actions for the reader

### Deep-Dive Writing Rules

- Voice: analytical third-person (like `ai` category)
- Back every claim with evidence from the finding's key_links or WebSearch
- Use WebSearch to find additional context, benchmarks, alternatives
- Don't just restate the finding — add depth, context, and opinion
- Link to the original sources generously
- Include code examples or configuration snippets when relevant
- End with a clear, actionable recommendation

---

## Dedup Tracking

Before writing, check `~/projects/blog/.radar-published.json`:

```json
{
  "digests": {
    "{scan_id}": { "slug": "...", "published": "YYYY-MM-DD" }
  },
  "deep_dives": {
    "{finding_id}": { "slug": "...", "published": "YYYY-MM-DD" }
  }
}
```

- Skip any scan whose ID is already in `digests`
- Skip any finding whose ID is already in `deep_dives`
- After publishing, update this file and commit it alongside the blog post

---

## Radar API Reference

All endpoints are at `http://localhost:8091` (or via SvelteKit proxy at `http://localhost:3004`).

| Endpoint | Returns |
|----------|---------|
| `GET /api/scans?limit=20` | Recent scans: id, domain, mode, status, finding_count, summary |
| `GET /api/scans/{id}` | Scan detail + `findings[]` array with full metadata |
| `GET /api/findings?mode=intelligence&min_score=8` | Filtered findings across all scans |

**Finding metadata fields (JSONB):**
- `category` — tip, tool, project, technique, idea, news
- `why_it_matters` — significance explanation
- `key_links` — array of URLs
- `actionability` — concrete next step
