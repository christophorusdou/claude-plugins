export interface SyncResult {
    operation: string;
    message: string;
}
export declare function syncMemories(operation: "push" | "pull" | "export" | "rebuild"): Promise<SyncResult>;
//# sourceMappingURL=sync.d.ts.map