/**
 * Memory content is an injection surface: anything stored today is rendered
 * into a future session's context (recall output, SessionStart injection).
 * Scan at BOTH boundaries — on store (reject) and on render (mask) — so rows
 * written before a rule existed, or restored from a journal, are still caught.
 * Ported from hermes-agent's threat-pattern design.
 */
const THREAT_PATTERNS = [
    {
        id: "instruction-override",
        re: /ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions|context|messages)|disregard\s+(all\s+|your\s+)?(previous|prior)\s+instructions|you\s+are\s+now\s+(a|an|the)\s|new\s+system\s+prompt|<\/?system>/i,
    },
    {
        id: "exfil-pipe-shell",
        re: /(curl|wget)[^\n]{0,200}\|\s*(ba|z)?sh\b/i,
    },
    {
        id: "base64-blob",
        // Long unbroken base64 runs have no place in a prose memory
        re: /[A-Za-z0-9+/]{240,}={0,2}/,
    },
    {
        id: "remote-image-exfil",
        // Markdown image whose URL carries a query string — classic context-exfil vector
        re: /!\[[^\]]*\]\(https?:\/\/[^)]*\?[^)]*\)/i,
    },
    {
        id: "ansi-escape",
        // eslint-disable-next-line no-control-regex
        re: /\x1b\[/,
    },
];
/** Returns the matching pattern id, or null if the content is clean. */
export function scanThreat(content) {
    for (const p of THREAT_PATTERNS) {
        if (p.re.test(content))
            return p.id;
    }
    return null;
}
/**
 * Render-boundary guard: returns the content unchanged when clean, or a
 * visible [BLOCKED] placeholder when it matches a threat pattern. The row
 * itself is left intact so the user can inspect and delete it.
 */
export function renderSafe(id, content) {
    const threat = scanThreat(content);
    if (!threat)
        return content;
    return `[BLOCKED: memory ${id} matched threat pattern "${threat}" — review with memory_manage action:"get", then update or delete it]`;
}
//# sourceMappingURL=threat.js.map