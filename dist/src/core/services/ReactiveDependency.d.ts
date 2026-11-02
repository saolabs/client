/** A service can participate in computed evaluation without exposing its storage. */
export interface ReactiveDependency {
    subscribe(callback: () => void): () => void;
}
export declare function trackDependency(source: ReactiveDependency): void;
/** Reconciles subscriptions after each synchronous evaluation, including branch changes. */
export declare class DependencyTracker {
    private readonly invalidate;
    private subscriptions;
    private destroyed;
    constructor(invalidate: () => void);
    evaluate<T>(read: () => T): T;
    destroy(): void;
}
//# sourceMappingURL=ReactiveDependency.d.ts.map