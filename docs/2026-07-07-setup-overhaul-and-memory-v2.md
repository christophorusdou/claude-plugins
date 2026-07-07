# Claude Setup Overhaul & Memory Plugin v2 — 2026-07-07

Complete record of the setup-wide audit, the security/hygiene cleanup, and the
memory plugin rebuild (v1.3.0 → v2.0.2), including the post-rollout fixes.
Written as the reference for how the system works now.

---

## 1. Why

A full audit of the Claude Code setup (global `~/.claude`, the projects tree,
the work workspace, 3 marketplaces / 35 plugin installs, MCP servers, skills,
hooks) found:

1. **The 323-entry memory archive had no working backup.** Git sync existed in
   code but had never run (only `.gitignore` was ever committed); 2.4 MB of
   writes since June 18 sat solely in an uncheckpointed WAL because Claude Code
   SIGKILLs MCP servers, so v1's close-time checkpoint never executed.
2. **A real multi-session race.** Each session's MCP server held its own Orama
   index and rewrote `search-index.json` (4.1 MB) whole on every store —
   last-writer-wins, silently making other sessions' new memories
   unrecallable. Architectural, not patchable.
3. **Config hygiene debt.** Three hardcoded credentials inside permission
   allow rules, dead over-escaped rules, project-specific one-offs baked into
   global scope, duplicate installs, three overlapping Atlassian integrations,
   version drift.

The rebuild direction came from studying hermes-agent's memory design
(`~/projects/third-party/hermes-agent`): lexical search is sufficient at this
scale, capture needs anti-poisoning rules, and durability must assume the
process dies without warning.

## 2. What was done

### Phase 0 — Data safety (before anything else)
- `wal_checkpoint(FULL)` folded 595 WAL frames into `memory.db`.
- Dated `VACUUM INTO` backup + scratchpad copy; row count verified (323).
- First-ever export of `memories.jsonl` (323 lines), committed and pushed to
  forgejo `chris/claude-memory`.

### Phase 1 — Security & permission hygiene
Removed from live settings (dated `.bak-20260707` rollback copies kept beside
each file; **delete those after rotating, they contain the old secrets**):
- `claude_dash` Postgres password in a `projects/.claude/settings.local.json` allow rule → **rotate**
- Wood-Mizer SQL Server password (`qlik` user, `root.woodmizer.indy`) in `wm/.claude/settings.local.json` → **rotate**
- Forgejo API token (`81246d0f…`) in the same file → **rotate**
- Standing auto-allows for `diskutil eraseDisk *`, `security dump-keychain *`, `Read(~/.ssh/**)`
- Dead over-escaped rules and one-off session artifacts everywhere:
  global allow-list 63→19 rules, wm 114→53, work 100→81, projects 137→120.
  Every wm-specific rule deleted from global already existed in wm's own scope.

### Phase 2 — Memory v2 rebuild (see §3 for how it works now)

### Phase 3 — Dedupe & MCP consolidation
- Single `agent-teams` install remains (`@chris-plugins`; the dormant official
  duplicate removed — note: `claude plugin uninstall` resolves by plugin NAME,
  which first removed the wrong one; verify `installed_plugins.json` after any
  uninstall involving cross-marketplace duplicates).
- Duplicate `playwright-cli` skill removed from projects scope (global kept).
- Atlassian consolidated: `atlassian@claude-plugins-official` disabled;
  the work-scoped `work/.mcp.json` server is the single CLI integration
  (claude.ai connectors are account-side and unaffected).
- `trading/.mcp.json` left in place (defined but never enabled — delete if dead).

### Phase 4 — Docs, versions, stale artifacts
- Repo `CLAUDE.md` inventory corrected (added work-assistant-claude,
  second-brain; session-learnings retired).
- `marketplace.json` versions reconciled with each `plugin.json`.
- Deleted `~/.claude/{statusline.sh.bak, claude-usage.bak,
  superclaude-backup-20260213.tar.gz}` and the empty nested `~/.claude/.claude/`.

