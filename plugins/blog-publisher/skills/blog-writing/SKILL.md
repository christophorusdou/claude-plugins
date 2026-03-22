---
name: blog-writing
description: >-
  Use when writing or publishing a blog post to blog.cdrift.com. Executes a
  multi-phase workflow: context discovery from current repo, topic proposal,
  drafting with style guide adherence, frontmatter validation, file creation
  in the blog repo, build verification, and deployment. Triggered by
  /publish-blog command or when the user mentions writing a blog post.
user-invocable: false
---

# Blog Writing Skill -- Full Publishing Workflow

This skill guides the complete process of writing and publishing a blog post to blog.cdrift.com.

**Blog repo:** `~/projects/blog/`
**Posts directory:** `~/projects/blog/src/content/blog/`
**Categories:** ai, news, tips, homelab

Follow all phases in order. Read the reference docs before drafting.

---

## Phase 1: Context Discovery

Understand what content is available to write about from the current repo.

1. Read the current repo's `CLAUDE.md` or `README.md` to understand the project
2. Check recent git activity for publishable material:
   ```bash
   git log --since="4 weeks ago" --oneline --no-merges | head -20
   ```
3. Look for research outputs, analysis files, decision records, or significant feature work:
   - Research reports (`research/*.md`, `analysis/*.md`)
   - Decision records (`decisions/*.md`)
   - README sections describing completed features
   - Data files with interesting findings
4. Read the blog's existing posts to avoid duplicating topics:
   ```bash
   ls ~/projects/blog/src/content/blog/
   ```

Summarize: What content from this repo could make a good blog post? Present 2-3 options with proposed titles, categories, and angles.

**STOP and wait for the user to choose a topic or provide their own.** Do not proceed until the user confirms.

---

## Phase 2: Topic Refinement

Once the user picks a topic:

1. Determine the **category** (must be one of: `ai`, `news`, `tips`, `homelab`)
2. Read `references/style-guide.md` for the voice and structure rules for that category
3. Read `references/frontmatter-schema.md` for the exact schema
4. Propose:
   - Title (clear, specific, often includes a data point or provocative claim)
   - Description (1-2 sentences, for RSS/meta)
   - Tags (3-5, lowercase, hyphenated)
   - Estimated readTime (words / 250, rounded)
   - Slug (lowercase, hyphenated, for filename)
   - sourceUrl (if news category)
5. Gather source material from the current repo -- read the relevant files that will inform the post

Present the proposal and **STOP for user confirmation** before drafting.

---

## Phase 3: Drafting

Write the full blog post following the style guide in `references/style-guide.md`.

### Key Rules

**Voice (by category):**
- **ai, news**: Analytical third-person. "The data shows...", "Engineers who..."
- **tips, homelab**: Personal first-person. "I found...", "In my experience..."

**Tone**: Data-driven throughout. Every claim must be backed by a named source, specific number, or concrete example. No unsupported assertions.

**References**: Use WebSearch to verify facts and find primary sources. Link to original data, not secondary reporting. Cite specific numbers, dates, and attribution.

**Structure** (read style guide for category-specific details):
1. Opening hook -- lead with data or a concrete problem
2. Body sections (3-6 H2s) -- one point per section with evidence
3. Practical implications -- actionable takeaways
4. Source footer -- `---` then italic source list with links

**Formatting**:
- H2/H3 for sections (never H1 -- title comes from frontmatter)
- Bold key phrases (2-5 words), not full sentences
- Em dashes (---) for parenthetical asides
- Code blocks with language identifiers
- Tables for comparative data (3+ rows)

Read `references/post-examples.md` for annotated style anchors before writing.

Present the complete draft for review. **STOP and wait for user feedback.** Iterate until the user is satisfied.

---

## Phase 4: File Creation

Once the user approves the draft:

1. Generate the filename as `<slug>.md` (e.g., `mcp-vs-cli.md`)
2. Write the file to `~/projects/blog/src/content/blog/<slug>.md`
3. Verify the file was created:
   ```bash
   cat ~/projects/blog/src/content/blog/<slug>.md | head -20
   ```

---

## Phase 5: Build Verification

Verify the blog builds successfully with the new post:

```bash
cd ~/projects/blog && pnpm build
```

If the build fails:
1. Read the error output carefully
2. Common issues:
   - Frontmatter validation (wrong category, missing fields, invalid date)
   - Invalid `sourceUrl` format
   - Tags not as array format
3. Fix the issue in the post file and rebuild
4. Do not proceed until the build succeeds

If the build succeeds, confirm: "Build succeeded. The post will appear at `blog.cdrift.com/<category>/<slug>`."

---

## Phase 6: Commit and Deploy

### Commit

Stage and commit the new post:

```bash
cd ~/projects/blog && git add src/content/blog/<slug>.md && git commit -m "publish: <short-title>"
```

### Deploy

Check if a remote is configured:

```bash
cd ~/projects/blog && git remote -v
```

**If remote exists:**
```bash
cd ~/projects/blog && git push
```
This triggers Forgejo Actions CI which builds and deploys to Cloudflare Pages automatically.

**If no remote:**
```bash
cd ~/projects/blog && npx wrangler pages deploy dist/ --project-name=news-cdrift-com
```

### Confirm

Tell the user the post is live (or will be once CI completes) at:
`https://blog.cdrift.com/<category>/<slug>`
