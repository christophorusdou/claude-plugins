# Blog Frontmatter Schema Reference

Source of truth: `~/projects/blog/src/content.config.ts`

## Schema

```typescript
schema: z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  category: z.enum(['ai', 'news', 'tips', 'homelab']),
  tags: z.array(z.string()).default([]),
  readTime: z.number().optional(),
  sourceUrl: z.string().url().optional(),
})
```

## Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Post title. Wrap in quotes (may contain colons). |
| `description` | string | Yes | 1-2 sentence summary for RSS/meta/cards. Wrap in quotes. |
| `pubDate` | date | Yes | Publication date as `YYYY-MM-DD`. |
| `updatedDate` | date | No | Last update date. Use when substantially revising. |
| `category` | enum | Yes | One of: `ai`, `news`, `tips`, `homelab`. Drives URL. |
| `tags` | string[] | No | Array of lowercase hyphenated tags. Defaults to `[]`. |
| `readTime` | number | No | Estimated minutes. Calculate as word count / 250. |
| `sourceUrl` | URL | No | For news posts: URL of the original source. Must be valid URL. |

## Category -> URL Mapping

| Category | URL Pattern | Content Type |
|----------|------------|--------------|
| `ai` | `/ai/<slug>` | AI analysis and commentary |
| `news` | `/news/<slug>` | Curated news with commentary |
| `tips` | `/tips/<slug>` | Practical how-tos and guides |
| `homelab` | `/homelab/<slug>` | Homelab and infrastructure |

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

## Validation Rules

1. `title` and `description` must be quoted in YAML (they may contain colons)
2. `pubDate` must be `YYYY-MM-DD` format
3. `category` must be exactly one of the 4 enum values (case-sensitive, quoted)
4. `tags` must be a YAML array: `["tag-one", "tag-two"]`
5. `readTime` is a bare integer (not quoted)
6. `sourceUrl` must include protocol (`https://...`)
