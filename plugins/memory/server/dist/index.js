#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { storeMemory } from "./tools/store.js";
import { recallMemories } from "./tools/recall.js";
import { listMemories } from "./tools/list.js";
import { updateMemory } from "./tools/update.js";
import { deleteMemory } from "./tools/delete.js";
import { upvoteMemory, downvoteMemory } from "./tools/vote.js";
import { getStats } from "./tools/stats.js";
import { getCleanupCandidates } from "./tools/cleanup.js";
import { auditMemories } from "./tools/audit.js";
import { syncMemories } from "./tools/sync.js";
import { importMemoryMd } from "./tools/import.js";
import { findConsolidationGroups } from "./tools/consolidate.js";
import { validateTriggers } from "./retrieval.js";
import { closeDb } from "./db.js";
import { getDetectedProject } from "./project-detect.js";
import { saveSearchIndex } from "./search-index.js";
import { preloadModel } from "./embeddings.js";
const server = new McpServer({
    name: "memory",
    version: "1.0.0",
});
// --- memory_store ---
server.tool("memory_store", "Store a new memory. Auto-detects category and project scope. When project is omitted, auto-detects from cwd. Pass project: null explicitly for global scope. Deduplicates within same scope.", {
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
    tags: z.array(z.string()).optional().describe("Tags for filtering"),
    triggers: z
        .array(z.string())
        .optional()
        .describe("Keyword/regex patterns that boost this memory during recall when matched against the query. Plain strings match case-insensitively. Use /pattern/flags for regex (default flag: i)."),
    source: z
        .enum(["manual", "auto-captured"])
        .optional()
        .describe("How this memory was created"),
    confidence: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Confidence level (0-1)"),
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
}, async (args) => {
    // Validate triggers before storing
    if (args.triggers && args.triggers.length > 0) {
        const triggerErrors = validateTriggers(args.triggers);
        if (triggerErrors.length > 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Invalid triggers:\n${triggerErrors.join("\n")}\n\nFix the patterns and retry.`,
                    },
                ],
            };
        }
    }
    const result = await storeMemory({
        content: args.content,
        category: args.category,
        project: args.project,
        tags: args.tags,
        triggers: args.triggers,
        source: args.source,
        confidence: args.confidence,
        version_context: args.version_context,
        valid_until: args.valid_until,
    });
    if (result.status === "duplicate") {
        return {
            content: [
                {
                    type: "text",
                    text: `Exact duplicate found. Existing memory ID: ${result.existing_id}`,
                },
            ],
        };
    }
    if (result.status === "near-duplicate") {
        return {
            content: [
                {
                    type: "text",
                    text: `Near-duplicate found (similarity: ${result.similarity?.toFixed(3)}). Existing memory ID: ${result.existing_id}. Use memory_update to modify the existing memory if needed.`,
                },
            ],
        };
    }
    const scope = result.project ? `project: ${result.project}` : "global";
    return {
        content: [
            { type: "text", text: `Memory stored (${scope}). ID: ${result.id}` },
        ],
    };
});
// --- memory_recall ---
server.tool("memory_recall", "Search memories using semantic + keyword hybrid search. When project is omitted, auto-detects from cwd and runs two-pass search (project + global) with scope boosting. Pass null for global-only.", {
    query: z.string().describe("Search query (natural language)"),
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
    limit: z.number().optional().describe("Max results (default 10)"),
    min_score: z
        .number()
        .optional()
        .describe("Minimum memory score to include"),
}, async (args) => {
    const results = await recallMemories({
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
            `sim:${r.vector_similarity.toFixed(3)}`,
            r.trigger_matched ? "TRIGGER" : null,
            expired ? "EXPIRED" : null,
            m.version_context ? `ctx:${m.version_context}` : null,
        ].filter(Boolean).join(" | ");
        return `${i + 1}. [${m.id}] (${meta})\n   ${m.content}`;
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
// --- memory_update ---
server.tool("memory_update", "Update an existing memory's content, category, project, tags, or triggers.", {
    id: z.string().describe("Memory ID to update"),
    content: z.string().optional().describe("New content"),
    category: z
        .enum([
        "pattern",
        "gotcha",
        "preference",
        "decision",
        "fact",
        "debug-insight",
    ])
        .optional(),
    project: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    triggers: z.array(z.string()).optional(),
    version_context: z
        .string()
        .nullable()
        .optional()
        .describe("Version context for staleness tracking"),
    valid_until: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}/, "Must be an ISO date (YYYY-MM-DD)")
        .nullable()
        .optional()
        .describe("ISO date when this memory expires"),
}, async (args) => {
    const result = await updateMemory(args);
    if (!result) {
        return {
            content: [
                {
                    type: "text",
                    text: `Memory ${args.id} not found.`,
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `Updated memory ${result.id}: ${result.content.slice(0, 100)}...`,
            },
        ],
    };
});
// --- memory_delete ---
server.tool("memory_delete", "Delete a memory by ID.", {
    id: z.string().describe("Memory ID to delete"),
}, async (args) => {
    const deleted = await deleteMemory(args.id);
    return {
        content: [
            {
                type: "text",
                text: deleted
                    ? `Deleted memory ${args.id}`
                    : `Memory ${args.id} not found`,
            },
        ],
    };
});
// --- memory_upvote ---
server.tool("memory_upvote", "Upvote a memory (+1 score, +0.05 confidence). Use when a memory was helpful.", {
    id: z.string().describe("Memory ID to upvote"),
    detail: z.string().optional().describe("Context for the upvote"),
}, async (args) => {
    const result = upvoteMemory(args.id, args.detail);
    if (!result) {
        return {
            content: [
                { type: "text", text: `Memory ${args.id} not found.` },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `Upvoted. Score: ${result.new_score}, Confidence: ${result.new_confidence.toFixed(2)}`,
            },
        ],
    };
});
// --- memory_downvote ---
server.tool("memory_downvote", "Downvote a memory (-1 score, -0.05 confidence). Use when a memory was incorrect or unhelpful.", {
    id: z.string().describe("Memory ID to downvote"),
    detail: z.string().optional().describe("Context for the downvote"),
}, async (args) => {
    const result = downvoteMemory(args.id, args.detail);
    if (!result) {
        return {
            content: [
                { type: "text", text: `Memory ${args.id} not found.` },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: `Downvoted. Score: ${result.new_score}, Confidence: ${result.new_confidence.toFixed(2)}`,
            },
        ],
    };
});
// --- memory_list ---
server.tool("memory_list", "List memories with optional filters. Sorted by score descending.", {
    project: z.string().nullable().optional().describe("Filter by project"),
    category: z
        .enum([
        "pattern",
        "gotcha",
        "preference",
        "decision",
        "fact",
        "debug-insight",
    ])
        .optional(),
    min_score: z.number().optional(),
    limit: z.number().optional().describe("Max results (default 50)"),
    offset: z.number().optional().describe("Pagination offset"),
}, async (args) => {
    const memories = listMemories({
        project: args.project,
        category: args.category,
        min_score: args.min_score,
        limit: args.limit,
        offset: args.offset,
    });
    if (memories.length === 0) {
        return {
            content: [
                { type: "text", text: "No memories found matching filters." },
            ],
        };
    }
    const formatted = memories.map((m) => {
        const meta = [
            m.category,
            m.project ? `project:${m.project}` : "global",
            `score:${m.score}`,
            `conf:${m.confidence.toFixed(2)}`,
        ].join(" | ");
        return `[${m.id}] (${meta})\n  ${m.content}`;
    });
    return {
        content: [
            {
                type: "text",
                text: `${memories.length} memories:\n\n${formatted.join("\n\n")}`,
            },
        ],
    };
});
// --- memory_stats ---
server.tool("memory_stats", "Get statistics: counts by project, category, source, and score distribution.", {}, async () => {
    const stats = getStats();
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(stats, null, 2),
            },
        ],
    };
});
// --- memory_cleanup ---
server.tool("memory_cleanup", "Suggest low-value memories for deletion (score < -1, unused 90+ days, low confidence auto-captures).", {}, async () => {
    const candidates = getCleanupCandidates();
    if (candidates.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: "No cleanup candidates found. All memories are healthy!",
                },
            ],
        };
    }
    const formatted = candidates.map((c) => {
        return `[${c.memory.id}] ${c.reason}\n  ${c.memory.content.slice(0, 100)}`;
    });
    return {
        content: [
            {
                type: "text",
                text: `${candidates.length} cleanup candidates:\n\n${formatted.join("\n\n")}\n\nUse memory_delete to remove unwanted entries.`,
            },
        ],
    };
});
// --- memory_audit ---
server.tool("memory_audit", "Audit memories for staleness: find expired, near-expiry, and low-confidence memories that may need review or deletion.", {
    include_expired: z
        .boolean()
        .optional()
        .describe("Include already-expired memories (default true)"),
    days_warning: z
        .number()
        .optional()
        .describe("Days ahead to warn about upcoming expiry (default 30)"),
    limit: z
        .number()
        .optional()
        .describe("Max results (default 50)"),
}, async (args) => {
    const candidates = auditMemories({
        include_expired: args.include_expired,
        days_warning: args.days_warning,
        limit: args.limit,
    });
    if (candidates.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: "No stale or expiring memories found. All memories are fresh!",
                },
            ],
        };
    }
    const formatted = candidates.map((c) => {
        const m = c.memory;
        const meta = [
            m.category,
            m.project ? `project:${m.project}` : "global",
            m.version_context ? `ctx:${m.version_context}` : null,
            m.valid_until ? `expires:${m.valid_until}` : null,
        ]
            .filter(Boolean)
            .join(" | ");
        return `[${m.id}] ${c.reason}\n  (${meta})\n  ${m.content.slice(0, 120)}`;
    });
    return {
        content: [
            {
                type: "text",
                text: `${candidates.length} memories need review:\n\n${formatted.join("\n\n")}\n\nUse memory_update to fix valid_until, memory_downvote to mark stale, or memory_delete to remove.`,
            },
        ],
    };
});
// --- memory_consolidate ---
server.tool("memory_consolidate", "Find groups of similar memories that could be merged. Returns suggested winner + candidates for deletion. Use memory_update on the winner with consolidated content, then memory_delete the rest.", {
    project: z
        .string()
        .nullable()
        .optional()
        .describe("Filter by project. Omit for all, null for global only."),
    threshold: z
        .number()
        .min(0.5)
        .max(0.84)
        .optional()
        .describe("Similarity threshold (default 0.70, max 0.84 — below dedup threshold)"),
    limit: z
        .number()
        .optional()
        .describe("Max groups to return (default 10)"),
}, async (args) => {
    const groups = await findConsolidationGroups({
        project: args.project,
        threshold: args.threshold,
        limit: args.limit,
    });
    if (groups.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: "No consolidation candidates found. Memories are well-separated!",
                },
            ],
        };
    }
    const formatted = groups.map((g, gi) => {
        const lines = g.members.map((m, mi) => {
            const label = mi === 0 ? ">>> KEEP" : "    DEL ";
            const meta = [
                m.category,
                m.project ? `project:${m.project}` : "global",
                `score:${m.score}`,
                `uses:${m.use_count}`,
            ].join(" | ");
            return `  ${label} [${m.id}] (${meta})\n           ${m.content.slice(0, 120)}`;
        });
        return `Group ${gi + 1} (${g.members.length} memories, avg similarity: ${g.avg_similarity.toFixed(3)}):\n${lines.join("\n")}`;
    });
    return {
        content: [
            {
                type: "text",
                text: `${groups.length} consolidation groups found:\n\n${formatted.join("\n\n")}\n\nTo merge: memory_update winner with consolidated content, memory_delete the rest.`,
            },
        ],
    };
});
// --- memory_sync ---
server.tool("memory_sync", "Sync memories via git. Operations: push (export JSONL + git push), pull (git pull + rebuild DB), export (JSONL only), rebuild (DB from JSONL).", {
    operation: z
        .enum(["push", "pull", "export", "rebuild"])
        .describe("Sync operation to perform"),
}, async (args) => {
    const result = await syncMemories(args.operation);
    return {
        content: [
            {
                type: "text",
                text: `[${result.operation}] ${result.message}`,
            },
        ],
    };
});
// --- memory_import ---
server.tool("memory_import", "Import memories from a MEMORY.md file. Splits by ## headers and bullet points into individual entries.", {
    file_path: z.string().describe("Absolute path to the MEMORY.md file"),
    project: z
        .string()
        .optional()
        .describe("Project name (inferred from path if omitted)"),
}, async (args) => {
    const result = await importMemoryMd(args.file_path, args.project);
    return {
        content: [
            {
                type: "text",
                text: `Imported from ${args.file_path}:\n  Total entries: ${result.total_entries}\n  Created: ${result.created}\n  Duplicates: ${result.duplicates}\n  Near-duplicates: ${result.near_duplicates}`,
            },
        ],
    };
});
// --- Start server ---
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Preload embedding model in background to avoid cold-start latency
    preloadModel();
}
main().catch((err) => {
    console.error("Fatal error:", err);
    closeDb();
    process.exit(1);
});
// Cleanup on exit: save search index before closing DB
async function shutdown() {
    await saveSearchIndex().catch(() => { });
    closeDb();
    process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
//# sourceMappingURL=index.js.map