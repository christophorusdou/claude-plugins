import type { Memory, MemoryEvent } from "../types.js";
export interface GetResult {
    memory: Memory;
    events: MemoryEvent[];
}
/** Fetch one memory in full (recall output truncates) plus its recent history. */
export declare function getMemory(id: string): GetResult | null;
//# sourceMappingURL=get.d.ts.map