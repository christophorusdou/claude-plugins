import type { Memory } from "../types.js";
interface VoteResult {
    memory: Memory;
    new_score: number;
    new_confidence: number;
}
export declare function upvoteMemory(id: string, detail?: string): VoteResult | null;
export declare function downvoteMemory(id: string, detail?: string): VoteResult | null;
export {};
//# sourceMappingURL=vote.d.ts.map