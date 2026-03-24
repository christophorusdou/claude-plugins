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

// Coercion helpers for deferred-tool resilience: when MCP tool schemas are
// evicted from the model's context, all params arrive as strings. These
// preprocessors parse stringified arrays, numbers, and booleans so zod
// validation still passes.
const coerceArray = (v: unknown) => {
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
};
const coerceNumber = (v: unknown) =>
  typeof v === "string" && v.trim() !== "" ? Number(v) : v;
const coerceBoolean = (v: unknown) => {
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
};

const server = new McpServer({
  name: "memory",
  version: "1.2.0",
});

// --- memory_store ---
server.tool(
  "memory_store",
  "Store a knowledge entry in the cross-project archive. For patterns, gotchas, debug insights, decisions, or facts that benefit from semantic search. NOT for user preferences or session feedback (use built-in memory for those). Auto-detects project scope. Deduplicates within same scope.",
  {
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
    triggers: z.preprocess(coerceArray,
      z.array(z.string())
      .optional()
    ).describe(
        "Keyword/regex patterns that boost this memory during recall when matched against the query. Plain strings match case-insensitively. Use /pattern/flags for regex (default flag: i)."
      ),
    source: z
      .enum(["manual", "auto-captured"])
      .optional()
      .describe("How this memory was created"),
    confidence: z.preprocess(coerceNumber,
      z.number()
      .min(0)
      .max(1)
      .optional()
    ).describe("Confidence level (0-1)"),
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
  },
  async (args) => {
    // Validate triggers before storing
    if (args.triggers && args.triggers.length > 0) {
      const triggerErrors = validateTriggers(args.triggers);
      if (triggerErrors.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
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
            type: "text" as const,
            text: `Exact duplicate found. Existing memory ID: ${result.existing_id}`,
          },
        ],
      };
    }

    if (result.status === "near-duplicate") {
      return {
        content: [
          {
            type: "text" as const,
            text: `Near-duplicate found (similarity: ${result.similarity?.toFixed(3)}). Existing memory ID: ${result.existing_id}. Use memory_manage with action: "update" to modify the existing entry if needed.`,
          },
        ],
      };
    }

    const scope = result.project ? `project: ${result.project}` : "global";
    return {
      content: [
        { type: "text" as const, text: `Memory stored (${scope}). ID: ${result.id}` },
      ],
    };
  }
);

// --- memory_recall ---
server.tool(
  "memory_recall",
  "Search the knowledge archive using semantic + keyword hybrid search. Use as a fallback when built-in memory doesn't have relevant context, or for cross-project search. If results contradict built-in MEMORY.md, built-in is authoritative. Auto-detects project from cwd for two-pass search (project + global).",
  {
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
    limit: z.preprocess(coerceNumber, z.number().optional()).describe("Max results (default 10)"),
    min_score: z.preprocess(coerceNumber,
      z.number()
      .optional()
    ).describe("Minimum memory score to include"),
  },
  async (args) => {
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
          { type: "text" as const, text: "No matching memories found." },
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
          type: "text" as const,
          text: `Found ${results.length} memories (${scopeInfo}):\n\n${formatted.join("\n\n")}`,
        },
      ],
    };
  }
);

