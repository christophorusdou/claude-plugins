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
export declare function detectProject(cwd: string): string | null;
/**
 * Project for THIS server process. start.sh exports MEMORY_SESSION_CWD (the
 * cwd Claude Code launched it with) before cd-ing into the server dir, so we
 * must prefer it over process.cwd() — which is always the plugin's server dir
 * and made v1 scope every auto-detected memory to "memory-server". That name
 * is kept as a hard guard: it can only come from the plugin's own package.json.
 */
export declare function getDetectedProject(): string | null;
//# sourceMappingURL=detect.d.ts.map