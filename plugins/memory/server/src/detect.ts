import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * Detect the project a given directory belongs to. Pure function of `cwd` so
 * hooks can pass the cwd from their stdin JSON per invocation — v1 cached a
 * single detection from the server process cwd forever, which mis-scoped hooks.
 *
 * Priority:
 *   1. package.json "name", walking up from cwd (stops after a .git root)
 *   2. Regex match /projects/<name>/ in the path
 *   3. null (no project — global scope)
 *
 * Deliberately no basename(cwd) fallback: common directory names (src, lib,
 * app, work) would fragment the memory store into meaningless scopes.
 */
export function detectProject(cwd: string): string | null {
  let dir = cwd;
  for (let depth = 0; depth < 6; depth++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.name && typeof pkg.name === "string") {
          const name = pkg.name.replace(/^@[^/]+\//, "");
          if (name) return name;
        }
      } catch {
        // Malformed package.json — keep walking
      }
    }
    // A .git dir marks the repo root — nothing above it belongs to this project.
    if (existsSync(join(dir, ".git"))) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const projectsMatch = cwd.match(/\/projects\/([^/]+)/);
  if (projectsMatch) return projectsMatch[1];

  return null;
}

let _detected: string | null | undefined = undefined;

/**
 * Project for THIS server process. start.sh exports MEMORY_SESSION_CWD (the
 * cwd Claude Code launched it with) before cd-ing into the server dir, so we
 * must prefer it over process.cwd() — which is always the plugin's server dir
 * and made v1 scope every auto-detected memory to "memory-server". That name
 * is kept as a hard guard: it can only come from the plugin's own package.json.
 */
export function getDetectedProject(): string | null {
  if (_detected === undefined) {
    const cwd = process.env.MEMORY_SESSION_CWD || process.cwd();
    const detected = detectProject(cwd);
    _detected = detected === "memory-server" ? null : detected;
  }
  return _detected;
}
