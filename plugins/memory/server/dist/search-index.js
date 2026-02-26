import { create, insert, remove, search, count } from "@orama/orama";
import { persistToFile, restoreFromFile } from "@orama/plugin-data-persistence/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getDataDir } from "./db.js";
const INDEX_FILE = "search-index.json";
const SCHEMA = {
    content: "string",
    embedding: "vector[384]",
    category: "string",
    project: "string",
    memory_id: "string",
};
let _index = null;
function getIndexPath() {
    return join(getDataDir(), INDEX_FILE);
}
export async function getSearchIndex() {
    if (_index)
        return _index;
    const indexPath = getIndexPath();
    if (existsSync(indexPath)) {
        try {
            _index = await restoreFromFile("json", indexPath);
            return _index;
        }
        catch {
            // Corrupted index — rebuild
        }
    }
    _index = create({ schema: SCHEMA });
    return _index;
}
export async function saveSearchIndex() {
    if (!_index)
        return;
    await persistToFile(_index, "json", getIndexPath());
}
export async function indexMemory(memoryId, content, embedding, category, project) {
    const index = await getSearchIndex();
    await insert(index, {
        id: memoryId,
        content,
        embedding: Array.from(embedding),
        category,
        project: project || "",
        memory_id: memoryId,
    });
}
export async function removeFromIndex(memoryId) {
    const index = await getSearchIndex();
    try {
        await remove(index, memoryId);
    }
    catch {
        // Document might not exist in index
    }
}
export async function updateInIndex(memoryId, content, embedding, category, project) {
    await removeFromIndex(memoryId);
    await indexMemory(memoryId, content, embedding, category, project);
}
export async function hybridSearch(query, queryEmbedding, opts = {}) {
    const index = await getSearchIndex();
    const { limit = 20, similarity = 0.5 } = opts;
    const where = {};
    if (opts.project !== undefined) {
        // null means "global only" (empty string in Orama)
        // string means "this specific project"
        where.project = { eq: opts.project === null ? "" : opts.project };
    }
    if (opts.category) {
        where.category = { eq: opts.category };
    }
    const results = await search(index, {
        mode: "hybrid",
        term: query,
        vector: {
            value: Array.from(queryEmbedding),
            property: "embedding",
        },
        similarity,
        limit,
        ...(Object.keys(where).length > 0 ? { where } : {}),
    });
    return results.hits.map((hit) => ({
        memory_id: hit.document.memory_id,
        score: hit.score,
    }));
}
export async function vectorSearch(queryEmbedding, opts = {}) {
    const index = await getSearchIndex();
    const { limit = 5, similarity = 0.5 } = opts;
    const where = {};
    if (opts.project !== undefined) {
        where.project = { eq: opts.project === null ? "" : opts.project };
    }
    const results = await search(index, {
        mode: "vector",
        vector: {
            value: Array.from(queryEmbedding),
            property: "embedding",
        },
        similarity,
        limit,
        ...(Object.keys(where).length > 0 ? { where } : {}),
    });
    return results.hits.map((hit) => ({
        memory_id: hit.document.memory_id,
        score: hit.score,
    }));
}
export async function getIndexCount() {
    const index = await getSearchIndex();
    return count(index);
}
//# sourceMappingURL=search-index.js.map