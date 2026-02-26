import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

let _detected: string | null | undefined = undefined; // undefined = not yet detected

/**
 * Detect the current project from process.cwd().
 * Priority:
 *   1. package.json "name" field
 *   2. Regex match /projects/<name>/ in path
 *   3. Directory basename (if not home dir)
 *   4. null (no project — global scope)
 */
function detectProject(): string | null {
  const cwd = process.cwd();

  // 1. package.json name
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.name && typeof pkg.name === "string") {
        // Strip scope prefix (@org/name -> name)
        const name = pkg.name.replace(/^@[^/]+\//, "");
        if (name) return name;
      }
    } catch {
      // Malformed package.json — fall through
    }
  }

  // 2. Regex: /projects/<name>/
  const projectsMatch = cwd.match(/\/projects\/([^/]+)/);
  if (projectsMatch) {
    return projectsMatch[1];
  }

  // 3. Directory basename (skip if home dir)
  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (cwd !== home && cwd !== "/") {
    const dir = basename(cwd);
    // Skip generic directory names
    if (!["tmp", "temp", "Downloads", "Desktop", "Documents"].includes(dir)) {
      return dir;
    }
  }

  // 4. No project detected
  return null;
}

/**
 * Get the auto-detected project. Cached after first call.
 */
export function getDetectedProject(): string | null {
  if (_detected === undefined) {
    _detected = detectProject();
  }
  return _detected;
}
