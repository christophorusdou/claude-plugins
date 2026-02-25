import { getDb } from "../db.js";
import { removeFromIndex, saveSearchIndex } from "../search-index.js";
export async function deleteMemory(id) {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db.prepare("SELECT id FROM memories WHERE id = ?").get(id);
    if (!existing)
        return false;
    // Log deletion event before deleting
    db.prepare("INSERT INTO memory_events(memory_id, event_type, created_at) VALUES (?, 'deleted', ?)").run(id, now);
    // Remove from Orama index
    await removeFromIndex(id);
    await saveSearchIndex();
    // Delete memory from SQLite
    db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    return true;
}
//# sourceMappingURL=delete.js.map