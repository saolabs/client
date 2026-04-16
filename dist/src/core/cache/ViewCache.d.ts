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
export declare class ViewCache implements ViewCacheInterface {
    private cache;
    /** Maximum cached views (LRU eviction when exceeded) */
    private maxSize;
    /** Access order tracking for LRU */
    private accessOrder;
    constructor(maxSize?: number);
    /** Store a view's DOM state */
    store(viewId: string, element: HTMLElement | DocumentFragment): void;
    /** Retrieve cached DOM — returns null if not cached */
    retrieve(viewId: string): HTMLElement | DocumentFragment | null;
    /** Check if a view is cached */
    has(viewId: string): boolean;
    /** Remove a specific view from cache */
    remove(viewId: string): void;
    /** Clear all cached views */
    clear(): void;
    /** Get number of cached views */
    get size(): number;
    /** Get all cached view IDs */
    keys(): string[];
    /** Move viewId to end of access order (most recently used) */
    private touchAccess;
    /** Remove the least recently used cached view */
    private evictOldest;
}
//# sourceMappingURL=ViewCache.d.ts.map