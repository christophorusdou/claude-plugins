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
 * Project for THIS server process, from its launch cwd. Claude Code starts one
 * plugin MCP server per session with the session's cwd, so caching per-process
 * is correct; the per-call form above is for hooks.
 */
export declare function getDetectedProject(): string | null;
//# sourceMappingURL=detect.d.ts.map