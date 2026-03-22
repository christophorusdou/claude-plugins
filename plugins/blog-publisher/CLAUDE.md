# Blog Publisher Plugin

Claude Code plugin for writing and publishing blog posts to blog.cdrift.com from any repo.

## Target Blog Repo

- **Path:** `~/projects/blog/` (symlink to `/Volumes/d50-970p-1t/projects/blog/`)
- **Domain:** blog.cdrift.com
- **Framework:** Astro 5 with content collections
- **Hosting:** Cloudflare Pages (free, zero backend)
- **Posts directory:** `~/projects/blog/src/content/blog/`

## Structure

```
commands/
  publish-blog.md        -- /publish-blog [idea|draft|review|deploy]
skills/
  blog-writing/
    SKILL.md             -- Full 6-phase publishing workflow
    references/
      style-guide.md     -- Writing conventions, voice, tone, structure
      frontmatter-schema.md -- Exact Zod schema with examples
      post-examples.md   -- Annotated excerpts as style anchors
```

## Deploy Paths

- **CI (preferred):** `git push` to Forgejo triggers Actions which builds and deploys
- **Manual:** `cd ~/projects/blog && pnpm build && npx wrangler pages deploy dist/ --project-name=news-cdrift-com`

## Source Repos

This plugin is designed to be invoked from any repo. Primary content sources:
- `~/projects/future/` -- career evolution research (analysis posts)
- `~/projects/ai-efficiency/` -- AI efficiency insights (tips posts)
- `~/projects/opportunity-radar/` -- opportunity analysis (ai posts)
- `~/projects/homelab/` -- infrastructure knowledge (homelab posts)
- `~/projects/claude-plugins/` -- plugin development insights (tips posts)

## Related Projects

- `~/projects/blog/` -- the blog repo (Astro 5, Cloudflare Pages)
- `~/projects/claude-plugins/` -- this plugin's home repo
