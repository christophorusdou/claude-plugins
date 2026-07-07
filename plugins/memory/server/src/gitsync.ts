import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmdirSync, writeFileSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDataDir } from "./db.js";
import { writeSnapshot, importFromJsonl, SNAPSHOT_FILE } from "./journal.js";

const LOCK_DIR = ".sync-lock";
const PUSH_STAMP = ".last-push";
const SYNC_STAMP = ".last-sync-attempt";
const STATUS_FILE = "sync-status.json";
const LOCK_STALE_MS = 5 * 60 * 1000;
/** Minutes between write-triggered background syncs (0 = every write; for tests) */
const DEFAULT_SYNC_INTERVAL_MIN = 15;

/** All git invocations go through execFile (no shell — paths/args are never interpolated). */
function git(dataDir: string, args: string[]): string {
  return execFileSync("git", args, { cwd: dataDir, encoding: "utf-8" });
}

function ensureRepo(dataDir: string): void {
  if (existsSync(join(dataDir, ".git"))) return;
  git(dataDir, ["init"]);
  writeFileSync(
    join(dataDir, ".gitignore"),
    "*.db\n*.db-journal\n*.db-wal\n*.db-shm\n*.bak\nbackups/\nsearch-index.json\n.sync-lock/\nsync-status.json\n.last-push\nlast-curation\n"
  );
  git(dataDir, ["add", ".gitignore"]);
  git(dataDir, ["commit", "-m", "Initialize memory repo"]);
}

/** mkdir-based lock: atomic across processes; stale locks (>5 min) are stolen. */
function acquireLock(dataDir: string): boolean {
  const lock = join(dataDir, LOCK_DIR);
  try {
    mkdirSync(lock);
    return true;
  } catch {
    try {
      if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
        rmdirSync(lock);
        mkdirSync(lock);
        return true;
      }
    } catch {
      /* raced or vanished */
    }
    return false;
  }
}

function releaseLock(dataDir: string): void {
  try {
    rmdirSync(join(dataDir, LOCK_DIR));
  } catch {
    /* best-effort */
  }
}

function addTracked(dataDir: string): void {
  const present = ["journal.jsonl", SNAPSHOT_FILE, "curation-log.jsonl"].filter((f) =>
    existsSync(join(dataDir, f))
  );
  if (present.length) git(dataDir, ["add", "--", ...present]);
}

function isDirty(dataDir: string): boolean {
  return git(dataDir, ["status", "--porcelain"]).trim().length > 0;
}

/**
 * Fire-and-forget push. Runs disowned so a slow network can never block the
 * SessionEnd hook; the outcome lands in sync-status.json for the next
 * SessionStart to surface. dataDir/statusPath travel as positional args, not
 * string interpolation, so hostile path characters never reach a shell parser.
 */
