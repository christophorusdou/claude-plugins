# Claude Code Feature Catalog

Reference catalog of Claude Code features relevant to efficiency. For **live adoption tracking**, see the canonical source at `/Volumes/d50-970p-1t/projects/ai-efficiency/data/feature-adoption.json`.

| Feature | Setting/Evidence | Notes |
|---------|-------|---------|-----------------|-------|
| Voice mode (/voice) | voiceEnabled in settings.json | Hands-free prompting. 20 STT languages, rebindable push-to-talk. Good for brainstorming. |
| Model selection (Sonnet/Haiku) | Check model mix in stats-cache | Sonnet handles simple tasks at ~1/5 the cost. Use for commits, quick edits, lookups. |
| Plan mode | Check history.jsonl for plan mode usage | Structure complex work before coding. |
| Parallel/background agents | Agent tool with run_in_background | Run independent tasks simultaneously. |
| Git worktrees | superpowers:using-git-worktrees skill | Isolate feature work in separate worktrees. |
| Hooks (SessionStart, PreToolUse, PostToolUse, Stop) | hooks.json in plugins | Automated checks and context injection. |
| Skills system | skills/*/SKILL.md in plugins | Custom capabilities for specialized workflows. |
| Plugin system | enabledPlugins in settings.json | Rich plugin ecosystem with marketplace. |
| MCP servers | .mcp.json files | External tool integrations (context7, playwright, greptile, etc.). |
| Fast mode (/fast) | Toggle in session | Same model with faster output. |
| Effort levels | effortLevel in settings.json | low/medium/high. Skills can override via effort frontmatter (v2.1.77+). |
| Custom statusline | statusLine in settings.json | Real-time display of model, context%, cost, tokens, lines. |
| Channels (--channels) | Startup flag | Push messages from external systems into sessions. Permission relay in v2.1.81. |
| /compact | Use in session | Manual context compression. Extends session life before hitting limits. |
| /clear | Use in session | Reset context completely. Start fresh within same session. |
| /loop | Use in session | Recurring task scheduling on intervals or cron (v2.1.71+). |
| Remote Control | claude remote-control | Bridge terminal to phone/web (research preview, may affect 1M context). |
| Image/PDF reading | Read tool on image/PDF files | Multimodal input for screenshots, diagrams, documents. |
| NotebookEdit | Use on .ipynb files | Direct Jupyter notebook cell manipulation. |
| AskUserQuestion | In commands/skills | Interactive multi-choice flows for user input. |
| WebSearch/WebFetch | In agents/commands | Web browsing for documentation and research. |
| Agent tool (subagents) | Agent tool with subagent_type | Dispatch specialized work to typed subagents. |
| CLAUDE_PLUGIN_DATA | ${CLAUDE_PLUGIN_DATA} variable | Persistent plugin data directory (v2.1.80+). |
| Rate limits in statusline | rate_limits field in statusline JSON | 5-hour and 7-day windows with used_percentage (v2.1.80+). |
| Effort frontmatter | effort: low/medium/high in skill frontmatter | Per-skill effort override (v2.1.77+). |

## Adoption Opportunities

Features with highest potential impact if adopted:
1. **Model selection** — Sonnet for simple tasks could reduce costs 20-40%
2. **Voice mode** — faster than typing for brainstorming and requirements
3. **Fast mode** — same model, faster output for straightforward tasks
4. **/compact** — extend session life before hitting context limits

---

*This is a static catalog of known features. Live adoption status is tracked in `/Volumes/d50-970p-1t/projects/ai-efficiency/data/feature-adoption.json` and updated by the check-in command. New features discovered by research-scout are added to both this catalog and the adoption tracker.*
