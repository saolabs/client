export interface StoreServiceInterface {
    [key: string]: any;
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
     * - subscribe('user', (value) => { ... })
     * - subscribe(['user', 'token'], (values) => { ... })
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
}
//# sourceMappingURL=StoreServiceInterface.d.ts.map