function detachedPush(dataDir: string, statusPath: string): void {
  const script =
    'cd "$1" && if git push --quiet >/dev/null 2>&1; ' +
    'then printf \'{"status":"ok","ts":"%s"}\' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$2"; ' +
    'else printf \'{"status":"failed","ts":"%s"}\' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$2"; fi';
  spawn("bash", ["-c", script, "memory-push", dataDir, statusPath], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

/** Commits not yet on the upstream branch (no upstream → treat as ahead). */
function aheadCount(dataDir: string): number {
  try {
    const n = parseInt(git(dataDir, ["rev-list", "--count", "@{u}..HEAD"]).trim(), 10);
    return Number.isFinite(n) ? n : 1;
  } catch {
    return 1;
  }
}

/**
 * Write-triggered sync scheduler: every mutation calls this; at most once per
 * MEMORY_SYNC_INTERVAL_MIN (default 15) it spawns a detached `cli.js sync` so
 * commits/pushes happen DURING long sessions, not only at SessionEnd — and a
 * crashed session's writes ship at the next session start, which also calls
 * this. Never blocks or fails the calling tool.
 */
export function maybeScheduleSync(): void {
  try {
    const dataDir = getDataDir();
    const intervalMin = Number(
      process.env.MEMORY_SYNC_INTERVAL_MIN ?? DEFAULT_SYNC_INTERVAL_MIN
    );
    const stamp = join(dataDir, SYNC_STAMP);
    let last = 0;
    try {
      last = statSync(stamp).mtimeMs;
    } catch {
      /* never synced */
    }
    if (Date.now() - last < intervalMin * 60_000) return;
    writeFileSync(stamp, new Date().toISOString() + "\n");

    const cliPath = fileURLToPath(new URL("./cli.js", import.meta.url));
    spawn(process.execPath, [cliPath, "sync"], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    }).unref();
  } catch {
    /* best-effort */
  }
}

export interface SyncStatus {
  status: "ok" | "failed";
  ts: string;
}

export function readSyncStatus(): SyncStatus | null {
  try {
    return JSON.parse(readFileSync(join(getDataDir(), STATUS_FILE), "utf-8")) as SyncStatus;
  } catch {
    return null;
  }
}

/**
 * Auto-sync (SessionEnd hook + write-triggered scheduler): snapshot → commit
 * when dirty → detached push whenever local commits aren't on the remote yet.
 */
export function autoSync(): string {
  const dataDir = getDataDir();
  ensureRepo(dataDir);
  if (!acquireLock(dataDir)) return "sync skipped (another session holds the lock)";

  try {
    const count = writeSnapshot();
    addTracked(dataDir);

    const dirty = isDirty(dataDir);
    if (dirty) {
      git(dataDir, ["commit", "--quiet", "-m", `memory sync: ${count} entries`]);
    }

    if (aheadCount(dataDir) > 0) {
      writeFileSync(join(dataDir, PUSH_STAMP), new Date().toISOString() + "\n");
      detachedPush(dataDir, join(dataDir, STATUS_FILE));
      return dirty
        ? `committed ${count} entries; push running in background`
        : "pushing earlier unpushed commits in background";
    }

    return "clean (nothing to sync)";
  } finally {
    releaseLock(dataDir);
  }
}

/** Manual sync operations for memory_manage action:"sync" (blocking, verbose). */
export function gitSync(operation: "push" | "pull" | "status"): string {
  const dataDir = getDataDir();
  ensureRepo(dataDir);

  switch (operation) {
    case "push": {
      if (!acquireLock(dataDir)) return "Push skipped: another session holds the sync lock.";
      try {
        const count = writeSnapshot();
        addTracked(dataDir);
        if (isDirty(dataDir)) {
          git(dataDir, ["commit", "--quiet", "-m", `memory sync: ${count} entries`]);
        }
        try {
          const result = git(dataDir, ["push"]);
          writeFileSync(join(dataDir, PUSH_STAMP), new Date().toISOString() + "\n");
          return `Exported ${count} memories. ${result.trim() || "Pushed."}`;
        } catch (e) {
          return `Exported ${count} memories locally. Push failed: ${e}`;
        }
      } finally {
        releaseLock(dataDir);
      }
    }

    case "pull": {
      try {
        const result = git(dataDir, ["pull"]);
        const imported = importFromJsonl();
        return `Pulled: ${result.trim()}\nImported ${imported.imported} new entries (${imported.skipped} already present).`;
      } catch (e) {
        return `Pull failed: ${e}`;
      }
    }

    case "status": {
      try {
        const status = git(dataDir, ["status", "--short"]);
        const log = git(dataDir, ["log", "--oneline", "-5"]);
        const pushStatus = readSyncStatus();
        const pushLine = pushStatus
          ? `Last background push: ${pushStatus.status} at ${pushStatus.ts}`
          : "No background push recorded yet.";
        return `Status:\n${status.trim() || "(clean)"}\n${pushLine}\n\nRecent commits:\n${log.trim()}`;
      } catch (e) {
        return `Status check failed: ${e}`;
      }
    }
  }
}
