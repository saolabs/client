import type { ViewCacheInterface } from "../contracts/ViewCacheInterface";

/**
 * ViewCache — stores rendered view DOM for instant restore on navigation.
 * 
 * When a user navigates away from a page, the view's DOM is detached and
 * stored in a DocumentFragment. When navigating back, the DOM is
 * re-attached instead of re-rendered — preserving form inputs, scroll
 * positions, and in-progress user work.
 * 
 * Used by the router/BlockManager to implement "keep-alive" behavior.
 * 
 * @example
 * // Router navigates away from 'home'
 * cache.store('home', homeRootElement);
 * 
 * // Router navigates back to 'home'
 * const cached = cache.retrieve('home');
 * if (cached) container.appendChild(cached); // instant restore!
 */
export class ViewCache implements ViewCacheInterface {
    private cache: Map<string, HTMLElement | DocumentFragment> = new Map();

    /** Maximum cached views (LRU eviction when exceeded) */
    private maxSize: number;

    /** Access order tracking for LRU */
    private accessOrder: string[] = [];

    constructor(maxSize: number = 10) {
        this.maxSize = maxSize;
    }

    /** Store a view's DOM state */
    store(viewId: string, element: HTMLElement | DocumentFragment): void {
        // If already cached, update
        if (this.cache.has(viewId)) {
            this.cache.set(viewId, element);
            this.touchAccess(viewId);
            return;
        }

        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }

        this.cache.set(viewId, element);
        this.accessOrder.push(viewId);
    }

    /** Retrieve cached DOM — returns null if not cached */
    retrieve(viewId: string): HTMLElement | DocumentFragment | null {
        const cached = this.cache.get(viewId) ?? null;
        if (cached) {
            this.touchAccess(viewId);
        }
        return cached;
    }

    /** Check if a view is cached */
    has(viewId: string): boolean {
        return this.cache.has(viewId);
    }

    /** Remove a specific view from cache */
    remove(viewId: string): void {
        this.cache.delete(viewId);
        this.accessOrder = this.accessOrder.filter(id => id !== viewId);
    }

    /** Clear all cached views */
    clear(): void {
        this.cache.clear();
        this.accessOrder = [];
    }

    /** Get number of cached views */
    get size(): number {
        return this.cache.size;
    }

    /** Get all cached view IDs */
    keys(): string[] {
        return [...this.cache.keys()];
    }

    // ─── Private ────────────────────────────────────────────────

    /** Move viewId to end of access order (most recently used) */
    private touchAccess(viewId: string): void {
        this.accessOrder = this.accessOrder.filter(id => id !== viewId);
        this.accessOrder.push(viewId);
    }

    /** Remove the least recently used cached view */
    private evictOldest(): void {
        if (this.accessOrder.length === 0) return;
        const oldest = this.accessOrder.shift()!;
        this.cache.delete(oldest);
    }
}
