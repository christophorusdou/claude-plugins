# /sb

Second-brain notebook command. Usage:

- `/sb add [thought]` — capture to the inbox (triage later via /sb process); `/sb add --now` captures + processes in one sitting
- `/sb process` — pull unprocessed inbox captures, discuss each, dedup/link, promote, commit
- `/sb from-project <path>` — distill an existing repo/folder into a note (reverse direction)
- `/sb search <query>` — search the vault (INDEX first, then grep entries)
- `/sb tidy` — quick pass: regenerate INDEX.md, suggest links, flag stale seeds
- `/sb maintain` — comprehensive (~quarterly) curation: recategorize/taxonomy, tag cleanup, merge, split, obsolete stale entries, link+weight hygiene (propose → approve → one commit)
- `/sb status` — show pending inbox count + recent vault activity
- `/sb lint [topic]` — health-check: no topic = the **notebook** (schema, dead links, orphans, stale, clusters); `<topic>` = a research wiki

Research wikis (loop ② — you give a topic + sources, I synthesize):

- `/sb research <topic>` — scaffold a research wiki under `research/<topic>/`, linked from a notebook entry
- `/sb ingest <url|path> [--topic <slug>]` — read a source → summary page + revise concept/topic pages → log → commit
- `/sb ask <topic> "<question>"` — cited synthesis from the wiki; offer to file the answer back as a page
- `/sb lint <topic>` — health-check a wiki (contradictions / stale / orphans / missing pages / gaps)

## Behavior

Invoke the **second-brain** skill and follow its workflow. In short:

1. **add** — Capture to the inbox by default (`POST /capture`, `source: this-machine`); triage
   later with `/sb process`. Use `/sb add --now` to capture + process immediately (run it through
   the process steps). If the inbox is unreachable, fall back to `--now`.
2. **process** — `GET $SECOND_BRAIN_SERVICE_URL/pending`. For each item: claim it
   (`PATCH .../status {"status":"processing"}`), discuss, detect overlaps, decide (new/merge/
   link/skip), recommend project actions, then resolve (`processed`/`skipped`/`duplicate`/
   `failed`). One commit for the batch; clear the nudge cache afterward.
3. **from-project** — Read the target's README/CLAUDE.md/handoff/summary, distill into a
   `project-ref` entry, set `related-projects`, link overlaps.
4. **search** — Read `INDEX.md`, then grep `entries/`. Report ids/titles; offer to relate.
5. **tidy** — Run `scripts/generate-index.sh`; review links, categories, stale seeds.
6. **status** — `GET .../count` for pending; `git -C "$SECOND_BRAIN_VAULT" log --oneline -5`.
7. **lint** (no topic) — Run `node "$SECOND_BRAIN_VAULT/web/scripts/lint-vault.mjs"`; present the grouped
   report, then propose fixes (correct enums, drop/repoint dangling edges, connect an unlinked cluster, archive
   a stale seed with a dated Log reason) → approve → one commit. The script is report-only; never auto-push.

Always check the vault worktree is clean before mutating (see the skill). Never auto-push.

For `research`/`ingest`/`ask` and `lint <topic>`, follow the **Research wikis (loop ②)** section of the skill:
Chris supplies the topic + sources; you read and synthesize into the wiki, keep raw sources
immutable under `sources/raw/`, link the topic to its originating notebook idea (`researches`),
cite sources (`cites`), and promote durable convictions back to a notebook `finding`
(`derived-from`).

For `maintain`, follow the **Maintenance** section of the skill: load the whole vault, propose a
written curation plan (taxonomy/recategorize, tag cleanup, merge with inbound-link redirect, split,
obsolete→archived, dead-link + weight recompute), get approval, apply as one commit.

If no subcommand is given, show this help.
