---
name: second-brain
description: >-
  Maintain Chris's personal notebook (ideas, learnings, findings) in the second-brain vault.
  Use when capturing a thought, processing the inbox (/sb process), distilling a project into a
  note (/sb from-project), searching the vault, or whenever a discussion clearly matured into
  something worth keeping. Surfaces overlapping notes and recommends concrete project actions.
effort: medium
---

# Second Brain

A personal **capture → process → vault** notebook. This is Chris's own knowledge — ideas, things
learned, things found — that he wants to keep, connect, and turn into action.

## Role & boundaries

- **This is NOT the `memory` plugin.** The `memory` plugin stores *Claude's* coding
  patterns/gotchas for cross-project recall and explicitly forbids storing user ideas. This
  plugin is the opposite: it stores *Chris's* ideas/learnings/findings as a readable notebook.
- The vault is the **durable** store (Markdown + git). The **inbox service** is a transient
  capture queue. Knowledge lives in files; only the queue is a service.

## Configuration (env, with defaults)

- `SECOND_BRAIN_VAULT` — vault repo path (default `/Volumes/d50-970p-1t/projects/second-brain`)
- `SECOND_BRAIN_SERVICE_URL` — inbox base URL (default `http://192.168.130.160:8095`)
- `SECOND_BRAIN_TOKEN` — bearer token (from Keychain/env; never hardcode)

Call these `$VAULT`, `$SVC`, `$TOK` below. Inbox calls always send `Authorization: Bearer $TOK`.

## Before mutating the vault (always)

1. Vault must be a clean git worktree. Run `git -C "$VAULT" status --porcelain`. If dirty,
   show the user what's uncommitted and ask whether to proceed or commit/stash first. Never
   silently mutate on top of unrelated changes.
2. Load `$VAULT/INDEX.md` into context. It is the whole-notebook summary you reason over to find
   overlaps. If it looks stale, regenerate: `bash "$VAULT/scripts/generate-index.sh"`.

## Capturing (`/sb add`)

You are on the main machine, so prefer to **discuss first, then fast-track to a vault entry** —
don't round-trip through the inbox. The inbox is for capture from *other* devices.

1. Discuss the thought enough to know its `type` (idea/learning/finding), a good `title`, and a
   stable kebab `id`.
2. Apply the **maturity gate**: if it's still half-formed, keep shaping it or save it as
   `status: seed` and stop — don't over-promote.
3. Check `INDEX.md` for overlaps (see below) before creating a new file.
4. Write the entry, link it, regenerate the index, commit (see Promotion + Git).

## Processing the inbox (`/sb process`)

This is the core loop. Items captured from anywhere are waiting; discuss and file them.

