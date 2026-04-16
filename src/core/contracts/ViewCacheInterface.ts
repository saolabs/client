// ─── View Cache Interface ────────────────────────────────────────

export interface ViewCacheInterface {
    /** Store a rendered view's DOM state */
    store(viewId: string, element: HTMLElement | DocumentFragment): void;
    /** Retrieve cached DOM for a view (returns null if not cached) */
    retrieve(viewId: string): HTMLElement | DocumentFragment | null;
    /** Check if a view is cached */
    has(viewId: string): boolean;
    /** Remove a specific view from cache */
    remove(viewId: string): void;
    /** Clear all cached views */
    clear(): void;
}
