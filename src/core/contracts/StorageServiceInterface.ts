// ─── Storage Service Interface ───────────────────────────────────

export type StorageEventCallback = (data?: any) => void;

export interface StorageServiceInterface {
    // ─── CRUD ───────────────────────────────────────────────────
    /**
     * Set value with optional TTL (in seconds).
     * Supports bulk set: set({ key1: val1, key2: val2 })
     */
    set(key: string | Record<string, any>, value?: any, ttl?: number | null): boolean;
    /** Get value (null if expired or missing) */
    get<T = any>(key: string, defaultValue?: T | null): T | null;
    /** Check if key exists and not expired */
    has(key: string): boolean;
    /** Remove key */
    remove(key: string): boolean;
    /** Clear all storage data */
    clear(): void;

    // ─── Query ──────────────────────────────────────────────────
    /** Get all non-expired values as plain object */
    getAll(): Record<string, any>;
    /** All non-expired keys */
    getAllKeys(): string[];
    /** Number of stored items */
    size(): number;
    isEmpty(): boolean;

    // ─── Import / Export / Backup ───────────────────────────────
    /** Export all data as JSON string */
    export(): string;
    /** Import data from JSON string */
    import(json: string): boolean;
    /** Create backup snapshot */
    backup(): { timestamp: number; key: string; data: Record<string, any> };
    /** Restore from backup */
    restore(backup: { data: Record<string, any> }): boolean;

    // ─── Event System ───────────────────────────────────────────
    /** Subscribe to storage events. Returns unsubscribe function. */
    on(event: string, callback: StorageEventCallback): () => void;
    /** Unsubscribe from event */
    off(event: string, callback: StorageEventCallback): void;

    // ─── Lifecycle ──────────────────────────────────────────────
    destroy(): void;
}
