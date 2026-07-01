# Claude Plugins

Personal Claude Code plugin marketplace — custom plugins for development workflows, infrastructure management, and cross-project awareness.

## Plugin Inventory

| Plugin | Description | Components |
|--------|-------------|------------|
| project-awareness | Auto-generates project catalog on session start | hooks |
| homelab-context | Homelab infrastructure knowledge and deployment | skills, commands, agents, hooks |
| memory | Cross-project semantic memory with search | MCP server, skills, commands, hooks |
| agent-teams | Automated agent team assembly and coordination | skills, commands |
| ai-efficiency-advisor | AI usage analysis, feature discovery, improvement tracking | agents, skills, commands, hooks |
| career-evolution | Career research, trend tracking, decision support | skills, commands, hooks |
| bedrock-oidc-auth | AWS Bedrock authentication via OIDC SSO | skills |
| blog-publisher | Blog post creation and deployment | skills, commands |
| session-learnings | Capture non-obvious session insights | skills, commands, hooks |

## Plugin Structure

```
plugins/<name>/
  .claude-plugin/
    plugin.json          — Required manifest (name, description, version)
  hooks/
    hooks.json           — Event hooks (SessionStart, PreToolUse, Stop, etc.)
    *.sh                 — Hook scripts
  skills/
    <skill-name>/
      SKILL.md           — Skill definition (loaded when triggered)
      references/        — Supporting docs
  commands/
    <command>.md         — Slash commands
  agents/
    <agent>.md           — Specialized subagents
  .mcp.json              — MCP server config (optional)
```

## How Plugins Load

1. Marketplace registered in `~/.claude/settings.json` under `extraKnownMarketplaces`
2. Each plugin toggled in `enabledPlugins` (e.g., `"homelab-context@chris-plugins": true`)
3. On session start: hooks fire, skills register, commands become available

## Adding a New Plugin

1. Create `plugins/<name>/.claude-plugin/plugin.json` with name, description, version
2. Add components (hooks, skills, commands, agents) following the structure above
3. The marketplace auto-discovers plugins in the `plugins/` directory
4. Enable in settings: `"<name>@chris-plugins": true`

## Related Data Repos

| Repo | Path | Plugin |
|------|------|--------|
| homelab | `~/projects/homelab` | homelab-context |
| ai-efficiency | `/Volumes/d50-970p-1t/projects/ai-efficiency` | ai-efficiency-advisor |
| future | `~/projects/future` | career-evolution |
