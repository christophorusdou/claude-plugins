import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmdirSync, writeFileSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDataDir } from "./db.js";
import { writeSnapshot, importFromJsonl, SNAPSHOT_FILE } from "./journal.js";
const LOCK_DIR = ".sync-lock";
const PUSH_STAMP = ".last-push";
const STATUS_FILE = "sync-status.json";
const PUSH_DEBOUNCE_MS = 60 * 60 * 1000;
const LOCK_STALE_MS = 5 * 60 * 1000;
/** All git invocations go through execFile (no shell — paths/args are never interpolated). */
function git(dataDir, args) {
    return execFileSync("git", args, { cwd: dataDir, encoding: "utf-8" });
}
function ensureRepo(dataDir) {
    if (existsSync(join(dataDir, ".git")))
        return;
    git(dataDir, ["init"]);
    writeFileSync(join(dataDir, ".gitignore"), "*.db\n*.db-journal\n*.db-wal\n*.db-shm\n*.bak\nbackups/\nsearch-index.json\n.sync-lock/\nsync-status.json\n.last-push\nlast-curation\n");
    git(dataDir, ["add", ".gitignore"]);
    git(dataDir, ["commit", "-m", "Initialize memory repo"]);
}
/** mkdir-based lock: atomic across processes; stale locks (>5 min) are stolen. */
function acquireLock(dataDir) {
    const lock = join(dataDir, LOCK_DIR);
    try {
        mkdirSync(lock);
        return true;
    }
    catch {
        try {
            if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
                rmdirSync(lock);
                mkdirSync(lock);
                return true;
            }
        }
        catch {
            /* raced or vanished */
        }
        return false;
    }
}
function releaseLock(dataDir) {
    try {
        rmdirSync(join(dataDir, LOCK_DIR));
    }
    catch {
        /* best-effort */
    }
}
function addTracked(dataDir) {
    const present = ["journal.jsonl", SNAPSHOT_FILE, "curation-log.jsonl"].filter((f) => existsSync(join(dataDir, f)));
    if (present.length)
        git(dataDir, ["add", "--", ...present]);
}
function isDirty(dataDir) {
    return git(dataDir, ["status", "--porcelain"]).trim().length > 0;
}
/**
 * Fire-and-forget push. Runs disowned so a slow network can never block the
 * SessionEnd hook; the outcome lands in sync-status.json for the next
 * SessionStart to surface. dataDir/statusPath travel as positional args, not
 * string interpolation, so hostile path characters never reach a shell parser.
 */
function detachedPush(dataDir, statusPath) {
    const script = 'cd "$1" && if git push --quiet >/dev/null 2>&1; ' +
        'then printf \'{"status":"ok","ts":"%s"}\' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$2"; ' +
        'else printf \'{"status":"failed","ts":"%s"}\' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$2"; fi';
    spawn("bash", ["-c", script, "memory-push", dataDir, statusPath], {
        detached: true,
        stdio: "ignore",
    }).unref();
}
export function readSyncStatus() {
    try {
        return JSON.parse(readFileSync(join(getDataDir(), STATUS_FILE), "utf-8"));
    }
    catch {
        return null;
    }
}
/**
 * SessionEnd auto-sync: snapshot → commit when dirty → debounced detached push.
 */
export function autoSync() {
    const dataDir = getDataDir();
    ensureRepo(dataDir);
    if (!acquireLock(dataDir))
        return "sync skipped (another session holds the lock)";
    try {
        const count = writeSnapshot();
        addTracked(dataDir);
        const dirty = isDirty(dataDir);
        if (dirty) {
            git(dataDir, ["commit", "--quiet", "-m", `memory sync: ${count} entries`]);
        }
        const stampPath = join(dataDir, PUSH_STAMP);
        let lastPush = 0;
        try {
            lastPush = statSync(stampPath).mtimeMs;
        }
        catch {
            /* never pushed */
        }
        if (Date.now() - lastPush > PUSH_DEBOUNCE_MS) {
            writeFileSync(stampPath, new Date().toISOString() + "\n");
            detachedPush(dataDir, join(dataDir, STATUS_FILE));
            return dirty
                ? `committed ${count} entries; push running in background`
                : "clean; background push refresh started";
        }
        return dirty ? `committed ${count} entries (push debounced)` : "clean (nothing to sync)";
    }
    finally {
        releaseLock(dataDir);
    }
}
/** Manual sync operations for memory_manage action:"sync" (blocking, verbose). */
export function gitSync(operation) {
    const dataDir = getDataDir();
    ensureRepo(dataDir);
    switch (operation) {
        case "push": {
            if (!acquireLock(dataDir))
                return "Push skipped: another session holds the sync lock.";
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
                }
                catch (e) {
                    return `Exported ${count} memories locally. Push failed: ${e}`;
                }
            }
            finally {
                releaseLock(dataDir);
            }
        }
        case "pull": {
            try {
                const result = git(dataDir, ["pull"]);
                const imported = importFromJsonl();
                return `Pulled: ${result.trim()}\nImported ${imported.imported} new entries (${imported.skipped} already present).`;
            }
            catch (e) {
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
            }
            catch (e) {
                return `Status check failed: ${e}`;
            }
        }
    }
}
//# sourceMappingURL=gitsync.js.map