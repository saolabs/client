import type { LoopContextInterface } from "../contracts/LoopContextInterface";
/**
 * LoopContext — provides loop metadata for @foreach, @for, @while directives.
 *
 * Available properties inside loops:
 *   $loop.index      — 0-based index
 *   $loop.iteration  — 1-based iteration count
 *   $loop.count      — total items (or -1 for @while)
 *   $loop.remaining  — items left
 *   $loop.first      — is first iteration
 *   $loop.last       — is last iteration
 *   $loop.odd        — is odd iteration (1-based)
 *   $loop.even       — is even iteration (1-based)
 *   $loop.depth      — nesting depth (starts at 1)
 *   $loop.parent     — parent LoopContext (for nested loops)
 */
export declare class LoopContext implements LoopContextInterface {
    index: number;
    iteration: number;
    count: number;
    remaining: number;
    first: boolean;
    last: boolean;
    odd: boolean;
    even: boolean;
    depth: number;
    parent: LoopContext | null;
    private type;
    constructor(parent?: LoopContext | null);
    setType(type: 'increment' | 'decrement'): void;
    setCount(count: number): void;
    setCurrentTimes(index: number): void;
    next(): void;
    reset(): void;
    private increment;
    private decrement;
}
//# sourceMappingURL=LoopContext.d.ts.map