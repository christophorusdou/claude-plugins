import Database from "better-sqlite3";
/** MEMORY_DATA_DIR override exists so migration/tests can run against a DB copy. */
export declare function getDataDir(): string;
export declare function getDb(): Database.Database;
export declare function checkpoint(mode?: "PASSIVE" | "TRUNCATE"): void;
export declare function closeDb(): void;
/** Test-only: reset module state so a new MEMORY_DATA_DIR takes effect. */
export declare function resetDbForTests(): void;
//# sourceMappingURL=db.d.ts.map