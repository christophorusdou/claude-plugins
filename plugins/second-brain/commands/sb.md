# /sb

Second-brain notebook command. Usage:

- `/sb add [thought]` — capture an idea/learning/finding from this machine (discuss, then file)
- `/sb process` — pull unprocessed inbox captures, discuss each, dedup/link, promote, commit
- `/sb from-project <path>` — distill an existing repo/folder into a note (reverse direction)
- `/sb search <query>` — search the vault (INDEX first, then grep entries)
- `/sb tidy` — regenerate INDEX.md, suggest links, flag stale seeds
- `/sb status` — show pending inbox count + recent vault activity

## Behavior

Invoke the **second-brain** skill and follow its workflow. In short:

1. **add** — Discuss the thought, apply the maturity gate, check `INDEX.md` for overlaps, then
   write/link a vault entry and commit. Prefer fast-tracking to the vault over the inbox (you're
   already here to discuss).
2. **process** — `GET $SECOND_BRAIN_SERVICE_URL/pending`. For each item: claim it
   (`PATCH .../status {"status":"processing"}`), discuss, detect overlaps, decide (new/merge/
   link/skip), recommend project actions, then resolve (`processed`/`skipped`/`duplicate`/
   `failed`). One commit for the batch; clear the nudge cache afterward.
3. **from-project** — Read the target's README/CLAUDE.md/handoff/summary, distill into a
   `project-ref` entry, set `related-projects`, link overlaps.
4. **search** — Read `INDEX.md`, then grep `entries/`. Report ids/titles; offer to relate.
5. **tidy** — Run `scripts/generate-index.sh`; review links, categories, stale seeds.
6. **status** — `GET .../count` for pending; `git -C "$SECOND_BRAIN_VAULT" log --oneline -5`.

Always check the vault worktree is clean before mutating (see the skill). Never auto-push.

If no subcommand is given, show this help.
