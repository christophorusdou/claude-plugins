# claude-plugins

Personal Claude Code plugin marketplace — custom plugins for development workflows, infrastructure management, and cross-project awareness.

## Plugins

| Plugin | Description | Components |
|--------|-------------|------------|
| [project-awareness](plugins/project-awareness/) | Auto-generates project catalog on session start for cross-project awareness | hooks |
| [homelab-context](plugins/homelab-context/) | Homelab infrastructure knowledge, deployment commands, and architecture guidance | skills, commands, agents, hooks |
| [memory](plugins/memory/) | Cross-project semantic memory with search, voting, and git sync | MCP server, skills, commands, hooks |
| [agent-teams](plugins/agent-teams/) | Automated agent team assembly and coordination | skills, commands |
| [ai-efficiency-advisor](plugins/ai-efficiency-advisor/) | AI usage analysis, feature discovery, and improvement tracking | agents, skills, commands, hooks |
| [career-evolution](plugins/career-evolution/) | Career research, trend tracking, and strategic decision support | skills, commands, hooks |
| [bedrock-oidc-auth](plugins/bedrock-oidc-auth/) | AWS Bedrock authentication via OIDC SSO and Cognito | skills |

## How It Works

This repo is a **Claude Code plugin marketplace** — a directory of plugins that Claude Code can discover and load. Each plugin lives in `plugins/<name>/` with a `.claude-plugin/plugin.json` manifest.

### Plugin Anatomy

```
plugins/<name>/
  .claude-plugin/
    plugin.json          # Required — name, description, version
  hooks/
    hooks.json           # Event hooks (SessionStart, PreToolUse, etc.)
    *.sh                 # Hook scripts
  skills/
    <skill-name>/
      SKILL.md           # Skill definition (loaded when triggered)
      references/        # Supporting docs for the skill
  commands/
    <command>.md          # Slash commands (e.g., /deploy-stack)
  agents/
    <agent>.md            # Specialized subagents
  .mcp.json              # MCP server config (optional, used by memory plugin)
```

### How Plugins Get Loaded

1. The marketplace is registered in `~/.claude/settings.json` under `extraKnownMarketplaces`
2. Each plugin is enabled/disabled in `enabledPlugins` (e.g., `"homelab-context@chris-plugins": true`)
3. On session start, Claude Code loads all enabled plugins — hooks fire, skills become available, commands are registered

### Plugin Types

- **Hook-based** (project-awareness, homelab-context) — run shell scripts on events like session start or tool use
- **Skill-based** (bedrock-oidc-auth, agent-teams) — provide domain knowledge that Claude loads when relevant
- **Agent-based** (ai-efficiency-advisor, homelab-context) — specialized subagents for specific tasks
- **MCP-based** (memory) — full MCP server with tools, backed by a database

## Setup

### 1. Register the marketplace

The repo must be cloned locally. Add to `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "chris-plugins": {
      "source": {
        "source": "directory",
        "path": "/Users/chris/projects/claude-plugins"
      }
    }
  }
}
```

### 2. Enable plugins

Add plugins to the `enabledPlugins` section of `~/.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "project-awareness@chris-plugins": true,
    "homelab-context@chris-plugins": true,
    "memory@chris-plugins": true,
    "agent-teams@chris-plugins": true,
    "ai-efficiency-advisor@chris-plugins": true,
    "career-evolution@chris-plugins": true,
    "bedrock-oidc-auth@chris-plugins": true
  }
}
```

### 3. Verify

Start a new Claude Code session. Enabled plugins load automatically — hooks fire, skills appear in the skill list, and commands become available.

## Development

### Adding a new plugin

1. Create `plugins/<name>/.claude-plugin/plugin.json` with name, description, version, author
2. Add components as needed (hooks, skills, commands, agents)
3. Add the plugin to `.claude-plugin/marketplace.json`
4. Enable it in `~/.claude/settings.json`

### Testing hooks

Hook scripts can be tested standalone:

```bash
# SessionStart hooks
bash plugins/<name>/hooks/<script>.sh

# PreToolUse/PostToolUse hooks (expect JSON on stdin)
echo '{"tool_input":{"file_path":"test.yml"}}' | bash plugins/<name>/hooks/<script>.sh
```

## Repository Structure

```
claude-plugins/
  .claude-plugin/
    marketplace.json       # Marketplace manifest — lists all plugins
  plugins/
    agent-teams/
    ai-efficiency-advisor/
    bedrock-oidc-auth/
    career-evolution/
    homelab-context/
    memory/
    project-awareness/
  docs/
    plans/                 # Design docs and specs
```
