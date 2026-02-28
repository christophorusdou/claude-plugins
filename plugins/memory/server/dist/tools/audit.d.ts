import type { CleanupCandidate } from "../types.js";
interface AuditOptions {
    include_expired?: boolean;
    days_warning?: number;
    limit?: number;
}
export declare function auditMemories(opts?: AuditOptions): CleanupCandidate[];
export {};
//# sourceMappingURL=audit.d.ts.map