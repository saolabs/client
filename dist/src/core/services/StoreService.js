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
// ─── StoreService ───────────────────────────────────────────────
export class StoreService {
    static getInstance(key = 'default') {
        if (!StoreService.instances.has(key)) {
            StoreService.instances.set(key, new StoreService());
        }
        return StoreService.instances.get(key);
    }
    static instance(key = 'default') {
        return StoreService.getInstance(key);
    }
    static removeInstance(key = 'default') {
        StoreService.instances.delete(key);
    }
    constructor(cleanupIntervalMs = 60000) {
        this.data = {};
        this.ttlMap = new Map();
        this.listeners = new Map();
        this.multiListeners = [];
        this.expirationListeners = new Map();
        this.changedKeys = new Set();
        this.pendingFlush = false;
        this.cleanupTimer = null;
        if (cleanupIntervalMs > 0) {
            this.cleanupTimer = setInterval(() => this.cleanExpired(), cleanupIntervalMs);
        }
    }
    // ─── CRUD ───────────────────────────────────────────────────
    /** Set value with optional TTL (in minutes) */
    set(key, value, ttl = null) {
        if (StoreService.RESERVED.has(key))
            return;
        this.data[key] = value;
        if (ttl !== null && ttl > 0) {
            const ms = ttl * 60000;
            this.ttlMap.set(key, { ttl, createdAt: Date.now(), expiresAt: Date.now() + ms });
        }
        else {
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
    get(key) {
        if (this.isExpired(key)) {
            this.expire(key);
            return null;
        }
        return this.data[key] ?? null;
    }
    /** Check if key exists and is not expired */
    has(key) {
        if (this.isExpired(key)) {
            this.expire(key);
            return false;
        }
        return key in this.data;
    }
    /** Remove key, returns removed value or null */
    remove(key) {
        if (!(key in this.data))
            return null;
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
    clear() {
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
    subscribe(key, callback) {
        if (Array.isArray(key)) {
            const listener = {
                keys: new Set(key),
                callback: callback,
                called: false,
            };
            this.multiListeners.push(listener);
            return () => {
                const idx = this.multiListeners.indexOf(listener);
                if (idx !== -1)
                    this.multiListeners.splice(idx, 1);
            };
        }
        if (!this.listeners.has(key))
            this.listeners.set(key, []);
        this.listeners.get(key).push(callback);
        return () => this.unsubscribe(key, callback);
    }
    /** Unsubscribe specific callback from key */
    unsubscribe(key, callback) {
        const list = this.listeners.get(key);
        if (!list)
            return;
        const filtered = list.filter((cb) => cb !== callback);
        filtered.length > 0 ? this.listeners.set(key, filtered) : this.listeners.delete(key);
    }
    /** Subscribe to TTL expiration of a key */
    onExpire(key, callback) {
        if (!this.expirationListeners.has(key))
            this.expirationListeners.set(key, []);
        this.expirationListeners.get(key).push(callback);
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
    getTTL(key) {
        const info = this.ttlMap.get(key);
        if (!info)
            return null;
        const remaining = Math.max(0, info.expiresAt - Date.now());
        return { ttl: info.ttl, createdAt: info.createdAt, expiresAt: info.expiresAt, remaining, expired: remaining <= 0 };
    }
    /** Refresh TTL (reset timer). Pass null to use existing TTL. */
    refreshTTL(key, ttl) {
        if (!(key in this.data))
            return;
        const finalTTL = (ttl != null && ttl > 0) ? ttl : this.ttlMap.get(key)?.ttl ?? null;
        if (finalTTL != null && finalTTL > 0) {
            const ms = finalTTL * 60000;
            this.ttlMap.set(key, { ttl: finalTTL, createdAt: Date.now(), expiresAt: Date.now() + ms });
        }
    }
    /** Remove TTL from key (key lives forever) */
    removeTTL(key) {
        this.ttlMap.delete(key);
    }
    // ─── Iteration ──────────────────────────────────────────────
    /** All non-expired keys */
    keys() {
        this.cleanExpired();
        return Object.keys(this.data);
    }
    /** All non-expired values */
    values() {
        return this.keys().map((k) => this.get(k));
    }
    /** All non-expired entries */
    entries() {
        return this.keys().map((k) => [k, this.get(k)]);
    }
    // ─── Lifecycle ──────────────────────────────────────────────
    /** Destroy — clear all + stop cleanup timer */
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.clear();
    }
    // ─── Private ────────────────────────────────────────────────
    isExpired(key) {
        const info = this.ttlMap.get(key);
        return info ? Date.now() > info.expiresAt : false;
    }
    expire(key) {
        if (!(key in this.data))
            return;
        const value = this.data[key];
        // Notify expiration listeners
        const cbs = this.expirationListeners.get(key);
        if (cbs) {
            for (const cb of cbs) {
                try {
                    cb(value);
                }
                catch (e) {
                    console.error(`[StoreService] Expiration listener error for "${key}":`, e);
                }
            }
        }
        delete this.data[key];
        this.ttlMap.delete(key);
        this.listeners.delete(key);
        this.expirationListeners.delete(key);
        this.removeDynamicProp(key);
        this.queueChange(key);
    }
    cleanExpired() {
        let count = 0;
        for (const [key, info] of this.ttlMap) {
            if (Date.now() > info.expiresAt) {
                this.expire(key);
                count++;
            }
        }
        return count;
    }
    queueChange(key) {
        this.changedKeys.add(key);
        if (!this.pendingFlush) {
            this.pendingFlush = true;
            Promise.resolve().then(() => this.flush());
        }
    }
    flush() {
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
                    try {
                        cb(value);
                    }
                    catch (e) {
                        console.error(`[StoreService] Listener error for "${key}":`, e);
                    }
                }
            }
            // Multi-key listeners
            for (const listener of this.multiListeners) {
                if (listener.keys.has(key) && !listener.called) {
                    listener.called = true;
                    const values = {};
                    for (const k of listener.keys) {
                        if (keys.includes(k))
                            values[k] = this.get(k);
                    }
                    try {
                        listener.callback(values);
                    }
                    catch (e) {
                        console.error('[StoreService] Multi-key listener error:', e);
                    }
                }
            }
        }
    }
    removeDynamicProp(key) {
        try {
            const desc = Object.getOwnPropertyDescriptor(this, key);
            if (desc?.configurable)
                delete this[key];
        }
        catch { /* noop */ }
    }
}
StoreService.instances = new Map();
/** Protected method names — cannot be used as data keys */
StoreService.RESERVED = new Set([
    'get', 'set', 'has', 'remove', 'clear', 'subscribe',
    'unsubscribe', 'onExpire', 'keys', 'values', 'entries',
    'destroy',
]);
//# sourceMappingURL=StoreService.js.map