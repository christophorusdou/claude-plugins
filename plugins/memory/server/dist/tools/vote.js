import { getDb, checkpoint } from "../db.js";
import { appendJournal } from "../journal.js";
import { rowToMemory } from "../types.js";
/**
 * v2 downvote semantics: score/confidence drop as before, and sustained
 * negative signal demotes through the lifecycle instead of v1's valid_until
 * stamp (which pinned a permanent freshness penalty no upvote could clear):
 *   score ≤ −2 → stale, score ≤ −4 → archived.
 * Upvote reactivates to active (unchanged).
 */
function vote(id, direction, detail) {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db
        .prepare("SELECT * FROM memories WHERE id = ?")
        .get(id);
    if (!existing)
        return null;
    const scoreDelta = direction === "up" ? 1 : -1;
    const confidenceDelta = direction === "up" ? 0.05 : -0.05;
    const newScore = existing.score + scoreDelta;
    const newConfidence = Math.max(0, Math.min(1, existing.confidence + confidenceDelta));
    const eventType = direction === "up" ? "upvoted" : "downvoted";
    let newState = existing.lifecycle_state;
    if (direction === "down" && existing.lifecycle_state !== "merged") {
        if (newScore <= -4)
            newState = "archived";
        else if (newScore <= -2 && existing.lifecycle_state === "active")
            newState = "stale";
    }
    else if (direction === "up" && existing.lifecycle_state !== "merged") {
        newState = "active";
    }
    const stateChanged = newState !== existing.lifecycle_state;
    const tx = db.transaction(() => {
        db.prepare("UPDATE memories SET score = ?, confidence = ?, updated_at = ?, lifecycle_state = ? WHERE id = ?").run(newScore, newConfidence, now, newState, id);
        db.prepare("INSERT INTO memory_events(memory_id, event_type, detail, created_at) VALUES (?, ?, ?, ?)").run(id, eventType, detail ?? null, now);
        if (stateChanged) {
            db.prepare("INSERT INTO memory_events(memory_id, event_type, detail, created_at) VALUES (?, 'aged', ?, ?)").run(id, `${existing.lifecycle_state}→${newState} (${eventType})`, now);
        }
    });
    tx();
    appendJournal("vote", {
        id,
        direction,
        new_score: newScore,
        lifecycle_state: newState,
        detail: detail ?? null,
    });
    checkpoint();
    const updated = db
        .prepare("SELECT * FROM memories WHERE id = ?")
        .get(id);
    return {
        memory: rowToMemory(updated),
        new_score: updated.score,
        new_confidence: updated.confidence,
        lifecycle_changed: stateChanged ? `${existing.lifecycle_state}→${newState}` : undefined,
    };
}
export function upvoteMemory(id, detail) {
    return vote(id, "up", detail);
}
export function downvoteMemory(id, detail) {
    return vote(id, "down", detail);
}
//# sourceMappingURL=vote.js.map