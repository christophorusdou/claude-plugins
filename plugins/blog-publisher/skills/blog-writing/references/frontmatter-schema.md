# Blog Frontmatter Schema Reference

Source of truth: `~/projects/blog/src/content.config.ts`

## Schema

```typescript
schema: z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  category: z.enum(['ai', 'news', 'tips', 'homelab', 'opportunities', 'intelligence']),
  tags: z.array(z.string()).default([]),
  readTime: z.number().optional(),
  sourceUrl: z.string().url().optional(),
  unlisted: z.boolean().default(false),
})
```

## Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Post title. Wrap in quotes (may contain colons). |
| `description` | string | Yes | 1-2 sentence summary for RSS/meta/cards. Wrap in quotes. |
| `pubDate` | date | Yes | Publication date as `YYYY-MM-DD`. |
| `updatedDate` | date | No | Last update date. Use when substantially revising. |
| `category` | enum | Yes | One of: `ai`, `news`, `tips`, `homelab`, `opportunities`, `intelligence`. Drives URL. |
| `tags` | string[] | No | Array of lowercase hyphenated tags. Defaults to `[]`. |
| `readTime` | number | No | Estimated minutes. Calculate as word count / 250. |
| `sourceUrl` | URL | No | For news posts: URL of the original source. Must be valid URL. |
| `unlisted` | boolean | No | Defaults to `false`. When `true`, post is built (direct URL works) but hidden from all listings, RSS, sitemap, and search. Viewable at the secret preview page. |

## Category -> URL Mapping

| Category | URL Pattern | Listed | Content Type |
|----------|------------|--------|--------------|
| `ai` | `/ai/<slug>` | Yes | AI analysis and commentary |
| `news` | `/news/<slug>` | Yes | Curated news with commentary |
| `tips` | `/tips/<slug>` | Yes | Practical how-tos and guides |
| `homelab` | `/homelab/<slug>` | Yes | Homelab and infrastructure |
| `opportunities` | `/opportunities/<slug>` | No | Opportunity analysis (always unlisted) |
| `intelligence` | `/intelligence/<slug>` | No | Radar intelligence digests and deep-dives (always unlisted) |

**Note:** `opportunities` posts are excluded from homepage and RSS by category filter. They should also have `unlisted: true` so they appear on the preview page.

## Example Frontmatter

### AI Analysis
```yaml
---
title: "MCP vs CLI: The Data Behind the Debate"
description: "55K tokens vs 200. Perplexity dropped MCP. Here's what the benchmarks actually show."
pubDate: 2026-03-22
category: "ai"
tags: ["mcp", "cli", "ai-tools", "architecture"]
readTime: 8
---
```

### News
```yaml
---
title: "Perplexity Drops MCP Support: What It Means"
description: "Internal testing showed 15-20x more tokens with no quality gain. The decision signals a broader reckoning."
pubDate: 2026-03-22
category: "news"
tags: ["mcp", "perplexity", "ai-tools"]
readTime: 4
sourceUrl: "https://example.com/perplexity-drops-mcp"
---
```

### Tips
```yaml
---
title: "Session Hygiene: Stop Burning Money on Runaway Context"
description: "24 of 111 sessions exceeded $50. Here's the compounding cost problem and 5 strategies to fix it."
pubDate: 2026-03-22
category: "tips"
tags: ["claude-code", "cost-optimization", "session-management"]
readTime: 6
---
```

### Homelab
```yaml
---
title: "Running 15 Containers on 6 Watts: The N100 Docker Host"
description: "A year of running a full-stack homelab on an Intel N100 mini PC."
pubDate: 2026-03-22
category: "homelab"
tags: ["docker", "n100", "self-hosting", "infrastructure"]
readTime: 8
---
```

### Unlisted / Opportunity Post
```yaml
---
title: "5 AI/ML Opportunities We Found by Letting LLMs Scan the Internet"
description: "Results from our first AI/ML opportunity scan pipeline."
pubDate: 2026-03-22
category: "opportunities"
tags: ["ai", "opportunities", "llm"]
readTime: 7
unlisted: true
---
```

### Intelligence Radar Digest
```yaml
---
title: "AI Tools & Agents Radar: March 24, 2026"
description: "SQL Server 2025 ships native AI building blocks, HART generates images 9x faster locally, and 4 more findings from scanning Reddit and HN."
pubDate: 2026-03-24
category: "intelligence"
tags: ["ai-tools", "radar", "digest", "news", "tools"]
readTime: 5
unlisted: true
---
```

## Unlisted Posts

Posts with `unlisted: true` are:
- **Built** — direct URL works (e.g., `blog.cdrift.com/opportunities/ai-ml-opportunities-march-2026`)
- **Hidden** from homepage, category pages, tag pages, RSS feed, sitemap, and Pagefind search
- **Visible** on the secret preview page at `blog.cdrift.com/preview-8bbac21f/`

Use `unlisted: true` for:
- Draft posts shared for review before publishing
- Opportunity analysis posts (always unlisted)
- Intelligence radar digests and deep-dives (always unlisted)
- Any content that should be link-accessible but not publicly discoverable

To publish: remove `unlisted: true` (or set to `false`) and push.

## Validation Rules

1. `title` and `description` must be quoted in YAML (they may contain colons)
2. `pubDate` must be `YYYY-MM-DD` format
3. `category` must be exactly one of the 6 enum values (case-sensitive, quoted)
4. `tags` must be a YAML array: `["tag-one", "tag-two"]`
5. `readTime` is a bare integer (not quoted)
6. `sourceUrl` must include protocol (`https://...`)
7. `unlisted` is a bare boolean (`true` or `false`, not quoted)
