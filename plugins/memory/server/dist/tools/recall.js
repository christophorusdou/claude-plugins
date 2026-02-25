import { recall } from "../retrieval.js";
export async function recallMemories(opts) {
    return recall({
        query: opts.query,
        project: opts.project,
        category: opts.category,
        limit: opts.limit ?? 10,
        min_score: opts.min_score,
    });
}
//# sourceMappingURL=recall.js.map