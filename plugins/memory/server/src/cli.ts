#!/usr/bin/env node
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDb, getDataDir, checkpoint, closeDb } from "./db.js";
import { getSchemaVersion, SCHEMA_VERSION } from "./schema.js";
import { detectProject } from "./detect.js";
import { selectForInjection } from "./rank.js";
import { renderSafe } from "./threat.js";
import { ensureJournalBootstrap, journalLineCount } from "./journal.js";
import { autoSync, readSyncStatus, maybeScheduleSync } from "./gitsync.js";
import { ageMemories } from "./tools/lifecycle.js";
import { findConsolidationGroups } from "./similarity.js";
import { recall } from "./retrieval.js";

/**
 * Hook/ops entry point. Hooks must never take the model down with them, so
 * session-start and maintain always exit 0; verify is the migration gate and
 * exits non-zero on inconsistency.
 */

const CURATE_NUDGE_DAYS = 14;
const CURATE_MIN_ENTRIES = 25;
const AUTO_AGE_DAYS = 7;

interface HookInput {
  cwd?: string;
  session_id?: string;
}

function readStdinJson(): HookInput {
  if (process.stdin.isTTY) return {};
  try {
    const raw = readFileSync(0, "utf-8");
    return raw.trim() ? (JSON.parse(raw) as HookInput) : {};
  } catch {
    return {};
  }
}

function emitSessionStart(context: string): void {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context,
      },
    })
  );
}

function daysSinceCuration(): number {
  try {
    const stamp = readFileSync(join(getDataDir(), "last-curation"), "utf-8").slice(0, 10);
    const ms = Date.now() - new Date(stamp).getTime();
    return Number.isFinite(ms) ? ms / 86400000 : Infinity;
  } catch {
    return Infinity;
  }
}

function cmdSessionStart(): void {
  const input = readStdinJson();
  const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();

  if (!existsSync(join(getDataDir(), "memory.db"))) {
    emitSessionStart(
      "Memory plugin active. No memories stored yet — use memory_store to save the first one."
    );
    return;
  }

  const db = getDb();
  const project = detectProject(cwd);
  const entries = selectForInjection(db, project);

  const parts: string[] = [];

  if (entries.length > 0) {
    const lines = entries.map((e) => {
      const scope = e.project ?? "global";
      return `- [${e.category}|${scope}|score:${e.score}] ${renderSafe(e.id, e.content)}`;
    });
    parts.push(
      `Relevant memories from the cross-project archive:\n${lines.join("\n")}\nUse memory_recall for deeper searches; memory_manage upvote/downvote to rate entries.`
    );
  } else {
    parts.push("Memory plugin active. Use memory_recall to search the archive.");
  }

  // Surface a failed background push — silent sync failure defeats the backup.
  const sync = readSyncStatus();
  if (sync?.status === "failed") {
    parts.push(
      `[memory] Last background git push FAILED at ${sync.ts}. Run memory_manage action:"sync" operation:"push" to retry and see the error.`
    );
  }

  // Consolidation nudge: only when overdue AND there is actually something to
  // consolidate (v1 nagged every session as soon as the archive grew).
  const count = (db.prepare("SELECT COUNT(*) AS c FROM memories").get() as { c: number }).c;
  if (count >= CURATE_MIN_ENTRIES && daysSinceCuration() >= CURATE_NUDGE_DAYS) {
    const groups = findConsolidationGroups(db, { limit: 1 });
    if (groups.length > 0) {
      const when = daysSinceCuration() === Infinity
        ? "never curated"
        : `last curated ${Math.floor(daysSinceCuration())} days ago`;
      parts.push(
        `[memory] ${count} entries, ${when}, and near-duplicate groups exist. Run /mem curate to consolidate.`
      );
    }
  }

  emitSessionStart(parts.join("\n\n"));

  // Catch-up: if a previous session crashed with unpushed writes (SessionEnd
  // never fired), this schedules a background sync now.
  maybeScheduleSync();
}

function cmdMaintain(): void {
  const db = getDb();
  ensureJournalBootstrap();

  // Cadence-gated aging: the curator finally runs without manual /mem curate.
  // ageMemories() itself refreshes the last-curation stamp + ledger.
  let ageMsg = "aging skipped (ran recently)";
  if (daysSinceCuration() >= AUTO_AGE_DAYS) {
    const r = ageMemories({});
    ageMsg = `aged ${r.to_stale.length}→stale, ${r.to_archived.length}→archived`;
  }

  checkpoint("TRUNCATE");
  const syncMsg = autoSync(); // snapshot + commit + debounced detached push
  console.error(`[memory maintain] ${ageMsg}; ${syncMsg}`);
  void db;
}

function cmdVerify(): void {
  const db = getDb();
  ensureJournalBootstrap();

  const version = getSchemaVersion(db);
  const memories = (db.prepare("SELECT COUNT(*) AS c FROM memories").get() as { c: number }).c;
  const fts = (db.prepare("SELECT COUNT(*) AS c FROM memories_fts").get() as { c: number }).c;
  const journal = journalLineCount();

  let walBytes = 0;
  try {
    walBytes = statSync(join(getDataDir(), "memory.db-wal")).size;
  } catch {
    /* no WAL file */
  }

  console.log(`data dir:        ${getDataDir()}`);
  console.log(`schema version:  ${version} (expected ${SCHEMA_VERSION})`);
  console.log(`memories:        ${memories}`);
  console.log(`fts rows:        ${fts} ${fts === memories ? "(match)" : "(MISMATCH)"}`);
  console.log(`journal lines:   ${journal}`);
  console.log(`wal bytes:       ${walBytes}`);

  const goldenQueries = [
    "sqlite wal checkpoint",
    "docker compose homelab deploy",
    "zitadel oidc pkce client secret",
  ];
  for (const q of goldenQueries) {
    const results = recall({ query: q, limit: 3 });
    console.log(`\nquery: "${q}" → ${results.length} hits`);
    for (const r of results) {
      console.log(
        `  [${r.memory.id.slice(0, 8)}] rel:${r.relevance.toFixed(2)} final:${r.final_score.toFixed(3)} ${r.memory.content.slice(0, 90).replace(/\n/g, " ")}`
      );
    }
  }

  const ok = version === SCHEMA_VERSION && fts === memories && journal >= memories;
  console.log(`\nverify: ${ok ? "OK" : "FAILED"}`);
  closeDb();
  process.exit(ok ? 0 : 1);
}

const command = process.argv[2];
try {
  switch (command) {
    case "session-start":
      cmdSessionStart();
      break;
    case "maintain":
      cmdMaintain();
      break;
    case "sync":
      // Target of the write-triggered scheduler (runs detached); also handy manually.
      console.log(autoSync());
      break;
    case "verify":
      cmdVerify();
      break;
    default:
      console.error("usage: cli.js <session-start|maintain|sync|verify>");
      process.exit(1);
  }
} catch (err) {
  // Hook paths must not block the session on an internal failure.
  console.error("[memory cli] error:", err);
  if (command === "verify") process.exit(1);
}
process.exitCode = process.exitCode ?? 0;
