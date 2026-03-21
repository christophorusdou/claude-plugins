# Claude Code Feature Checklist

Track which features are known, adopted, and underused.

| Feature | Known | Adopted | Setting/Evidence | Notes |
|---------|-------|---------|-----------------|-------|
| Voice mode (/voice) | Yes | No | voiceEnabled: false | Hands-free prompting. Good for brainstorming, dictating requirements. |
| Model selection (Sonnet) | Yes | No | ~100% Opus usage | Sonnet handles simple tasks at ~1/5 the cost. Use for commits, quick edits, lookups. |
| Plan mode | Yes | Yes | Heavy usage in history | Plans-heavy workflow. Well adopted. |
| Parallel/background agents | Yes | Yes | Used via plugins | Run independent tasks simultaneously. |
| Git worktrees | Yes | Unknown | superpowers:using-git-worktrees | Isolate feature work in separate worktrees. |
| Hooks (SessionStart, etc.) | Yes | Yes | homelab-context, ai-efficiency | Automated checks and context injection. |
| Skills system | Yes | Yes | 20+ skills available | Custom capabilities for specialized workflows. |
| Plugin system | Yes | Yes | 20+ plugins enabled | Rich plugin ecosystem. |
| MCP servers | Yes | Yes | context7, playwright, greptile | External tool integrations. |
| Fast mode (/fast) | Yes | Unknown | Same Opus with faster output | Speeds up simple tasks. Toggle with /fast. |
| Effort levels | Yes | Yes | effortLevel: "high" | Consider "low" for simple tasks to reduce token usage. |
| Custom statusline | Yes | Yes | ~/.claude/statusline.sh | Rich monitoring with snapshot archival. |
| Channels | Yes | Unknown | Push messages into sessions | Two-way bridges to external systems (Telegram, Discord). |
| /compact | Yes | Unknown | Manual context compression | Reduces context size in long sessions. |
| /clear | Yes | Unknown | Reset context completely | Start fresh within same session. |
| Image/PDF reading | Yes | Unknown | Multimodal input | Read screenshots, PDFs, diagrams directly. |
| NotebookEdit | Yes | Unknown | Jupyter notebook editing | Direct notebook cell manipulation. |
| AskUserQuestion | Yes | Yes | Used in plugins | Interactive multi-choice flows. |
| WebSearch/WebFetch | Yes | Yes | Used in research | Web browsing for documentation and research. |
| Agent tool (subagents) | Yes | Yes | Multiple agent types | Dispatch specialized work to subagents. |

## Adoption Opportunities

Features with highest potential impact if adopted:
1. **Model selection** — Sonnet for simple tasks could reduce costs 20-40%
2. **Voice mode** — faster than typing for brainstorming and requirements
3. **Fast mode** — same model, faster output for straightforward tasks
4. **/compact** — extend session life before hitting context limits

---

*This checklist is updated by the research-scout agent during each check-in with newly discovered features.*
