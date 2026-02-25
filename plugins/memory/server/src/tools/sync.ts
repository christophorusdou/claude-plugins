import { exportToJsonl, importFromJsonl, gitSync, rebuildSearchIndex } from "../sync.js";

export interface SyncResult {
  operation: string;
  message: string;
}

export async function syncMemories(
  operation: "push" | "pull" | "export" | "rebuild"
): Promise<SyncResult> {
  switch (operation) {
    case "push":
      return { operation: "push", message: gitSync("push") };

    case "pull": {
      const pullMsg = gitSync("pull");
      const result = await importFromJsonl();
      return {
        operation: "pull",
        message: `${pullMsg}\nRebuilt DB: ${result.imported} imported, ${result.skipped} skipped`,
      };
    }

    case "export": {
      const count = exportToJsonl();
      return {
        operation: "export",
        message: `Exported ${count} memories to JSONL`,
      };
    }

    case "rebuild": {
      const count = await rebuildSearchIndex();
      return {
        operation: "rebuild",
        message: `Rebuilt search index from SQLite: ${count} memories indexed`,
      };
    }
  }
}
