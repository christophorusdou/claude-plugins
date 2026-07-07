import { getDb } from "../db.js";
import { gitSync } from "../gitsync.js";

export interface SyncResult {
  operation: string;
  message: string;
}

export function syncMemories(
  operation: "push" | "pull" | "status" | "reindex"
): SyncResult {
  switch (operation) {
    case "push":
      return { operation: "push", message: gitSync("push") };

    case "pull":
      return { operation: "pull", message: gitSync("pull") };

    case "status":
      return { operation: "status", message: gitSync("status") };

    case "reindex": {
      // FTS5 self-heal: rebuilds the index from the content table. Only needed
      // after suspected index corruption — triggers keep it in sync normally.
      const db = getDb();
      db.exec("INSERT INTO memories_fts(memories_fts) VALUES('rebuild')");
      const memories = (
        db.prepare("SELECT COUNT(*) AS c FROM memories").get() as { c: number }
      ).c;
      const indexed = (
        db.prepare("SELECT COUNT(*) AS c FROM memories_fts").get() as { c: number }
      ).c;
      return {
        operation: "reindex",
        message: `Rebuilt FTS index: ${indexed} indexed / ${memories} rows${
          indexed === memories ? "" : " — MISMATCH, investigate"
        }`,
      };
    }
  }
}
