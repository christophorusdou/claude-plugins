# blog-publisher

Claude Code plugin for writing and publishing blog posts to [blog.cdrift.com](https://blog.cdrift.com) from any repository.

## What It Does

Provides a `/publish-blog` command that guides through the complete blog publishing workflow:

1. **Discover** -- finds publishable content in your current repo
2. **Draft** -- writes the post following the established style guide
3. **Validate** -- checks frontmatter schema and builds the site
4. **Deploy** -- commits and pushes to trigger CI, or deploys manually

## Usage

From any repo:

```
/publish-blog              # Full guided workflow (discover + write + deploy)
/publish-blog draft "..."  # Write about a specific topic
/publish-blog review <file> # Review an existing draft
/publish-blog deploy       # Build and deploy only
```

## Components

| Component | Purpose |
|-----------|---------|
| `commands/publish-blog.md` | Slash command with 4 modes |
| `skills/blog-writing/SKILL.md` | Full 6-phase writing workflow |
| `references/style-guide.md` | Voice, tone, structure conventions |
| `references/frontmatter-schema.md` | Exact Zod schema + examples |
| `references/post-examples.md` | Excerpts from existing posts as style anchors |

## Blog Repo

- **Path:** `~/projects/blog/`
- **Posts:** `~/projects/blog/src/content/blog/*.md`
- **Build:** `cd ~/projects/blog && pnpm build`
- **Deploy:** Push to main (Forgejo CI) or `npx wrangler pages deploy dist/`
