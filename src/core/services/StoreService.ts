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

// ─── Types ──────────────────────────────────────────────────────

interface TTLInfo {
    ttl: number;       // minutes
    createdAt: number;
    expiresAt: number;
}

interface MultiKeyListener {
    keys: Set<string>;
    callback: (values: Record<string, any>) => void;
    called: boolean;
}

// ─── StoreService ───────────────────────────────────────────────

export class StoreService {
    static instances: Map<string, StoreService> = new Map();

    static getInstance(key: string = 'default'): StoreService {
        if (!StoreService.instances.has(key)) {
            StoreService.instances.set(key, new StoreService());
        }
        return StoreService.instances.get(key)!;
    }

    static instance(key: string = 'default'): StoreService {
        return StoreService.getInstance(key);
    }

    static removeInstance(key: string = 'default'): void {
        StoreService.instances.delete(key);
    }

    private data: Record<string, any> = {};
    private ttlMap = new Map<string, TTLInfo>();
    private listeners = new Map<string, Array<(value: any) => void>>();
    private multiListeners: MultiKeyListener[] = [];
    private expirationListeners = new Map<string, Array<(value: any) => void>>();
    private changedKeys = new Set<string>();
    private pendingFlush = false;
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    /** Protected method names — cannot be used as data keys */
    private static RESERVED = new Set([
        'get', 'set', 'has', 'remove', 'clear', 'subscribe',
        'unsubscribe', 'onExpire', 'keys', 'values', 'entries',
        'destroy',
    ]);

    [key: string]: any;

    constructor(cleanupIntervalMs: number = 60_000) {
        if (cleanupIntervalMs > 0) {
            this.cleanupTimer = setInterval(() => this.cleanExpired(), cleanupIntervalMs);
        }
    }

    // ─── CRUD ───────────────────────────────────────────────────

    /** Set value with optional TTL (in minutes) */
    set<T = any>(key: string, value: T, ttl: number | null = null): void {
        if (StoreService.RESERVED.has(key)) return;

        this.data[key] = value;

        if (ttl !== null && ttl > 0) {
            const ms = ttl * 60_000;
            this.ttlMap.set(key, { ttl, createdAt: Date.now(), expiresAt: Date.now() + ms });
        } else {
            this.ttlMap.delete(key);
        }

        // Dynamic property
        if (!Object.getOwnPropertyDescriptor(this, key)?.get) {
            Object.defineProperty(this, key, {
                get: () => this.get(key),
                set: (v) => this.set(key, v, ttl),
                enumerable: true,
                configurable: true,
            });
        }

        this.queueChange(key);
    }

    /** Get value (returns null if expired or missing) */
    get<T = any>(key: string): T | null {
        if (this.isExpired(key)) {
            this.expire(key);
            return null;
        }
        return (this.data[key] as T) ?? null;
    }

    /** Check if key exists and is not expired */
    has(key: string): boolean {
        if (this.isExpired(key)) {
            this.expire(key);
            return false;
        }
        return key in this.data;
    }

    /** Remove key, returns removed value or null */
    remove(key: string): any {
        if (!(key in this.data)) return null;
        const value = this.data[key];

        delete this.data[key];
        this.ttlMap.delete(key);
        this.listeners.delete(key);
        this.expirationListeners.delete(key);
        this.removeDynamicProp(key);
        this.queueChange(key);

        return value;
    }

    /** Clear all data, listeners, TTLs */
    clear(): void {
        const keys = Object.keys(this.data);
        this.data = {};
        this.ttlMap.clear();
        this.listeners.clear();
        this.multiListeners = [];
        this.expirationListeners.clear();
        this.changedKeys.clear();
        this.pendingFlush = false;
        keys.forEach((k) => this.removeDynamicProp(k));
    }

    // ─── Subscriptions ──────────────────────────────────────────

    /**
     * Subscribe to key changes. Returns unsubscribe function.
     *
     * @example
     * store.subscribe('user', (value) => { ... });
     * store.subscribe(['user', 'token'], (values) => { ... });
     */
    subscribe(
        key: string | string[],
        callback: (value: any) => void,
    ): () => void {
        if (Array.isArray(key)) {
            const listener: MultiKeyListener = {
                keys: new Set(key),
                callback: callback as any,
                called: false,
            };
            this.multiListeners.push(listener);
            return () => {
                const idx = this.multiListeners.indexOf(listener);
                if (idx !== -1) this.multiListeners.splice(idx, 1);
            };
        }

        if (!this.listeners.has(key)) this.listeners.set(key, []);
        this.listeners.get(key)!.push(callback);
        return () => this.unsubscribe(key, callback);
    }

    /** Unsubscribe specific callback from key */
    unsubscribe(key: string, callback: (value: any) => void): void {
        const list = this.listeners.get(key);
        if (!list) return;
        const filtered = list.filter((cb) => cb !== callback);
        filtered.length > 0 ? this.listeners.set(key, filtered) : this.listeners.delete(key);
    }

