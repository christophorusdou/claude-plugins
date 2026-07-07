import { recall } from "../retrieval.js";
export function recallMemories(opts) {
    return recall({
        query: opts.query,
        project: opts.project,
        category: opts.category,
        limit: opts.limit ?? 5,
        min_score: opts.min_score,
    });
}
//# sourceMappingURL=recall.js.map