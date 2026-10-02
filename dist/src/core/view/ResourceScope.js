/** Explicit dependencies and ownership; no global hook order or implicit tracking. */
export class ResourceScope {
    constructor(states, afterDom, reportError = error => console.error('[ResourceScope]', error)) {
        this.states = states;
        this.afterDom = afterDom;
        this.reportError = reportError;
        this.records = new Set();
        this.cleanups = new Set();
        this.active = false;
        this.destroyed = false;
    }
    watch(keys, callback, options = {}) {
        if (this.destroyed)
            return () => { };
        const record = {
            keys: [...new Set(keys)], callback, options: { ...options },
            live: true, dirty: options.immediate !== false, off: () => { },
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
            if (!record.live)
                return;
            record.live = false;
            record.off();
            this.invalidate(record);
            this.records.delete(record);
        };
    }
    /** Own a resource until scope destruction (pause-safe resources only). */
    defer(cleanup) {
        let live = true;
        const dispose = () => {
            if (!live)
                return;
            live = false;
            this.cleanups.delete(dispose);
            this.safely(cleanup);
        };
        if (this.destroyed)
            dispose();
        else
            this.cleanups.add(dispose);
        return dispose;
    }
    resume() {
        if (this.destroyed || this.active)
            return;
        this.active = true;
        for (const record of this.records)
            this.schedule(record);
    }
    pause() {
        if (!this.active)
            return;
        this.active = false;
        for (const record of this.records) {
            if (record.disposeRun || record.cancelQueued)
                record.dirty = true;
            this.invalidate(record);
        }
    }
    destroy() {
        if (this.destroyed)
            return;
        this.destroyed = true;
        this.active = false;
        for (const record of this.records) {
            record.live = false;
            record.off();
            this.invalidate(record);
        }
        this.records.clear();
        for (const cleanup of Array.from(this.cleanups).reverse())
            cleanup();
    }
    invalidate(record) {
        record.cancelQueued?.();
        record.cancelQueued = undefined;
        const dispose = record.disposeRun;
        record.disposeRun = undefined;
        dispose?.();
    }
    schedule(record) {
        if (!this.active || !record.live || !record.dirty || record.cancelQueued)
            return;
        if (record.options.flush === 'state')
            this.run(record);
        else
            record.cancelQueued = this.afterDom(() => {
                record.cancelQueued = undefined;
                this.run(record);
            });
    }
    run(record) {
        if (!this.active || !record.live || !record.dirty)
            return;
        record.dirty = false;
        const controller = new AbortController();
        const cleanups = [];
        const versions = record.keys.map(key => this.states.getStateVersion(key));
        let current = true;
        const isCurrent = () => current && record.keys.every((key, i) => this.states.getStateVersion(key) === versions[i]);
        const onCleanup = (cleanup) => {
            if (isCurrent())
                cleanups.push(cleanup);
            else
                this.safely(cleanup);
        };
        record.disposeRun = () => {
            if (!current)
                return;
            current = false;
            controller.abort();
            for (const cleanup of cleanups.splice(0).reverse())
                this.safely(cleanup);
        };
        const context = {
            signal: controller.signal,
            get current() { return isCurrent(); },
            onCleanup,
            commit: update => {
                if (!isCurrent())
                    return false;
                update();
                return true;
            },
        };
        const values = {};
        try {
            for (const key of record.keys)
                values[key] = this.states.getStateByKey(key);
            const result = record.callback(Object.freeze(values), context);
            if (typeof result === 'function')
                onCleanup(result);
            else if (result)
                Promise.resolve(result).then(cleanup => {
                    if (typeof cleanup === 'function')
                        onCleanup(cleanup);
                }, error => {
                    if (isCurrent() && !controller.signal.aborted)
                        this.reportError(error);
                });
        }
        catch (error) {
            const dispose = record.disposeRun;
            record.disposeRun = undefined;
            dispose?.();
            this.reportError(error);
        }
    }
    safely(cleanup) {
        try {
            cleanup();
        }
        catch (error) {
            this.reportError(error);
        }
    }
}
//# sourceMappingURL=ResourceScope.js.map