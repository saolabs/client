/**
 * StoreService — In-memory reactive key-value store.
 *
 * Features:
 *   - get/set/has/remove with TTL (minutes)
 *   - Subscribe to single or multiple keys (batched via microtask)
 *   - Expiration callbacks (onExpire)
 *   - Lazy expiration on access + periodic batch cleanup
 *   - Dynamic property access: store.user === store.get('user')
 *
 * Register via DI:
 *   app.singleton('store', StoreService);
 */
export declare class StoreService {
    static instances: Map<string, StoreService>;
    static getInstance(key?: string): StoreService;
    static instance(key?: string): StoreService;
    static removeInstance(key?: string): void;
    private data;
    private ttlMap;
    private listeners;
    private multiListeners;
    private expirationListeners;
    private changedKeys;
    private pendingFlush;
    private cleanupTimer;
    /** Protected method names — cannot be used as data keys */
    private static RESERVED;
    [key: string]: any;
    constructor(cleanupIntervalMs?: number);
    /** Set value with optional TTL (in minutes) */
    set<T = any>(key: string, value: T, ttl?: number | null): void;
    /** Get value (returns null if expired or missing) */
    get<T = any>(key: string): T | null;
    /** Check if key exists and is not expired */
    has(key: string): boolean;
    /** Remove key, returns removed value or null */
    remove(key: string): any;
    /** Clear all data, listeners, TTLs */
    clear(): void;
    /**
     * Subscribe to key changes. Returns unsubscribe function.
     *
     * @example
     * store.subscribe('user', (value) => { ... });
     * store.subscribe(['user', 'token'], (values) => { ... });
     */
    subscribe(key: string | string[], callback: (value: any) => void): () => void;
    /** Unsubscribe specific callback from key */
    unsubscribe(key: string, callback: (value: any) => void): void;
    /** Subscribe to TTL expiration of a key */
    onExpire(key: string, callback: (value: any) => void): () => void;
    /** Get TTL info for a key */
    getTTL(key: string): {
        ttl: number;
        createdAt: number;
        expiresAt: number;
        remaining: number;
        expired: boolean;
    } | null;
    /** Refresh TTL (reset timer). Pass null to use existing TTL. */
    refreshTTL(key: string, ttl?: number | null): void;
    /** Remove TTL from key (key lives forever) */
    removeTTL(key: string): void;
    /** All non-expired keys */
    keys(): string[];
    /** All non-expired values */
    values<T = any>(): T[];
    /** All non-expired entries */
    entries<T = any>(): Array<[string, T]>;
    /** Destroy — clear all + stop cleanup timer */
    destroy(): void;
    private isExpired;
    private expire;
    private cleanExpired;
    private queueChange;
    private flush;
    private removeDynamicProp;
}
//# sourceMappingURL=StoreService.d.ts.map