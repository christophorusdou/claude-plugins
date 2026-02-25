import { getDb } from "../db.js";
import type { MemoryStats } from "../types.js";

export function getStats(): MemoryStats {
  const db = getDb();

  const total = (
    db.prepare("SELECT COUNT(*) as count FROM memories").get() as {
      count: number;
    }
  ).count;

  const byCategoryRows = db
    .prepare(
      "SELECT category, COUNT(*) as count FROM memories GROUP BY category"
    )
    .all() as Array<{ category: string; count: number }>;
  const by_category: Record<string, number> = {};
  for (const row of byCategoryRows) {
    by_category[row.category] = row.count;
  }

  const byProjectRows = db
    .prepare(
      "SELECT COALESCE(project, '(global)') as project, COUNT(*) as count FROM memories GROUP BY project"
    )
    .all() as Array<{ project: string; count: number }>;
  const by_project: Record<string, number> = {};
  for (const row of byProjectRows) {
    by_project[row.project] = row.count;
  }

  const bySourceRows = db
    .prepare(
      "SELECT source, COUNT(*) as count FROM memories GROUP BY source"
    )
    .all() as Array<{ source: string; count: number }>;
  const by_source: Record<string, number> = {};
  for (const row of bySourceRows) {
    by_source[row.source] = row.count;
  }

  const negative = (
    db.prepare("SELECT COUNT(*) as count FROM memories WHERE score < 0").get() as {
      count: number;
    }
  ).count;
  const zero = (
    db.prepare("SELECT COUNT(*) as count FROM memories WHERE score = 0").get() as {
      count: number;
    }
  ).count;
  const positive = (
    db.prepare(
      "SELECT COUNT(*) as count FROM memories WHERE score > 0 AND score < 5"
    ).get() as { count: number }
  ).count;
  const highly_rated = (
    db.prepare("SELECT COUNT(*) as count FROM memories WHERE score >= 5").get() as {
      count: number;
    }
  ).count;

  return {
    total,
    by_category,
    by_project,
    by_source,
    score_distribution: { negative, zero, positive, highly_rated },
  };
}
