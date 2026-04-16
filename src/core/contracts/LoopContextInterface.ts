// ─── LoopContext Interface ───────────────────────────────────────

export interface LoopContextInterface {
    index: number;
    iteration: number;
    count: number;
    remaining: number;
    first: boolean;
    last: boolean;
    odd: boolean;
    even: boolean;
    depth: number;
    parent: LoopContextInterface | null;
    next(): void;
}
