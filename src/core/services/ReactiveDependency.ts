/** A service can participate in computed evaluation without exposing its storage. */
export interface ReactiveDependency {
    subscribe(callback: () => void): () => void;
}

let collecting: Set<ReactiveDependency> | null = null;

export function trackDependency(source: ReactiveDependency): void {
    collecting?.add(source);
}

/** Reconciles subscriptions after each synchronous evaluation, including branch changes. */
export class DependencyTracker {
    private subscriptions = new Map<ReactiveDependency, () => void>();
    private destroyed = false;

    constructor(private readonly invalidate: () => void) {}

    evaluate<T>(read: () => T): T {
        const previous = collecting;
        const sources = new Set<ReactiveDependency>();
        collecting = sources;
        try { return read(); }
        finally {
            collecting = previous;
            if (!this.destroyed) {
                for (const [source, off] of this.subscriptions) {
                    if (!sources.has(source)) { off(); this.subscriptions.delete(source); }
                }
                for (const source of sources) {
                    if (!this.subscriptions.has(source)) {
                        this.subscriptions.set(source, source.subscribe(() => {
                            if (!this.destroyed) this.invalidate();
                        }));
                    }
                }
            }
        }
    }

    destroy(): void {
        this.destroyed = true;
        for (const off of this.subscriptions.values()) off();
        this.subscriptions.clear();
    }
}
