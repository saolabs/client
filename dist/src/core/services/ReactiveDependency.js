let collecting = null;
export function trackDependency(source) {
    collecting?.add(source);
}
/** Reconciles subscriptions after each synchronous evaluation, including branch changes. */
export class DependencyTracker {
    constructor(invalidate) {
        this.invalidate = invalidate;
        this.subscriptions = new Map();
        this.destroyed = false;
    }
    evaluate(read) {
        const previous = collecting;
        const sources = new Set();
        collecting = sources;
        try {
            return read();
        }
        finally {
            collecting = previous;
            if (!this.destroyed) {
                for (const [source, off] of this.subscriptions) {
                    if (!sources.has(source)) {
                        off();
                        this.subscriptions.delete(source);
                    }
                }
                for (const source of sources) {
                    if (!this.subscriptions.has(source)) {
                        this.subscriptions.set(source, source.subscribe(() => {
                            if (!this.destroyed)
                                this.invalidate();
                        }));
                    }
                }
            }
        }
    }
    destroy() {
        this.destroyed = true;
        for (const off of this.subscriptions.values())
            off();
        this.subscriptions.clear();
    }
}
//# sourceMappingURL=ReactiveDependency.js.map