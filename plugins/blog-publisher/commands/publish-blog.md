---
name: publish-blog
description: Write and publish a blog post to blog.cdrift.com from any repo
argument-hint: "[idea|draft|review|deploy]"
---

# /publish-blog -- Blog Publishing Workflow

Write, review, and publish blog posts to blog.cdrift.com. Works from any repo.

## Modes

### `idea` (default)

Full guided workflow. Invokes the `blog-writing` skill to execute the complete process:
1. Discover what to write about from the current repo context
2. Propose topic, category, and angle
3. Write the post with correct frontmatter and style
4. Create the .md file in the blog repo
5. Build and verify
6. Commit and deploy

**Usage:** `/publish-blog` or `/publish-blog idea`

### `draft`

Write a post from a specific topic the user provides. Skips the discovery phase and goes straight to drafting.

**Usage:** `/publish-blog draft "Title or topic description"`

### `review`

Review an existing draft in the blog repo. Read the specified post, check frontmatter validity, check style adherence, suggest improvements.

**Usage:** `/publish-blog review <filename>` (e.g., `/publish-blog review mcp-vs-cli`)

### `deploy`

Skip writing entirely -- just build, verify, commit, and deploy the blog repo. Useful after manual edits.

**Usage:** `/publish-blog deploy`

## Behavior

For `idea` and `draft` modes:
- Invoke the `blog-writing` skill with the appropriate scope
- The skill handles the full workflow including writing, file creation, build verification, and deployment

For `review` mode:
1. Read the specified post from `~/projects/blog/src/content/blog/`
2. Read the style guide from this plugin's `references/style-guide.md`
3. Read the schema from this plugin's `references/frontmatter-schema.md`
4. Validate frontmatter against the schema
5. Check writing against the style guide
6. Present a review with specific suggestions
7. If the user approves changes, apply them and rebuild

For `deploy` mode:
1. Run `cd ~/projects/blog && pnpm build` to verify the site builds
2. Show any build errors and fix if possible
3. Stage and commit blog content changes: `cd ~/projects/blog && git add src/content/blog/ && git commit -m "publish: <summary>"`
4. Push to trigger CI: `cd ~/projects/blog && git push`
5. If no remote is configured, deploy manually: `cd ~/projects/blog && npx wrangler pages deploy dist/ --project-name=news-cdrift-com`
