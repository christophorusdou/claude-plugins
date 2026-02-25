import { createHash } from "node:crypto";
import { getDb } from "../db.js";
import { embed } from "../embeddings.js";
import { updateInIndex, saveSearchIndex } from "../search-index.js";
import { rowToMemory } from "../types.js";
export async function updateMemory(opts) {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db
        .prepare("SELECT * FROM memories WHERE id = ?")
        .get(opts.id);
    if (!existing)
        return null;
    const sets = ["updated_at = ?"];
    const params = [now];
    if (opts.content !== undefined) {
        const hash = createHash("sha256").update(opts.content.trim()).digest("hex");
        sets.push("content = ?", "content_hash = ?");
        params.push(opts.content, hash);
    }
    if (opts.category !== undefined) {
        sets.push("category = ?");
        params.push(opts.category);
    }
    if (opts.project !== undefined) {
        sets.push("project = ?");
        params.push(opts.project);
    }
    if (opts.tags !== undefined) {
        sets.push("tags = ?");
        params.push(JSON.stringify(opts.tags));
    }
    if (opts.triggers !== undefined) {
        sets.push("triggers = ?");
        params.push(JSON.stringify(opts.triggers));
    }
    params.push(opts.id);
    db.prepare(`UPDATE memories SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    // Re-index in Orama if content, category, or project changed
    if (opts.content !== undefined || opts.category !== undefined || opts.project !== undefined) {
        const updated = db
            .prepare("SELECT * FROM memories WHERE id = ?")
            .get(opts.id);
        const content = updated.content;
        const embedding = await embed(content);
        await updateInIndex(opts.id, content, embedding, updated.category, updated.project ?? "");
        await saveSearchIndex();
    }
    // Log event
    db.prepare("INSERT INTO memory_events(memory_id, event_type, detail, created_at) VALUES (?, 'updated', ?, ?)").run(opts.id, JSON.stringify(opts), now);
    const updatedRow = db
        .prepare("SELECT * FROM memories WHERE id = ?")
        .get(opts.id);
    return rowToMemory(updatedRow);
}
//# sourceMappingURL=update.js.map