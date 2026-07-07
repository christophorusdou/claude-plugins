import { getDb } from "../db.js";
import { rowToMemory } from "../types.js";
/** Fetch one memory in full (recall output truncates) plus its recent history. */
export function getMemory(id) {
    const db = getDb();
    const row = db
        .prepare("SELECT * FROM memories WHERE id = ?")
        .get(id);
    if (!row)
        return null;
    const events = db
        .prepare("SELECT * FROM memory_events WHERE memory_id = ? ORDER BY id DESC LIMIT 10")
        .all(id);
    return { memory: rowToMemory(row), events };
}
//# sourceMappingURL=get.js.map