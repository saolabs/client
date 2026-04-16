/**
 * StorageService — localStorage wrapper with TTL, events, import/export.
 *
 * Features:
 *   - get/set/remove/clear with TTL (seconds)
 *   - Event system: on('set', fn), on('set:key', fn), on('remove', fn)
 *   - Backup/restore, import/export (JSON)
 *   - Auto-cleans expired items on access
 *
 * Register via DI:
 *   app.singleton('storage', () => new StorageService('myapp'));
 */
export type StorageEventCallback = (data?: any) => void;
export declare class StorageService {
    static instances: Map<string, StorageService>;
    static getInstance(key?: string): StorageService;
    static instance(key?: string): StorageService;
    static removeInstance(key?: string): void;
    private storageKey;
    private data;
    private listeners;
    private supported;
    constructor(storageKey?: string);
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
    /** Get all non-expired values as plain object */
    getAll(): Record<string, any>;
    /** All non-expired keys */
    getAllKeys(): string[];
    /** Number of stored items */
    size(): number;
    isEmpty(): boolean;
    /** Export all data as JSON string */
    export(): string;
    /** Import data from JSON string */
    import(json: string): boolean;
    /** Create backup snapshot */
    backup(): {
        timestamp: number;
        key: string;
        data: Record<string, any>;
    };
    /** Restore from backup */
    restore(backup: {
        data: Record<string, any>;
    }): boolean;
    /** Subscribe to storage events. Returns unsubscribe function. */
    on(event: string, callback: StorageEventCallback): () => void;
    /** Unsubscribe from event */
    off(event: string, callback: StorageEventCallback): void;
    destroy(): void;
    private isExpired;
    private cleanExpired;
    private load;
    private save;
    private emit;
}
//# sourceMappingURL=StorageService.d.ts.map