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
export type WatchCallback = (values: Readonly<Record<string, any>>, context: WatchContext) =>
    void | Cleanup | Promise<void | Cleanup>;
export interface WatchOptions {
    immediate?: boolean;
    /** dom (default) runs after bindings/regions; state runs before regions. */
    flush?: 'state' | 'dom';
}
type WatchRecord = {
    keys: string[];
    callback: WatchCallback;
    options: WatchOptions;
    live: boolean;
    dirty: boolean;
    cancelQueued?: Cleanup;
    disposeRun?: Cleanup;
    off: Cleanup;
};

/** Explicit dependencies and ownership; no global hook order or implicit tracking. */
export class ResourceScope {
    private records = new Set<WatchRecord>();
    private cleanups = new Set<Cleanup>();
    private active = false;
    private destroyed = false;

    constructor(
        private states: StateManagerInterface,
        private afterDom: (callback: () => void) => Cleanup,
        private reportError: (error: unknown) => void = error => console.error('[ResourceScope]', error),
    ) {}

    watch(keys: readonly string[], callback: WatchCallback, options: WatchOptions = {}): Cleanup {
        if (this.destroyed) return () => {};
        const record: WatchRecord = {
            keys: [...new Set(keys)], callback, options: { ...options },
            live: true, dirty: options.immediate !== false, off: () => {},
        };
        record.off = this.states.subscribe(record.keys, () => {
            // Abort stale work immediately, even when the next run waits for DOM.
            this.invalidate(record);
            record.dirty = true;
            this.schedule(record);
        });
        this.records.add(record);
        this.schedule(record);
        return () => {
            if (!record.live) return;
            record.live = false;
            record.off();
            this.invalidate(record);
            this.records.delete(record);
        };
    }

    /** Own a resource until scope destruction (pause-safe resources only). */
    defer(cleanup: Cleanup): Cleanup {
        let live = true;
        const dispose = () => {
            if (!live) return;
            live = false;
            this.cleanups.delete(dispose);
            this.safely(cleanup);
        };
        if (this.destroyed) dispose();
        else this.cleanups.add(dispose);
        return dispose;
    }

    resume(): void {
        if (this.destroyed || this.active) return;
        this.active = true;
        for (const record of this.records) this.schedule(record);
    }

    pause(): void {
        if (!this.active) return;
        this.active = false;
        for (const record of this.records) {
            if (record.disposeRun || record.cancelQueued) record.dirty = true;
            this.invalidate(record);
        }
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.active = false;
        for (const record of this.records) {
            record.live = false;
            record.off();
            this.invalidate(record);
        }
        this.records.clear();
        for (const cleanup of Array.from(this.cleanups).reverse()) cleanup();
    }

    private invalidate(record: WatchRecord): void {
        record.cancelQueued?.();
        record.cancelQueued = undefined;
        const dispose = record.disposeRun;
        record.disposeRun = undefined;
        dispose?.();
    }

    private schedule(record: WatchRecord): void {
        if (!this.active || !record.live || !record.dirty || record.cancelQueued) return;
        if (record.options.flush === 'state') this.run(record);
        else record.cancelQueued = this.afterDom(() => {
            record.cancelQueued = undefined;
            this.run(record);
        });
    }

    private run(record: WatchRecord): void {
        if (!this.active || !record.live || !record.dirty) return;
        record.dirty = false;
        const controller = new AbortController();
        const cleanups: Cleanup[] = [];
        const versions = record.keys.map(key => this.states.getStateVersion(key));
        let current = true;
        const isCurrent = () => current && record.keys.every((key, i) => this.states.getStateVersion(key) === versions[i]);
        const onCleanup = (cleanup: Cleanup) => {
            if (isCurrent()) cleanups.push(cleanup);
            else this.safely(cleanup);
        };
        record.disposeRun = () => {
            if (!current) return;
            current = false;
            controller.abort();
            for (const cleanup of cleanups.splice(0).reverse()) this.safely(cleanup);
        };
        const context: WatchContext = {
            signal: controller.signal,
            get current() { return isCurrent(); },
            onCleanup,
            commit: update => {
                if (!isCurrent()) return false;
                update();
                return true;
            },
        };
        const values: Record<string, any> = {};
        try {
            for (const key of record.keys) values[key] = this.states.getStateByKey(key);
            const result = record.callback(Object.freeze(values), context);
            if (typeof result === 'function') onCleanup(result);
            else if (result) Promise.resolve(result).then(cleanup => {
                if (typeof cleanup === 'function') onCleanup(cleanup);
            }, error => {
                if (isCurrent() && !controller.signal.aborted) this.reportError(error);
            });
        } catch (error) {
            const dispose = record.disposeRun;
            record.disposeRun = undefined;
            dispose?.();
            this.reportError(error);
        }
    }

    private safely(cleanup: Cleanup): void {
        try { cleanup(); } catch (error) { this.reportError(error); }
    }
}
