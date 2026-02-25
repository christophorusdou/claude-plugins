import { getDb } from "../db.js";
export function getStats() {
    const db = getDb();
    const total = db.prepare("SELECT COUNT(*) as count FROM memories").get().count;
    const byCategoryRows = db
        .prepare("SELECT category, COUNT(*) as count FROM memories GROUP BY category")
        .all();
    const by_category = {};
    for (const row of byCategoryRows) {
        by_category[row.category] = row.count;
    }
    const byProjectRows = db
        .prepare("SELECT COALESCE(project, '(global)') as project, COUNT(*) as count FROM memories GROUP BY project")
        .all();
    const by_project = {};
    for (const row of byProjectRows) {
        by_project[row.project] = row.count;
    }
    const bySourceRows = db
        .prepare("SELECT source, COUNT(*) as count FROM memories GROUP BY source")
        .all();
    const by_source = {};
    for (const row of bySourceRows) {
        by_source[row.source] = row.count;
    }
    const negative = db.prepare("SELECT COUNT(*) as count FROM memories WHERE score < 0").get().count;
    const zero = db.prepare("SELECT COUNT(*) as count FROM memories WHERE score = 0").get().count;
    const positive = db.prepare("SELECT COUNT(*) as count FROM memories WHERE score > 0 AND score < 5").get().count;
    const highly_rated = db.prepare("SELECT COUNT(*) as count FROM memories WHERE score >= 5").get().count;
    return {
        total,
        by_category,
        by_project,
        by_source,
        score_distribution: { negative, zero, positive, highly_rated },
    };
}
//# sourceMappingURL=stats.js.map