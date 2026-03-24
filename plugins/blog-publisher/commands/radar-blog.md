---
name: radar-blog
description: Publish blog posts from Opportunity Radar findings. Fetches scan data, writes digest or deep-dive posts, and deploys to blog.cdrift.com.
argument-hint: "[digest|deep-dive|all]"
---

# /radar-blog — Publish Blog Posts from Radar Findings

Generate and publish blog posts from Opportunity Radar scan findings. Works with any scan mode (intelligence, opportunities).

## Modes

### `digest` (default)

Write a digest post for the most recent unblogged completed scan.

**Usage:** `/radar-blog` or `/radar-blog digest`

### `deep-dive`

Write an editorial deep-dive for the highest-scoring unblogged finding (score >= 8).

**Usage:** `/radar-blog deep-dive`

### `all`

Process all unblogged completed scans: write a digest for each, plus deep-dives for any findings scoring >= 8. Designed for automated/scheduled use.

**Usage:** `/radar-blog all`

## Workflow

### Step 1: Load state

1. Read the dedup tracker:
   ```bash
   cat ~/projects/blog/.radar-published.json
   ```

2. Fetch recent completed scans from the Radar API:
   ```bash
   curl -s "http://localhost:8091/api/scans?limit=20"
   ```

3. Filter to scans that:
   - Have `status: "completed"`
   - Have `finding_count > 0`
   - Are NOT already in the `digests` section of `.radar-published.json`

4. If no unblogged scans exist, report "No new scans to publish" and stop.

5. For `digest` mode: pick the most recent unblogged scan.
   For `deep-dive` mode: fetch high-scoring findings not in `deep_dives` tracker:
   ```bash
   curl -s "http://localhost:8091/api/findings?min_score=8&limit=20"
   ```
   Pick the highest-scoring unblogged finding.
   For `all` mode: process all unblogged scans as digests, plus all unblogged findings with score >= 8 as deep-dives.

### Step 2: Fetch full scan data

For each scan to process:
```bash
curl -s "http://localhost:8091/api/scans/{scan_id}"
```

This returns `{ scan: {..., summary: "..."}, findings: [...] }`.

### Step 3: Read references

Read the blog-writing skill references:
- `references/radar-digest-template.md` — post structure and templates
- `references/style-guide.md` — writing rules
- `references/frontmatter-schema.md` — valid frontmatter fields

### Step 4: Write the post

**For digest posts:**

1. Generate frontmatter:
   - `title`: "{Domain} Radar: {Month Day, Year}" (e.g., "AI Tools & Agents Radar: March 24, 2026")
   - `description`: Hook from the scan summary's first sentence
   - `pubDate`: today's date
   - `category`: "intelligence" for intelligence mode, "opportunities" for opportunities mode
   - `unlisted`: true
   - `tags`: domain slug + "radar" + "digest" + unique finding types
   - `readTime`: estimate from content length

2. Write the body using the digest template from `references/radar-digest-template.md`:
   - Use the scan's `summary` field as the introduction
   - Render each finding as a section ordered by score (highest first)
   - Include score badge, finding_type, summary, why_it_matters, key_links, actionability

3. Generate the slug: `{domain-slugified}-radar-{YYYY-MM-DD}` (e.g., `ai-tools-agents-radar-2026-03-24`)

**For deep-dive posts:**

1. Fetch the parent scan for the finding (to get domain context):
   ```bash
   curl -s "http://localhost:8091/api/scans/{finding.scan_id}"
   ```

2. Generate an editorial title from the finding (not just the finding title — make it engaging)

3. Write 800-1500 words following the deep-dive template from `references/radar-digest-template.md`:
   - Use WebSearch to gather additional context and verify claims
   - Back assertions with evidence from key_links
   - Add depth beyond what the finding summary provides

4. Generate the slug from the editorial title

### Step 5: Create file, build, deploy

Follow the standard blog-writing workflow (Phases 4-6):

1. Write the markdown file to `~/projects/blog/src/content/blog/{slug}.md`

2. Build and verify:
   ```bash
   cd ~/projects/blog && pnpm build
   ```

3. Update the dedup tracker (`~/projects/blog/.radar-published.json`):
   - For digests: add `scan_id → { slug, published: "YYYY-MM-DD" }` to `digests`
   - For deep-dives: add `finding_id → { slug, published: "YYYY-MM-DD" }` to `deep_dives`

4. Commit everything together:
   ```bash
   cd ~/projects/blog && git add src/content/blog/{slug}.md .radar-published.json && git commit -m "publish: {short-title}"
   ```

5. Push to deploy:
   ```bash
   cd ~/projects/blog && git push forgejo main
   ```

6. Report the published URL: `blog.cdrift.com/{category}/{slug}/`

### Step 6: Repeat (for `all` mode)

If mode is `all`, loop back to Step 4 for the next unblogged scan or finding.

## Important Notes

- **No user interaction in `all` mode** — write and publish without stopping for approval. This enables scheduled automation.
- **Interactive modes (`digest`, `deep-dive`)** — present the draft for review before publishing. Wait for user approval after Step 4.
- **Build failures** — fix frontmatter issues automatically. If unfixable, skip the post and report the error.
- **API unavailable** — if the Radar API is unreachable, report the error and stop. Do not proceed with stale data.