    /** Subscribe to TTL expiration of a key */
    onExpire(key: string, callback: (value: any) => void): () => void {
        if (!this.expirationListeners.has(key)) this.expirationListeners.set(key, []);
        this.expirationListeners.get(key)!.push(callback);
        return () => {
            const list = this.expirationListeners.get(key);
            if (list) {
                const filtered = list.filter((cb) => cb !== callback);
                filtered.length > 0
                    ? this.expirationListeners.set(key, filtered)
                    : this.expirationListeners.delete(key);
            }
        };
    }

    // ─── TTL Utilities ──────────────────────────────────────────

    /** Get TTL info for a key */
    getTTL(key: string): { ttl: number; createdAt: number; expiresAt: number; remaining: number; expired: boolean } | null {
        const info = this.ttlMap.get(key);
        if (!info) return null;
        const remaining = Math.max(0, info.expiresAt - Date.now());
        return { ttl: info.ttl, createdAt: info.createdAt, expiresAt: info.expiresAt, remaining, expired: remaining <= 0 };
    }

    /** Refresh TTL (reset timer). Pass null to use existing TTL. */
    refreshTTL(key: string, ttl?: number | null): void {
        if (!(key in this.data)) return;
        const finalTTL = (ttl != null && ttl > 0) ? ttl : this.ttlMap.get(key)?.ttl ?? null;
        if (finalTTL != null && finalTTL > 0) {
            const ms = finalTTL * 60_000;
            this.ttlMap.set(key, { ttl: finalTTL, createdAt: Date.now(), expiresAt: Date.now() + ms });
        }
    }

    /** Remove TTL from key (key lives forever) */
    removeTTL(key: string): void {
        this.ttlMap.delete(key);
    }

    // ─── Iteration ──────────────────────────────────────────────

    /** All non-expired keys */
    keys(): string[] {
        this.cleanExpired();
        return Object.keys(this.data);
    }

    /** All non-expired values */
    values<T = any>(): T[] {
        return this.keys().map((k) => this.get<T>(k)!);
    }

    /** All non-expired entries */
    entries<T = any>(): Array<[string, T]> {
        return this.keys().map((k) => [k, this.get<T>(k)!]);
    }

    // ─── Lifecycle ──────────────────────────────────────────────

    /** Destroy — clear all + stop cleanup timer */
    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.clear();
    }

    // ─── Private ────────────────────────────────────────────────

    private isExpired(key: string): boolean {
        const info = this.ttlMap.get(key);
        return info ? Date.now() > info.expiresAt : false;
    }

    private expire(key: string): void {
        if (!(key in this.data)) return;
        const value = this.data[key];

        // Notify expiration listeners
        const cbs = this.expirationListeners.get(key);
        if (cbs) {
            for (const cb of cbs) {
                try { cb(value); } catch (e) { console.error(`[StoreService] Expiration listener error for "${key}":`, e); }
            }
        }

        delete this.data[key];
        this.ttlMap.delete(key);
        this.listeners.delete(key);
        this.expirationListeners.delete(key);
        this.removeDynamicProp(key);
        this.queueChange(key);
    }

    private cleanExpired(): number {
        let count = 0;
        for (const [key, info] of this.ttlMap) {
            if (Date.now() > info.expiresAt) {
                this.expire(key);
                count++;
            }
        }
        return count;
    }

    private queueChange(key: string): void {
        this.changedKeys.add(key);
        if (!this.pendingFlush) {
            this.pendingFlush = true;
            Promise.resolve().then(() => this.flush());
        }
    }

    private flush(): void {
        const keys = [...this.changedKeys];
        this.changedKeys.clear();
        this.pendingFlush = false;
        this.multiListeners.forEach((l) => (l.called = false));

        for (const key of keys) {
            const value = this.get(key);

            // Single-key listeners
            const cbs = this.listeners.get(key);
            if (cbs) {
                for (const cb of cbs) {
                    try { cb(value); } catch (e) { console.error(`[StoreService] Listener error for "${key}":`, e); }
                }
            }

            // Multi-key listeners
            for (const listener of this.multiListeners) {
                if (listener.keys.has(key) && !listener.called) {
                    listener.called = true;
                    const values: Record<string, any> = {};
                    for (const k of listener.keys) {
                        if (keys.includes(k)) values[k] = this.get(k);
                    }
                    try { listener.callback(values); } catch (e) { console.error('[StoreService] Multi-key listener error:', e); }
                }
            }
        }
    }

    private removeDynamicProp(key: string): void {
        try {
            const desc = Object.getOwnPropertyDescriptor(this, key);
            if (desc?.configurable) delete (this as any)[key];
        } catch { /* noop */ }
    }
}
