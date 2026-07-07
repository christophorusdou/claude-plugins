/**
 * Memory content is an injection surface: anything stored today is rendered
 * into a future session's context (recall output, SessionStart injection).
 * Scan at BOTH boundaries — on store (reject) and on render (mask) — so rows
 * written before a rule existed, or restored from a journal, are still caught.
 * Ported from hermes-agent's threat-pattern design.
 */
/** Returns the matching pattern id, or null if the content is clean. */
export declare function scanThreat(content: string): string | null;
/**
 * Render-boundary guard: returns the content unchanged when clean, or a
 * visible [BLOCKED] placeholder when it matches a threat pattern. The row
 * itself is left intact so the user can inspect and delete it.
 */
export declare function renderSafe(id: string, content: string): string;
//# sourceMappingURL=threat.d.ts.map