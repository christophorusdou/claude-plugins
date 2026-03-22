# Blog Writing Style Guide -- blog.cdrift.com

## Voice

Chris's blog voice is **analytical, direct, and evidence-based**. Written for senior software engineers who value data over hype.

### Voice by Category

| Category | Voice | Perspective | Example |
|----------|-------|-------------|---------|
| ai | Analytical third-person | Observer/analyst | "The data shows...", "Engineers who..." |
| news | Analytical third-person | Commentator | "The announcement signals...", "This matters because..." |
| tips | Personal first-person | Practitioner | "I found...", "In my experience...", "Here's how I..." |
| homelab | Personal first-person | Builder | "I run...", "My setup uses...", "The tradeoff I chose..." |

### Tone (All Categories)

Data-driven throughout. Every claim must be supported by:
- A **named source** (company, researcher, publication)
- A **specific number** (percentage, dollar amount, count)
- A **concrete example** (real tool, real incident, real benchmark)

No unsupported assertions. If you can't cite it, don't claim it.

### Do

- Lead with the most interesting finding or data point
- Name specific sources (company names, research papers, survey titles)
- Include specific numbers (percentages, token counts, dollar amounts)
- Acknowledge when data is limited or uncertain
- Present tradeoffs explicitly before stating a position
- End with practical, actionable takeaways
- Use WebSearch to verify facts and find primary sources

### Don't

- Open with "In this article..." or "Today we're going to..."
- Use superlatives without data ("revolutionary", "game-changing", "incredible")
- Make claims without attribution ("experts say", "many believe")
- Write conclusions that just restate the introduction
- Use exclamation points in prose
- Include emojis
- Write paragraphs longer than 5 sentences
- Use "Let's dive in", "buckle up", or similar filler

---

## Structure by Category

### AI Analysis (category: "ai")

- **Length:** 2,000-3,000 words
- **Structure:** Data hook -> 3-5 evidence sections -> synthesis -> implications -> sources
- **Sources:** Named research, specific surveys, company announcements, benchmarks
- **Voice:** Third-person analytical

### News (category: "news")

- **Length:** 1,000-2,000 words
- **Structure:** What happened -> why it matters -> what to do about it
- **Sources:** Primary source required (`sourceUrl` field links to original)
- **Voice:** Third-person commentary -- not just reporting, add analysis

### Tips (category: "tips")

- **Length:** 1,500-2,500 words
- **Structure:** Problem statement -> solution -> implementation steps -> gotchas
- **Sources:** Personal experience, tool documentation, session data
- **Voice:** First-person practical -- "Here's exactly how"

### Homelab (category: "homelab")

- **Length:** 1,500-2,500 words
- **Structure:** Goal -> architecture decisions -> implementation -> results
- **Sources:** Personal infrastructure, documentation, benchmark data
- **Voice:** First-person build log meets architecture decision record

---

## Formatting Conventions

### Headings

- Title comes from frontmatter (never write an H1 in the body)
- H2 (`##`) for major sections
- H3 (`###`) for subsections within an H2
- Never skip heading levels (no H2 -> H4)

### Emphasis

- **Bold** for key phrases that stand out on a skim (2-5 words)
- *Italics* for source attributions, asides, and introducing terms
- Never bold entire sentences

### Lists

- Bullet lists for unordered items (3+ items)
- Numbered lists only when order matters (steps, rankings)
- Bold the first phrase of list items when they serve as labels

### Code

- Inline code for: commands, file paths, config values, tool names
- Code blocks with language identifier for: multi-line code, config files, terminal output
- Keep code blocks under 15 lines; truncate with comments if longer

### Tables

- Use when comparing 3+ items across 2+ dimensions
- Always include a header row
- Keep data clean and scannable

### Links

- Inline links for references within the text
- Source list at bottom for all major sources
- Internal cross-references: `[link text](/category/slug)`

### Source Attribution Footer

Every post ends with a horizontal rule then italic source list:

```markdown
---

*Sources: [Source Name](url), [Source Name](url), ...*
```

If sources are from personal data/experience:

```markdown
---

*Data from [description of data source and timeframe].*
```

---

## Filename Conventions

- Lowercase, hyphenated slug: `mcp-vs-cli.md`, `session-hygiene.md`
- No dates in filenames (dates are in frontmatter)
- Descriptive but concise: 2-5 words
- Filename becomes URL path: `mcp-vs-cli.md` -> `/ai/mcp-vs-cli`

## Tag Conventions

- Lowercase, hyphenated: `claude-code`, `ai-tools`, `cost-optimization`
- Use existing tags when possible (check existing posts first)
- Aim for 3-5 tags per post