### Retired: session-learnings plugin
Absorbed into the memory plugin. Its Stop hook wrote to the archive when the
MCP was up but silently fell back to built-in MEMORY.md otherwise — the same
learning landed in different stores non-deterministically. The pipeline now
lives at `plugins/memory/hooks/stop-capture.sh` + the `capture-learnings`
skill, and any fallback is **loud** (the user is told).

### Post-rollout fixes
- **2.0.1 — cwd scoping bug.** `start.sh` cd'd into `server/` before exec, so
  the MCP server's `process.cwd()` was always the plugin dir and project
  auto-detection scoped every store to "memory-server" (267/326 rows; v1 had
  this its entire life — unnoticed because recall was mis-scoped identically).
  `start.sh` now exports `MEMORY_SESSION_CWD` before the cd;
  `getDetectedProject()` prefers it and hard-guards the "memory-server" name.
  The 267 rows were rescoped to global (zero content-hash collisions),
  journaled as `op:rescope`.
- **2.0.2 — frequent git sync.** See §3.5.

## 3. How memory v2 works now

### 3.1 Storage — one SQLite database
`~/.claude-memory/memory.db` (WAL; schema v7). `memories` +
`memory_events` + `memories_fts` — an FTS5 external-content table over
content/tags/triggers, maintained by three SQL triggers **inside every writing
transaction**. There is no separate index artifact: concurrent sessions are
ordinary concurrent SQLite writers, and the index can neither race nor drift.
`sync: reindex` exists only for corruption recovery. Two parallel processes ×
50 interleaved writes each were verified lossless.

Durability assumes SIGKILL: `wal_autocheckpoint=200` plus an explicit passive
checkpoint after every write keeps `memory.db` current; nothing depends on
shutdown handlers. `MEMORY_DATA_DIR` overrides the data dir (tests/migration
rehearsal).

### 3.2 Write path
`memory_store` → 5,000-char cap → **threat scan** (memory is an injection
surface: instruction-override, curl-pipe-shell, base64 blobs, remote-image
exfil, ANSI escapes are rejected; the same scan masks content as `[BLOCKED:…]`
at render time for rows that predate a rule) → exact-dup check (content hash +
scope) → **near-dup gate** (FTS top-5 candidates judged by Jaccard ≥ 0.55 or
containment ≥ 0.8; `allow_similar: true` overrides) → insert + `created` event
in one transaction → journal append → checkpoint → sync scheduling.

### 3.3 Read path
- **`memory_recall`**: BM25 over an OR-of-phrases MATCH (12 terms max,
  stopworded; LIKE fallback), two-pass project+global when the project is
  auto-detected, relevance normalized across the merged candidate set, then
  `(0.6·rel + 0.15·effectiveRank + 0.15·scopeBoost + 0.20·triggerBoost) ×
  freshness × lifecycle`. Conflict suppression drops a global entry when a
  same-category project entry is equally relevant. Results truncate at 600
  chars (`get` for full text). Recall increments `use_count`.
- **SessionStart injection**: top-5 project + top-3 global, **active
  lifecycle only**, ranked by the same `rank.ts` module recall uses, 200
  chars/entry, ~2,000-char budget. Injection bumps `last_used_at` and logs an
  `injected` event but does **not** increment `use_count` — so aging can't
  bury an injected entry, and unconditional injection can't inflate ranking.

### 3.4 Lifecycle (runs by itself now)
SessionEnd maintenance runs aging on a ~7-day cadence: active→stale for
expired or >90-days-untouched-and-never-retrieved entries; stale→archived
after 180 days. Reversible: recall reactivates stale; upvote reactivates
anything. Downvotes demote (score ≤ −2 stale, ≤ −4 archived) instead of v1's
permanent `valid_until` stamp (migration 7 reversed those precisely).
Consolidation stays LLM-judgment via `/mem curate`; the SessionStart nudge
only fires when curation is overdue AND duplicate groups actually exist.

