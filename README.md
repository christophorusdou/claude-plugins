# claude-plugins

Personal Claude Code plugin marketplace.

## Plugins

| Plugin | Description |
|--------|-------------|
| [agent-teams](plugins/agent-teams/) | Automated agent team assembly and coordination |

## Installation

Register this marketplace, then install plugins:

```bash
# On any machine — one-time marketplace registration:
# Edit ~/.claude/plugins/known_marketplaces.json and add:
# "claude-plugins": {
#   "source": { "source": "github", "repo": "christophorusdou/claude-plugins" },
#   "installLocation": "<auto-populated>"
# }

# Then install plugins:
claude plugins install agent-teams@claude-plugins
```
