import { exportToJsonl, importFromJsonl, gitSync, rebuildSearchIndex } from "../sync.js";
export async function syncMemories(operation) {
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
//# sourceMappingURL=sync.js.map