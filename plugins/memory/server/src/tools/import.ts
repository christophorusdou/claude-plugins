import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { storeMemory } from "./store.js";
import type { StoreResult, MemoryCategory } from "../types.js";

interface ImportResult {
  total_entries: number;
  created: number;
  duplicates: number;
  near_duplicates: number;
  entries: Array<{
    content: string;
    status: StoreResult["status"];
    id: string;
  }>;
}

const CATEGORY_HINTS: Record<string, MemoryCategory> = {
  pattern: "pattern",
  patterns: "pattern",
  convention: "pattern",
  conventions: "pattern",
  gotcha: "gotcha",
  gotchas: "gotcha",
  "watch out": "gotcha",
  caveat: "gotcha",
  caveats: "gotcha",
  preference: "preference",
  preferences: "preference",
  decision: "decision",
  decisions: "decision",
  architecture: "decision",
  debug: "debug-insight",
  debugging: "debug-insight",
  troubleshooting: "debug-insight",
};

function detectCategory(heading: string): MemoryCategory | undefined {
  const lower = heading.toLowerCase();
  for (const [hint, cat] of Object.entries(CATEGORY_HINTS)) {
    if (lower.includes(hint)) return cat;
  }
  return undefined;
}

/**
 * Parse a MEMORY.md file into individual memory entries.
 * Splits by ## headers. Each section becomes a memory entry.
 * Bullet points within a section become individual memories.
 */
export async function importMemoryMd(
  filePath: string,
  project?: string
): Promise<ImportResult> {
  const content = readFileSync(filePath, "utf-8");
  const fileName = basename(filePath);

  // Detect project from path if not provided
  const inferredProject =
    project ?? inferProjectFromPath(filePath);

  const entries: Array<{ content: string; category?: MemoryCategory }> = [];

  // Split by ## headers
  const sections = content.split(/^## /m);
  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split("\n");
    const heading = lines[0].trim();
    const headingCategory = detectCategory(heading);

    // Extract bullet points as individual memories
    const body = lines.slice(1).join("\n");
    const bullets = body.match(/^[-*] .+$/gm);

    if (bullets && bullets.length > 0) {
      for (const bullet of bullets) {
        const text = bullet.replace(/^[-*] /, "").trim();
        if (text.length > 10) {
          // Skip very short entries
          entries.push({ content: text, category: headingCategory });
        }
      }
    } else {
      // No bullets — use the whole section as one entry
      const text = body.trim();
      if (text.length > 10) {
        entries.push({ content: text, category: headingCategory });
      }
    }
  }

  const result: ImportResult = {
    total_entries: entries.length,
    created: 0,
    duplicates: 0,
    near_duplicates: 0,
    entries: [],
  };

  for (const entry of entries) {
    const storeResult = await storeMemory({
      content: entry.content,
      category: entry.category,
      project: inferredProject,
      source: "imported",
      source_detail: `imported from ${fileName}`,
    });

    result.entries.push({
      content:
        entry.content.length > 80
          ? entry.content.slice(0, 80) + "..."
          : entry.content,
      status: storeResult.status,
      id: storeResult.id,
    });

    if (storeResult.status === "created") result.created++;
    else if (storeResult.status === "duplicate") result.duplicates++;
    else if (storeResult.status === "near-duplicate") result.near_duplicates++;
  }

  return result;
}

function inferProjectFromPath(filePath: string): string | null {
  // Look for common patterns like /projects/foo/ or /.claude/projects/foo/
  const match = filePath.match(
    /\/projects\/([^/]+)\//
  );
  if (match) return match[1];
  return null;
}
