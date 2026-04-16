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
export class ViewCache {
    constructor(maxSize = 10) {
        this.cache = new Map();
        /** Access order tracking for LRU */
        this.accessOrder = [];
        this.maxSize = maxSize;
    }
    /** Store a view's DOM state */
    store(viewId, element) {
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
    retrieve(viewId) {
        const cached = this.cache.get(viewId) ?? null;
        if (cached) {
            this.touchAccess(viewId);
        }
        return cached;
    }
    /** Check if a view is cached */
    has(viewId) {
        return this.cache.has(viewId);
    }
    /** Remove a specific view from cache */
    remove(viewId) {
        this.cache.delete(viewId);
        this.accessOrder = this.accessOrder.filter(id => id !== viewId);
    }
    /** Clear all cached views */
    clear() {
        this.cache.clear();
        this.accessOrder = [];
    }
    /** Get number of cached views */
    get size() {
        return this.cache.size;
    }
    /** Get all cached view IDs */
    keys() {
        return [...this.cache.keys()];
    }
    // ─── Private ────────────────────────────────────────────────
    /** Move viewId to end of access order (most recently used) */
    touchAccess(viewId) {
        this.accessOrder = this.accessOrder.filter(id => id !== viewId);
        this.accessOrder.push(viewId);
    }
    /** Remove the least recently used cached view */
    evictOldest() {
        if (this.accessOrder.length === 0)
            return;
        const oldest = this.accessOrder.shift();
        this.cache.delete(oldest);
    }
}
//# sourceMappingURL=ViewCache.js.map