1. `GET $SVC/pending` → list of items (unprocessed + stale-`processing`).
2. For **each** item, one at a time:
   a. **Claim it:** `PATCH $SVC/{id}/status {"status":"processing"}` (bumps attempt_count,
      stamps claimed_at — so a crash doesn't lose it).
   b. **Discuss** with Chris. For `project-ref` items, read the referenced repo/summary first.
   c. **Detect overlaps** against `INDEX.md` (see below). Decide together:
      - **New entry** — distinct enough to stand alone.
      - **Merge** — fold into an existing entry (update it, append to its `## Log`).
      - **Link only** — related but separate; add `[[links]]` both ways.
      - **Skip/duplicate** — not worth keeping, or already captured.
   d. **Recommend actions** (see below).
   e. **Resolve the item:**
      - promoted/merged → `PATCH {"status":"processed","vault_entry_id":"<id>"}`
      - dropped → `PATCH {"status":"skipped"}` or `{"status":"duplicate"}`
      - couldn't complete → `PATCH {"status":"failed","error":"<why>"}` — **never leave it
        silently; a failed item keeps its error and can be retried later.**
3. After the batch: regenerate the index, make **one commit** for the whole batch, invalidate the
   nudge cache: `rm -f "$HOME/.claude/cache/second-brain-count.cache"`.

## Overlap / combine detection (the killer feature)

Before creating anything, reason over `INDEX.md` (the whole notebook fits in context at this
scale — use that). Surface to Chris:

- entries on the **same topic** (candidates to merge),
- entries that **combine** with the new one to enable something neither does alone,
- entries worth **linking** for context.

Quote the specific `id`s and titles. Don't just say "this is similar" — say *how* they relate and
what it unlocks.

## Linking conventions

The graph is only useful if edges carry meaning. **Do not link by shared topic.** If you can't
name the specific relationship, don't add the edge — a fully-connected graph carries zero info.

- `links:` is a list of typed, **directional** edges `{to, rel}`, authored **once on the source**
  (the entry the relationship originates from). The inbound side (backlinks) is **derived** in
  code — never duplicate the reverse edge.
- Relations: `instance-of` (A is a concrete case of principle B), `extracted-from` (A is a
  learning pulled out of building B), `parallels` (A independently arrives at / resembles B),
  `extends` (A builds on B), `contradicts` (A challenges B), `depends-on` (A requires B),
  `relates-to` (generic — discouraged; last resort).
- Direction convention: the edge points from the dependent/specific note to the thing it draws on
  (e.g. an instance → its principle; a learning → the system it came from).
- In the body, still reference notes with `[[other-id]]` for reading.
- When processing, prefer **fewer, load-bearing** edges. Before adding one, ask: "would I navigate
  from here to there *for this reason*?" If not, skip it.

## Action recommendations (the bridge to projects)

After filing, recommend concrete next steps against Chris's real catalog
(`/Volumes/d50-970p-1t/projects/CLAUDE.md`):

- **Start a project** — "this + `[[X]]` is enough to scaffold `~/projects/<new>`." Offer to do it.
- **Enhance a project** — "this applies to `~/projects/<existing>` — here's the change." 
- Record the chosen project in the entry's `related-projects`. When an entry leads to real work,
  bump its `status` to `acted`.

## Reverse: distill a project (`/sb from-project <path>`)

1. Read the project's `README.md`, `CLAUDE.md`, and any `handoff*.md` / `summary.md`.
2. Distill into a `type: project-ref` entry: what it is, why it matters, key decisions/learnings.
3. Set `related-projects: [<that project>]`, link overlapping notes, write it like any entry.

## Searching (`/sb search <query>`)

Read `INDEX.md` first (fast, whole-notebook). For depth, grep `$VAULT/entries/`. Report matching
ids/titles and offer to open or relate them.

## Tidy (`/sb tidy`)

`bash "$VAULT/scripts/generate-index.sh"`, then review: suggest missing links, re-categorize
loosely-tagged entries, and flag stale `seed`s (old and never developed) for archive/promote.

## Research wikis — loop ② (`/sb research | ingest | ask | lint`)

Two loops. The **notebook** (`entries/`) holds *your own* ideas (loop ①, above). A **research
wiki** (`$VAULT/research/<topic>/`) is loop ②: **Chris supplies a topic + external sources; YOU
read and synthesize them.** He curates and steers (topic, sources, questions, corrections); you do
the grunt work — read each source, write its summary, build and *revise* the concept/topic pages,
flag contradictions, keep cross-references current. The emergent understanding lives in the wiki;
distilled convictions promote back to the notebook as `finding`s.

**Raw sources are immutable.** Save the fetched original to `sources/raw/<slug>.md` and never edit
it. Everything else under `research/<topic>/` is yours to write. Page types: `source` (summary of
one raw source; frontmatter `url` + `ingested`), `concept` (evolving synthesis), `topic`
(`_topic.md` overview/thesis). All research pages set `topic: <slug>`.

### `/sb research <topic>`
Scaffold `$VAULT/research/<slug>/` with `_topic.md` (type: topic), `sources/raw/`, `concepts/`,
and `log.md`. Then seed it: from the originating notebook entry, add a `researches` edge to the
topic (e.g. `[[llm-wiki-pattern]]` researches `[[<topic-id>]]`). Commit.

### `/sb ingest <url|path> [--topic <slug>]`
The compounding core — for each source, one at a time:
1. **Fetch/read:** a URL via WebFetch; a local file via Read (PDFs via the `pages` param).
2. **Save raw (immutable):** write the captured text to `sources/raw/<slug>.md` with `url` and the
   fetched date. Never edit it again.
3. **Discuss** the key takeaways with Chris.
4. **Summarize:** write the `source` summary page `sources/<slug>.md` (`cites` nothing; concepts
   cite *it*).
5. **Integrate:** create or **revise** `concept` pages — fold in the new information, and where it
   **contradicts** an existing page, flag it explicitly (a `contradicts` edge or a note). Update
   `_topic.md`'s thesis if the synthesis shifted. Concept/topic pages link to the source with
   `cites`.
6. **Log + commit:** append `## [YYYY-MM-DD] ingest | <title>` to `log.md`, regenerate the index,
   one commit. A single source typically touches several pages.

### `/sb ask <topic> "<question>"`
Read the topic's pages (index/`_topic.md`/concepts) and synthesize a **cited** answer. If it's
worth keeping, **offer to file it back** as a new `concept` page so explorations compound rather
than vanish into chat.

### `/sb lint <topic>`
Health-check the wiki: contradictions between pages, stale claims superseded by newer sources,
orphan pages (no inbound links), concepts mentioned but lacking their own page, missing
cross-references, and gaps worth a web search. Propose fixes + next questions/sources.

### Promote back to the notebook
When research yields a durable conviction ("after these sources, I now hold X"), write it as a
notebook `finding` in `entries/` with a `derived-from` edge to the topic (or a key source). This is
how loop ② feeds loop ①.

## Entry format & Git

- Frontmatter schema is in `$VAULT/CLAUDE.md` (schema_version 1). Set `source` and
  `source_inbox_id` (the inbox id, or null for local captures). `created`/`updated` are dates.
- Every entry carries a `## Log` with dated lines recording how the thought evolved.
- **Git:** one commit per accepted batch (`/sb add` = one entry = one commit; `/sb process` = one
  commit for the batch). Message like `vault: <what changed>`. **Never auto-push** — leave that to
  Chris unless he asks.