### 3.5 Version control of memories (the durability answer)
Three git-tracked artifacts in `~/.claude-memory` (remote: forgejo
`chris/claude-memory`):
- `journal.jsonl` — append-only, one self-contained JSON line per mutation,
  written synchronously after each committed transaction
- `memories.jsonl` — full snapshot, regenerated at each sync
- `curation-log.jsonl` — age/merge/delete provenance ledger

**Sync triggers (since 2.0.2):**
| Trigger | Mechanism |
|---|---|
| Every write | `maybeScheduleSync()` — at most once per **15 min** (`MEMORY_SYNC_INTERVAL_MIN` to tune, `0` = every write) spawns a detached `cli.js sync` |
| Session start | Same scheduler — ships a crashed session's unpushed writes |
| Session end | `cli.js maintain` (aging + WAL truncate + sync) |
| Manual | `memory_manage action:"sync" operation:"push"` or `node server/dist/cli.js sync` |

Each sync: snapshot → `git add` → commit if dirty → **detached push whenever
local commits aren't on the remote** (checked via `rev-list @{u}..HEAD`).
Concurrency is guarded by a `mkdir` lock (stale after 5 min). Push results
land in `sync-status.json`; a failure is announced at the next SessionStart.
Long-running sessions therefore push roughly every 15 minutes of active
memory use — the worst case for data-at-risk is one debounce window.

### 3.6 Capture (absorbed from session-learnings)
Stop hook (`stop-capture.sh`): substantive sessions (≥5 tool uses, once per
session) block once and prompt the `capture-learnings` skill. Rules (hermes
ports): **declarative facts, never imperatives**; never capture
environment-dependent failures, negative tool claims, or transient errors;
≤5 learnings/session; near-duplicate → update/upvote existing; 3-failure
thrash cap. Routing: user/project preferences → built-in memory
(authoritative); cross-project technical insights → `memory_store`. Fallback
to built-in memory is deterministic and announced — never silent.

### 3.7 Authority model (unchanged)
Built-in auto-memory (`~/.claude/projects/<slug>/memory/`) wins on conflict;
the archive is the cross-project data lake. `/mem curate` diffs the two and
downvotes contradicting archive entries. Full double-write into MEMORY.md was
considered and rejected: it floods the curated store and creates the very
divergence it tries to prevent — journal + auto-sync is the safety net.

## 4. Operations runbook

```bash
# Health check (schema, row/FTS consistency, journal coverage, golden queries)
node <plugin>/server/dist/cli.js verify

# Sync now / inspect last background push
node <plugin>/server/dist/cli.js sync
/mem sync status

# Archive stats (lifecycle distribution, per-project counts)
/mem stats

# Disaster recovery (memory.db lost)
git clone forgejo-git:chris/claude-memory.git ~/.claude-memory
# start any session — the server rebuilds schema; then import the snapshot:
/mem import ~/.claude-memory/memories.jsonl   # idempotent by hash+scope
```

Verified baselines (2026-07-07): schema 7; 326 entries = FTS rows; MCP
initialize round-trip 0.10 s; 15 vitest tests green; concurrency test
100/100; detached push confirmed on forgejo.

## 5. Outstanding items

- **Rotate**: `claude_dash` Postgres password, `qlik` SQL Server password,
  Forgejo token `81246d0f…` — then delete the `.bak-20260707` settings files.
- `work/.mcp.json` github server silently fails without `$GITHUB_TOKEN` exported.
- `trading/.mcp.json` defined but never enabled — delete if dead.
- `cleanupPeriodDays: 3650` keeps transcripts ~forever (deliberate?).
- Startup-latency follow-ups if wanted: project-awareness SessionStart scan;
  homelab-context's two PostToolUse scripts on every Edit/Write.
