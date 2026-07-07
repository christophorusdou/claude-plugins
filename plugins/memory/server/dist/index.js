#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { storeMemory } from "./tools/store.js";
import { recallMemories } from "./tools/recall.js";
import { getMemory } from "./tools/get.js";
import { listMemories } from "./tools/list.js";
import { updateMemory } from "./tools/update.js";
import { deleteMemory } from "./tools/delete.js";
import { upvoteMemory, downvoteMemory } from "./tools/vote.js";
import { getStats } from "./tools/stats.js";
import { auditMemories } from "./tools/audit.js";
import { syncMemories } from "./tools/sync.js";
import { importMemoryMd } from "./tools/import.js";
import { ageMemories, mergeMemory } from "./tools/lifecycle.js";
import { findConsolidationGroups } from "./similarity.js";
import { validateTriggers } from "./retrieval.js";
import { getDb, closeDb } from "./db.js";
import { getDetectedProject } from "./detect.js";
import { renderSafe } from "./threat.js";
import { ensureJournalBootstrap } from "./journal.js";
// Coercion helpers for deferred-tool resilience: when MCP tool schemas are
// evicted from the model's context, all params arrive as strings. These
// preprocessors parse stringified arrays, numbers, and booleans so zod
// validation still passes.
const coerceArray = (v) => {
    if (typeof v === "string") {
        try {
            return JSON.parse(v);
        }
        catch {
            return v;
        }
    }
    return v;
};
const coerceNumber = (v) => typeof v === "string" && v.trim() !== "" ? Number(v) : v;
const coerceBoolean = (v) => {
    if (v === "true")
        return true;
    if (v === "false")
        return false;
    return v;
};
const RECALL_TRUNCATE_CHARS = 600;
const server = new McpServer({
    name: "memory",
    version: "2.0.0",
});
// --- memory_store ---
server.tool("memory_store", "Store a knowledge entry in the cross-project archive. For patterns, gotchas, debug insights, decisions, or facts. Write declarative facts about how the world behaves, not imperatives to yourself. NOT for user preferences or session feedback (use built-in memory for those). Auto-detects project scope. Deduplicates within same scope.", {
    content: z.string().describe("The memory text to store"),
    category: z
        .enum([
        "pattern",
        "gotcha",
        "preference",
        "decision",
        "fact",
        "debug-insight",
    ])
        .optional()
        .describe("Memory category (auto-detected if omitted)"),
    project: z
        .string()
        .nullable()
        .optional()
        .describe("Project name. Omit to auto-detect from cwd. Pass null explicitly for global scope."),
    tags: z.preprocess(coerceArray, z.array(z.string()).optional()).describe("Tags for filtering"),
    triggers: z.preprocess(coerceArray, z.array(z.string())
        .optional()).describe("Keyword/regex patterns that boost this memory during recall when matched against the query. Plain strings match case-insensitively. Use /pattern/flags for regex (default flag: i)."),
    source: z
        .enum(["manual", "auto-captured"])
        .optional()
        .describe("How this memory was created"),
    confidence: z.preprocess(coerceNumber, z.number()
        .min(0)
        .max(1)
        .optional()).describe("Confidence level (0-1)"),
    version_context: z
        .string()
        .nullable()
        .optional()
        .describe("Version context (e.g. 'React 18.2', 'Node 20') for staleness tracking"),
    valid_until: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}/, "Must be an ISO date (YYYY-MM-DD)")
        .nullable()
        .optional()
        .describe("ISO date when this memory expires (e.g. '2026-06-01'). Expired memories rank lower."),
    allow_similar: z.preprocess(coerceBoolean, z.boolean().optional()).describe("Set true to store despite a near-duplicate warning (when the new entry is genuinely distinct)"),
}, async (args) => {
    const text = (s) => ({ content: [{ type: "text", text: s }] });
    if (args.triggers && args.triggers.length > 0) {
        const triggerErrors = validateTriggers(args.triggers);
        if (triggerErrors.length > 0) {
            return text(`Invalid triggers:\n${triggerErrors.join("\n")}\n\nFix the patterns and retry.`);
        }
    }
    let result;
    try {
        result = storeMemory({
            content: args.content,
            category: args.category,
            project: args.project,
            tags: args.tags,
            triggers: args.triggers,
            source: args.source,
            confidence: args.confidence,
            version_context: args.version_context,
            valid_until: args.valid_until,
            allow_similar: args.allow_similar,
        });
    }
    catch (err) {
        return text(err instanceof Error ? err.message : String(err));
    }
    if (result.status === "duplicate") {
        return text(`Exact duplicate found. Existing memory ID: ${result.existing_id}`);
    }
    if (result.status === "near-duplicate") {
        const candidates = (result.near_duplicates ?? [])
            .map((d) => `  [${d.id}] (similarity ${d.similarity.toFixed(2)}) ${d.content}`)
            .join("\n");
        return text(`Near-duplicate(s) found:\n${candidates}\n\nPrefer memory_manage action:"update" or "upvote" on the existing entry. If this is genuinely distinct, retry with allow_similar: true.`);
    }
    const scope = result.project ? `project: ${result.project}` : "global";
    return text(`Memory stored (${scope}). ID: ${result.id}`);
});
// --- memory_recall ---
server.tool("memory_recall", "Search the knowledge archive (FTS5/BM25 keyword search). Use as a fallback when built-in memory doesn't have relevant context, or for cross-project search. If results contradict built-in MEMORY.md, built-in is authoritative. Auto-detects project from cwd for two-pass search (project + global). Long entries are truncated — use memory_manage action:\"get\" for full text.", {
    query: z.string().describe("Search query (keywords work best)"),
    project: z
        .string()
        .nullable()
        .optional()
        .describe("Omit to auto-detect (two-pass search). Pass null for global only. Pass string for specific project."),
    category: z
        .enum([
        "pattern",
        "gotcha",
        "preference",
        "decision",
        "fact",
        "debug-insight",
    ])
        .optional()
        .describe("Filter by category"),
    limit: z.preprocess(coerceNumber, z.number().optional()).describe("Max results (default 5)"),
    min_score: z.preprocess(coerceNumber, z.number()
        .optional()).describe("Minimum memory score to include"),
    full: z.preprocess(coerceBoolean, z.boolean().optional()).describe("Return full untruncated content (default false — entries truncate at 600 chars)"),
}, async (args) => {
    const results = recallMemories({
        query: args.query,
        project: args.project,
        category: args.category,
        limit: args.limit,
        min_score: args.min_score,
    });
    if (results.length === 0) {
        return {
            content: [
                { type: "text", text: "No matching memories found." },
            ],
        };
    }
    const formatted = results.map((r, i) => {
        const m = r.memory;
        const expired = m.valid_until && new Date(m.valid_until).getTime() < Date.now();
        const meta = [
            m.category,
            m.project ? `project:${m.project}` : "global",
            `score:${m.score}`,
            `rel:${r.relevance.toFixed(3)}`,
            r.trigger_matched ? "TRIGGER" : null,
            expired ? "EXPIRED" : null,
            m.lifecycle_state !== "active" ? m.lifecycle_state : null,
            m.version_context ? `ctx:${m.version_context}` : null,
        ].filter(Boolean).join(" | ");
        let body = renderSafe(m.id, m.content);
        if (!args.full && body.length > RECALL_TRUNCATE_CHARS) {
            body =
                body.slice(0, RECALL_TRUNCATE_CHARS) +
                    `…[truncated — memory_manage action:"get" id:"${m.id}" for full text]`;
        }
        return `${i + 1}. [${m.id}] (${meta})\n   ${body}`;
    });
    const detected = getDetectedProject();
    const scopeInfo = args.project !== undefined
        ? (args.project === null ? "scope: global" : `scope: ${args.project}`)
        : (detected ? `auto-detected project: ${detected}` : "scope: global");
    return {
        content: [
            {
                type: "text",
                text: `Found ${results.length} memories (${scopeInfo}):\n\n${formatted.join("\n\n")}`,
            },
        ],
    };
});
// --- memory_manage ---
server.tool("memory_manage", "Manage the knowledge archive. Actions: get, update, delete, upvote, downvote, list, stats, audit, consolidate, age, merge, sync, import.", {
    action: z
        .enum([
        "get",
        "update",
        "delete",
        "upvote",
        "downvote",
        "list",
        "stats",
        "audit",
        "consolidate",
        "age",
        "merge",
        "sync",
        "import",
    ])
        .describe("Operation to perform"),
    id: z.string().optional().describe("Entry ID (for get/update/delete/upvote/downvote/merge)"),
    content: z.string().optional().describe("New content (for update)"),
    category: z
        .enum(["pattern", "gotcha", "preference", "decision", "fact", "debug-insight"])
        .optional()
        .describe("Category filter (for list) or new category (for update)"),
    project: z
        .string()
        .nullable()
        .optional()
        .describe("Project filter (for list/consolidate) or new project (for update)"),
    tags: z.preprocess(coerceArray, z.array(z.string()).optional()).describe("New tags (for update)"),
    triggers: z.preprocess(coerceArray, z.array(z.string()).optional()).describe("New triggers (for update)"),
    version_context: z.string().nullable().optional().describe("Version context (for update)"),
    valid_until: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}/, "Must be ISO date YYYY-MM-DD")
        .nullable()
        .optional()
        .describe("Expiry date (for update)"),
    detail: z.string().optional().describe("Context for vote (upvote/downvote)"),
    min_score: z.preprocess(coerceNumber, z.number().optional()).describe("Minimum score (for list)"),
    limit: z.preprocess(coerceNumber, z.number().optional()).describe("Max results"),
    offset: z.preprocess(coerceNumber, z.number().optional()).describe("Pagination offset (for list)"),
    include_expired: z.preprocess(coerceBoolean, z.boolean().optional()).describe("Include expired (for audit, default true)"),
    days_warning: z.preprocess(coerceNumber, z.number().optional()).describe("Days ahead to warn (for audit, default 30)"),
    threshold: z.preprocess(coerceNumber, z.number().min(0.3).max(0.9).optional()).describe("Jaccard similarity threshold (for consolidate, default 0.5)"),
    stale_days: z.preprocess(coerceNumber, z.number().optional()).describe("Age active→stale after N days untouched (for age, default 90)"),
    archive_days: z.preprocess(coerceNumber, z.number().optional()).describe("Age stale→archived after N days untouched (for age, default 180)"),
    dry_run: z.preprocess(coerceBoolean, z.boolean().optional()).describe("Preview transitions without applying (for age)"),
    merged_into: z.string().optional().describe("Winner memory ID that absorbs this entry (for merge)"),
    operation: z.enum(["push", "pull", "status", "reindex"]).optional().describe("Sync operation (for sync)"),
    file_path: z.string().optional().describe("File path (for import)"),
}, async (args) => {
    const text = (s) => ({ content: [{ type: "text", text: s }] });
    switch (args.action) {
        case "get": {
            if (!args.id)
                return text("Error: id is required for get");
            const result = getMemory(args.id);
            if (!result)
                return text(`Entry ${args.id} not found.`);
            const m = result.memory;
            const meta = [
                `category: ${m.category}`,
                `project: ${m.project ?? "(global)"}`,
                `score: ${m.score}`,
                `confidence: ${m.confidence.toFixed(2)}`,
                `use_count: ${m.use_count}`,
                `lifecycle: ${m.lifecycle_state}`,
                `source: ${m.source}${m.source_detail ? ` (${m.source_detail})` : ""}`,
                `created: ${m.created_at}`,
                `last_used: ${m.last_used_at ?? "never"}`,
                m.version_context ? `version_context: ${m.version_context}` : null,
                m.valid_until ? `valid_until: ${m.valid_until}` : null,
                m.merged_into ? `merged_into: ${m.merged_into}` : null,
                m.tags.length ? `tags: ${m.tags.join(", ")}` : null,
                m.triggers.length ? `triggers: ${m.triggers.join(", ")}` : null,
            ].filter(Boolean).join("\n  ");
            const history = result.events
                .map((e) => `  ${e.created_at} ${e.event_type}${e.detail ? ` — ${e.detail}` : ""}`)
                .join("\n");
            return text(`[${m.id}]\n  ${meta}\n\nContent:\n${renderSafe(m.id, m.content)}\n\nRecent events:\n${history || "  (none)"}`);
        }
        case "update": {
            if (!args.id)
                return text("Error: id is required for update");
            const result = updateMemory({
                id: args.id,
                content: args.content,
                category: args.category,
                project: args.project,
                tags: args.tags,
                triggers: args.triggers,
                version_context: args.version_context,
                valid_until: args.valid_until,
            });
            if (!result)
                return text(`Entry ${args.id} not found.`);
            return text(`Updated ${result.id}: ${result.content.slice(0, 100)}...`);
        }
        case "delete": {
            if (!args.id)
                return text("Error: id is required for delete");
            const deleted = deleteMemory(args.id);
            return text(deleted ? `Deleted ${args.id}` : `Entry ${args.id} not found`);
        }
        case "upvote": {
            if (!args.id)
                return text("Error: id is required for upvote");
            const result = upvoteMemory(args.id, args.detail);
            if (!result)
                return text(`Entry ${args.id} not found.`);
            return text(`Upvoted. Score: ${result.new_score}, Confidence: ${result.new_confidence.toFixed(2)}${result.lifecycle_changed ? `, lifecycle: ${result.lifecycle_changed}` : ""}`);
        }
        case "downvote": {
            if (!args.id)
                return text("Error: id is required for downvote");
            const result = downvoteMemory(args.id, args.detail);
            if (!result)
                return text(`Entry ${args.id} not found.`);
            return text(`Downvoted. Score: ${result.new_score}, Confidence: ${result.new_confidence.toFixed(2)}${result.lifecycle_changed ? `, lifecycle: ${result.lifecycle_changed}` : ""}`);
        }
        case "list": {
            const memories = listMemories({
                project: args.project,
                category: args.category,
                min_score: args.min_score,
                limit: args.limit,
                offset: args.offset,
            });
            if (memories.length === 0)
                return text("No entries found matching filters.");
            const formatted = memories.map((m) => {
                const meta = [m.category, m.project ? `project:${m.project}` : "global", `score:${m.score}`, `conf:${m.confidence.toFixed(2)}`, m.lifecycle_state !== "active" ? m.lifecycle_state : null].filter(Boolean).join(" | ");
                return `[${m.id}] (${meta})\n  ${m.content}`;
            });
            return text(`${memories.length} entries:\n\n${formatted.join("\n\n")}`);
        }
        case "stats": {
            const stats = getStats();
            return text(JSON.stringify(stats, null, 2));
        }
        case "audit": {
            const candidates = auditMemories({
                include_expired: args.include_expired,
                days_warning: args.days_warning,
                limit: args.limit,
            });
            if (candidates.length === 0)
                return text("No stale or expiring entries found. All entries are fresh!");
            const formatted = candidates.map((c) => {
                const m = c.memory;
                const meta = [m.category, m.project ? `project:${m.project}` : "global", m.version_context ? `ctx:${m.version_context}` : null, m.valid_until ? `expires:${m.valid_until}` : null].filter(Boolean).join(" | ");
                return `[${m.id}] ${c.reason}\n  (${meta})\n  ${m.content.slice(0, 120)}`;
            });
            return text(`${candidates.length} entries need review:\n\n${formatted.join("\n\n")}\n\nUse memory_manage with action:update/downvote/delete to resolve.`);
        }
        case "consolidate": {
            const groups = findConsolidationGroups(getDb(), {
                project: args.project,
                threshold: args.threshold,
                limit: args.limit,
            });
            if (groups.length === 0)
                return text("No consolidation candidates found. Entries are well-separated!");
            const formatted = groups.map((g, gi) => {
                const lines = g.members.map((m, mi) => {
                    const label = mi === 0 ? ">>> KEEP " : "    MERGE";
                    const meta = [m.category, m.project ? `project:${m.project}` : "global", `score:${m.score}`, `uses:${m.use_count}`].join(" | ");
                    return `  ${label} [${m.id}] (${meta})\n           ${m.content.slice(0, 120)}`;
                });
                return `Group ${gi + 1} (${g.members.length} entries, avg similarity: ${g.avg_similarity.toFixed(3)}):\n${lines.join("\n")}`;
            });
            return text(`${groups.length} consolidation groups found:\n\n${formatted.join("\n\n")}\n\nTo merge: update the winner with consolidated content, then action:"merge" each loser with merged_into:<winner id> (keeps tombstones — do not delete).`);
        }
        case "age": {
            const r = ageMemories({
                stale_days: args.stale_days,
                archive_days: args.archive_days,
                dry_run: args.dry_run,
            });
            const fmt = (arr) => arr.length ? arr.map((e) => `  [${e.id}] ${e.reason}\n    ${e.content}`).join("\n") : "  (none)";
            const verb = r.dry_run ? "Would transition (dry run)" : "Transitioned";
            return text(`${verb}:\n\n→ stale (${r.to_stale.length}):\n${fmt(r.to_stale)}\n\n→ archived (${r.to_archived.length}):\n${fmt(r.to_archived)}` +
                (r.dry_run ? "\n\nRun without dry_run to apply." : ""));
        }
        case "merge": {
            if (!args.id)
                return text("Error: id is required for merge (the entry being absorbed)");
            if (!args.merged_into)
                return text("Error: merged_into is required for merge (the winning entry)");
            const result = mergeMemory(args.id, args.merged_into);
            if (typeof result === "string")
                return text(result);
            return text(`Merged ${result.id} into ${result.merged_into} (tombstone kept; excluded from recall).`);
        }
        case "sync": {
            if (!args.operation)
                return text("Error: operation is required for sync (push/pull/status/reindex)");
            const result = syncMemories(args.operation);
            return text(`[${result.operation}] ${result.message}`);
        }
        case "import": {
            if (!args.file_path)
                return text("Error: file_path is required for import");
            const result = await importMemoryMd(args.file_path, args.project ?? undefined);
            return text(`Imported from ${args.file_path}:\n  Total entries: ${result.total_entries}\n  Created: ${result.created}\n  Duplicates: ${result.duplicates}\n  Near-duplicates: ${result.near_duplicates}`);
        }
        default:
            return text(`Unknown action: ${args.action}`);
    }
});
// --- Start server ---
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // First-run bookkeeping after connect so it never delays the handshake
    try {
        getDb();
        ensureJournalBootstrap();
    }
    catch (err) {
        console.error("[memory] startup bookkeeping failed:", err);
    }
}
main().catch((err) => {
    console.error("Fatal error:", err);
    closeDb();
    process.exit(1);
});
// Graceful-exit path (rare — the server is usually SIGKILLed; durability comes
// from per-write passive checkpoints, not from these handlers).
function shutdown() {
    closeDb();
    process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
//# sourceMappingURL=index.js.map