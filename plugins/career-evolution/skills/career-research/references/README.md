# Reference files have moved

Evolving reference files now live in the **project repo** at `~/projects/future/references/`:
- `research-sources.md` — search strategies and source effectiveness
- `analysis-framework.md` — career path analysis lens

This avoids plugin cache drift — the SKILL.md reads these from the project root (CWD), not from the plugin cache. The plugin only contains stable workflow logic.
