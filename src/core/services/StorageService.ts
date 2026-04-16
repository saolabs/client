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

// ─── Types ──────────────────────────────────────────────────────

interface StoredItem {
    value: any;
    timestamp: number;
    ttl?: number; // milliseconds
}

export type StorageEventCallback = (data?: any) => void;

// ─── StorageService ─────────────────────────────────────────────

export class StorageService {

    static instances: Map<string, StorageService> = new Map();

    static getInstance(key: string = 'default'): StorageService {
        if (!StorageService.instances.has(key)) {
            StorageService.instances.set(key, new StorageService(key));
        }
        return StorageService.instances.get(key)!;
    }

    static instance(key: string = 'default'): StorageService {
        return StorageService.getInstance(key);
    }

    static removeInstance(key: string = 'default'): void {
        StorageService.instances.delete(key);
    }

    private storageKey: string;
    private data: Record<string, StoredItem> = {};
    private listeners = new Map<string, StorageEventCallback[]>();
    private supported: boolean;

    constructor(storageKey: string = 'oneview_storage') {
        this.storageKey = storageKey;
        this.supported = typeof localStorage !== 'undefined';
        if (this.supported) this.load();
    }

    // ─── CRUD ───────────────────────────────────────────────────

    /**
     * Set value with optional TTL (in seconds).
     * Supports bulk set: set({ key1: val1, key2: val2 })
     */
    set(key: string | Record<string, any>, value?: any, ttl?: number | null): boolean {
        if (!this.supported) return false;

        if (typeof key === 'object' && key !== null) {
            let ok = true;
            for (const [k, v] of Object.entries(key)) {
                if (!this.set(k, v, ttl)) ok = false;
            }
            return ok;
        }

        const oldValue = this.data[key]?.value;
        const item: StoredItem = { value, timestamp: Date.now() };
        if (ttl != null && ttl > 0) item.ttl = ttl * 1000;

        this.data[key] = item;

        try {
            this.save();
            this.emit(`set:${key}`, { key, value, oldValue, ttl });
            this.emit('set', { key, value, oldValue, ttl });
            return true;
        } catch (e) {
            this.data[key] = { value: oldValue, timestamp: Date.now() };
            return false;
        }
    }

    /** Get value (null if expired or missing) */
    get<T = any>(key: string, defaultValue: T | null = null): T | null {
        if (!this.supported) return defaultValue;
        const item = this.data[key];
        if (!item) return defaultValue;

        if (this.isExpired(item)) {
            this.remove(key);
            return defaultValue;
        }

        return (item.value ?? defaultValue) as T;
    }

    /** Check if key exists and not expired */
    has(key: string): boolean {
        const item = this.data[key];
        if (!item) return false;
        if (this.isExpired(item)) { this.remove(key); return false; }
        return true;
    }

    /** Remove key */
    remove(key: string): boolean {
        if (!this.supported || !(key in this.data)) return false;
        const oldValue = this.data[key]?.value;
        delete this.data[key];

        try {
            this.save();
            this.emit(`remove:${key}`, { key, oldValue });
            this.emit('remove', { key, oldValue });
            return true;
        } catch {
            return false;
        }
    }

    /** Clear all storage data */
    clear(): void {
        const oldData = { ...this.data };
        this.data = {};
        this.save();
        this.emit('clear', { oldData });
    }

    // ─── Query ──────────────────────────────────────────────────

    /** Get all non-expired values as plain object */
    getAll(): Record<string, any> {
        this.cleanExpired();
        const result: Record<string, any> = {};
        for (const [k, item] of Object.entries(this.data)) {
            result[k] = item.value;
        }
        return result;
    }

    /** All non-expired keys */
    getAllKeys(): string[] {
        this.cleanExpired();
        return Object.keys(this.data);
    }

    /** Number of stored items */
    size(): number {
        this.cleanExpired();
        return Object.keys(this.data).length;
    }

    isEmpty(): boolean {
        return this.size() === 0;
    }

    // ─── Import / Export / Backup ───────────────────────────────

    /** Export all data as JSON string */
    export(): string {
        return JSON.stringify(this.getAll(), null, 2);
    }

    /** Import data from JSON string */
    import(json: string): boolean {
        try {
            const parsed = JSON.parse(json);
            for (const [k, v] of Object.entries(parsed)) {
                this.data[k] = { value: v, timestamp: Date.now() };
            }
            this.save();
            this.emit('import', { data: parsed });
            return true;
        } catch {
            return false;
        }
    }

    /** Create backup snapshot */
    backup(): { timestamp: number; key: string; data: Record<string, any> } {
        return { timestamp: Date.now(), key: this.storageKey, data: this.getAll() };
    }

    /** Restore from backup */
    restore(backup: { data: Record<string, any> }): boolean {
        if (!backup?.data) return false;
        this.data = {};
        for (const [k, v] of Object.entries(backup.data)) {
            this.data[k] = { value: v, timestamp: Date.now() };
        }
        this.save();
        this.emit('restore', { data: backup.data });
        return true;
    }

    // ─── Event System ───────────────────────────────────────────

    /** Subscribe to storage events. Returns unsubscribe function. */
    on(event: string, callback: StorageEventCallback): () => void {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event)!.push(callback);
        return () => this.off(event, callback);
    }

    /** Unsubscribe from event */
    off(event: string, callback: StorageEventCallback): void {
        const list = this.listeners.get(event);
        if (!list) return;
        const filtered = list.filter((cb) => cb !== callback);
        filtered.length > 0 ? this.listeners.set(event, filtered) : this.listeners.delete(event);
    }

    // ─── Lifecycle ──────────────────────────────────────────────

    destroy(): void {
        this.listeners.clear();
        this.data = {};
    }

    // ─── Private ────────────────────────────────────────────────

    private isExpired(item: StoredItem): boolean {
        if (!item.ttl) return false;
        return Date.now() > item.timestamp + item.ttl;
    }

    private cleanExpired(): void {
        for (const key of Object.keys(this.data)) {
            if (this.isExpired(this.data[key])) {
                delete this.data[key];
            }
        }
        this.save();
    }

    private load(): void {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) this.data = JSON.parse(raw);
        } catch {
            this.data = {};
        }
    }

    private save(): void {
        if (!this.supported) return;
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
        } catch (e) {
            console.error('[StorageService] Failed to save:', e);
        }
    }

    private emit(event: string, data?: any): void {
        const cbs = this.listeners.get(event);
        if (!cbs) return;
        for (const cb of cbs) {
            try { cb(data); } catch (e) { console.error(`[StorageService] Event listener error (${event}):`, e); }
        }
    }
}
