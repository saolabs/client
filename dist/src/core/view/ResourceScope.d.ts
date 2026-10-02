import type { StateManagerInterface } from '../contracts/ViewStateInterface.js';
export type Cleanup = () => void;
export interface WatchContext {
    readonly signal: AbortSignal;
    /** False after a dependency change, pause, stop, or destroy. */
    readonly current: boolean;
    onCleanup(cleanup: Cleanup): void;
    /** Apply an async result only while this run still owns the scope. */
    commit(update: () => void): boolean;
}
export type WatchCallback = (values: Readonly<Record<string, any>>, context: WatchContext) => void | Cleanup | Promise<void | Cleanup>;
export interface WatchOptions {
    immediate?: boolean;
    /** dom (default) runs after bindings/regions; state runs before regions. */
    flush?: 'state' | 'dom';
}
/** Explicit dependencies and ownership; no global hook order or implicit tracking. */
export declare class ResourceScope {
    private states;
    private afterDom;
    private reportError;
    private records;
    private cleanups;
    private active;
    private destroyed;
    constructor(states: StateManagerInterface, afterDom: (callback: () => void) => Cleanup, reportError?: (error: unknown) => void);
    watch(keys: readonly string[], callback: WatchCallback, options?: WatchOptions): Cleanup;
    /** Own a resource until scope destruction (pause-safe resources only). */
    defer(cleanup: Cleanup): Cleanup;
    resume(): void;
    pause(): void;
    destroy(): void;
    private invalidate;
    private schedule;
    private run;
    private safely;
}
//# sourceMappingURL=ResourceScope.d.ts.map