// --- memory_manage ---
server.tool(
  "memory_manage",
  "Manage the knowledge archive. Actions: update, delete, upvote, downvote, list, stats, cleanup, audit, consolidate, sync, import.",
  {
    action: z
      .enum([
        "update",
        "delete",
        "upvote",
        "downvote",
        "list",
        "stats",
        "cleanup",
        "audit",
        "consolidate",
        "sync",
        "import",
      ])
      .describe("Operation to perform"),
    id: z.string().optional().describe("Entry ID (for update/delete/upvote/downvote)"),
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
    min_score: z.preprocess(coerceNumber, z.number().optional()).describe("Minimum score (for list/cleanup)"),
    limit: z.preprocess(coerceNumber, z.number().optional()).describe("Max results"),
    offset: z.preprocess(coerceNumber, z.number().optional()).describe("Pagination offset (for list)"),
    include_expired: z.preprocess(coerceBoolean, z.boolean().optional()).describe("Include expired (for audit, default true)"),
    days_warning: z.preprocess(coerceNumber, z.number().optional()).describe("Days ahead to warn (for audit, default 30)"),
    threshold: z.preprocess(coerceNumber, z.number().min(0.5).max(0.84).optional()).describe("Similarity threshold (for consolidate, default 0.70)"),
    operation: z.enum(["push", "pull", "export", "rebuild"]).optional().describe("Sync operation (for sync)"),
    file_path: z.string().optional().describe("File path (for import)"),
  },
  async (args) => {
    const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

    switch (args.action) {
      case "update": {
        if (!args.id) return text("Error: id is required for update");
        const result = await updateMemory({
          id: args.id,
          content: args.content,
          category: args.category,
          project: args.project,
          tags: args.tags,
          triggers: args.triggers,
          version_context: args.version_context,
          valid_until: args.valid_until,
        });
        if (!result) return text(`Entry ${args.id} not found.`);
        return text(`Updated ${result.id}: ${result.content.slice(0, 100)}...`);
      }

      case "delete": {
        if (!args.id) return text("Error: id is required for delete");
        const deleted = await deleteMemory(args.id);
        return text(deleted ? `Deleted ${args.id}` : `Entry ${args.id} not found`);
      }

      case "upvote": {
        if (!args.id) return text("Error: id is required for upvote");
        const result = upvoteMemory(args.id, args.detail);
        if (!result) return text(`Entry ${args.id} not found.`);
        return text(`Upvoted. Score: ${result.new_score}, Confidence: ${result.new_confidence.toFixed(2)}`);
      }

      case "downvote": {
        if (!args.id) return text("Error: id is required for downvote");
        const result = downvoteMemory(args.id, args.detail);
        if (!result) return text(`Entry ${args.id} not found.`);
        return text(`Downvoted. Score: ${result.new_score}, Confidence: ${result.new_confidence.toFixed(2)}`);
      }

      case "list": {
        const memories = listMemories({
          project: args.project,
          category: args.category,
          min_score: args.min_score,
          limit: args.limit,
          offset: args.offset,
        });
        if (memories.length === 0) return text("No entries found matching filters.");
        const formatted = memories.map((m) => {
          const meta = [m.category, m.project ? `project:${m.project}` : "global", `score:${m.score}`, `conf:${m.confidence.toFixed(2)}`].join(" | ");
          return `[${m.id}] (${meta})\n  ${m.content}`;
        });
        return text(`${memories.length} entries:\n\n${formatted.join("\n\n")}`);
      }

      case "stats": {
        const stats = getStats();
        return text(JSON.stringify(stats, null, 2));
      }

      case "cleanup": {
        const candidates = getCleanupCandidates();
        if (candidates.length === 0) return text("No cleanup candidates found. All entries are healthy!");
        const formatted = candidates.map((c) => `[${c.memory.id}] ${c.reason}\n  ${c.memory.content.slice(0, 100)}`);
        return text(`${candidates.length} cleanup candidates:\n\n${formatted.join("\n\n")}\n\nUse memory_manage action:delete to remove unwanted entries.`);
      }

      case "audit": {
        const candidates = auditMemories({
          include_expired: args.include_expired,
          days_warning: args.days_warning,
          limit: args.limit,
        });
        if (candidates.length === 0) return text("No stale or expiring entries found. All entries are fresh!");
        const formatted = candidates.map((c) => {
          const m = c.memory;
          const meta = [m.category, m.project ? `project:${m.project}` : "global", m.version_context ? `ctx:${m.version_context}` : null, m.valid_until ? `expires:${m.valid_until}` : null].filter(Boolean).join(" | ");
          return `[${m.id}] ${c.reason}\n  (${meta})\n  ${m.content.slice(0, 120)}`;
        });
        return text(`${candidates.length} entries need review:\n\n${formatted.join("\n\n")}\n\nUse memory_manage with action:update/downvote/delete to resolve.`);
      }

      case "consolidate": {
        const groups = await findConsolidationGroups({
          project: args.project,
          threshold: args.threshold,
          limit: args.limit,
        });
        if (groups.length === 0) return text("No consolidation candidates found. Entries are well-separated!");
        const formatted = groups.map((g, gi) => {
          const lines = g.members.map((m, mi) => {
            const label = mi === 0 ? ">>> KEEP" : "    DEL ";
            const meta = [m.category, m.project ? `project:${m.project}` : "global", `score:${m.score}`, `uses:${m.use_count}`].join(" | ");
            return `  ${label} [${m.id}] (${meta})\n           ${m.content.slice(0, 120)}`;
          });
          return `Group ${gi + 1} (${g.members.length} entries, avg similarity: ${g.avg_similarity.toFixed(3)}):\n${lines.join("\n")}`;
        });
        return text(`${groups.length} consolidation groups found:\n\n${formatted.join("\n\n")}\n\nTo merge: update winner with consolidated content, delete the rest.`);
      }

      case "sync": {
        if (!args.operation) return text("Error: operation is required for sync (push/pull/export/rebuild)");
        const result = await syncMemories(args.operation);
        return text(`[${result.operation}] ${result.message}`);
      }

      case "import": {
        if (!args.file_path) return text("Error: file_path is required for import");
        const result = await importMemoryMd(args.file_path, args.project ?? undefined);
        return text(`Imported from ${args.file_path}:\n  Total entries: ${result.total_entries}\n  Created: ${result.created}\n  Duplicates: ${result.duplicates}\n  Near-duplicates: ${result.near_duplicates}`);
      }

      default:
        return text(`Unknown action: ${args.action}`);
    }
  }
);

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
  await saveSearchIndex().catch(() => {});
  closeDb();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
