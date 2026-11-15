/**
 * EventService — Pub/Sub event bus.
 *
 * Supports:
 *   - Single event:       on('click', fn)
 *   - Multiple events:    on(['click', 'hover'], fn)  — fn called once per emit batch
 *   - Space-separated:    on('click hover', fn)
 *   - Object syntax:      on({ click: fn1, hover: fn2 })
 *   - Once:               once('click', fn)
 *
 * Not a singleton — register via DI:
 *   app.singleton('event', EventService);
 *   app.make<EventService>('event').on('route:change', fn);
 */
// ─── EventService ───────────────────────────────────────────────
export class EventService {
    constructor() {
        this.listeners = new Map();
        this.multiListeners = new Map();
    }
    static getInstance(key = 'default') {
        if (!EventService.instances.has(key)) {
            EventService.instances.set(key, new EventService());
        }
        return EventService.instances.get(key);
    }
    static instance(key = 'default') {
        return EventService.getInstance(key);
    }
    static removeInstance(key = 'default') {
        EventService.instances.delete(key);
    }
    // ─── Subscribe ──────────────────────────────────────────────
    /**
     * Subscribe to events. Returns unsubscribe function.
     *
     * @example
     * event.on('save', (data) => { ... });
     * event.on(['save', 'update'], (data) => { ... });
     * event.on('save update', (data) => { ... });
     * event.on({ save: fn1, update: fn2 });
     */
    on(event, callback, once = false) {
        // Object syntax: on({ click: fn1, hover: fn2 })
        if (typeof event === 'object' && !Array.isArray(event)) {
            const unsubs = [];
            for (const [name, fn] of Object.entries(event)) {
                if (typeof fn === 'function') {
                    unsubs.push(this.on(name, fn, callback === true));
                }
            }
            return () => unsubs.forEach((u) => u());
        }
        // Space-separated → array
        if (typeof event === 'string' && event.includes(' ')) {
            event = event.split(/\s+/).filter(Boolean);
        }
        // Array of events — multi-listener (fires once per emit batch)
        if (Array.isArray(event)) {
            const events = new Set(event.filter((e) => typeof e === 'string'));
            if (events.size === 0 || typeof callback !== 'function')
                return () => { };
            const listener = { events, callback, once };
            for (const name of events)
                this.add(this.multiListeners, name, listener);
            return () => this.removeMulti(listener);
        }
        // Single event
        if (typeof event !== 'string' || typeof callback !== 'function')
            return () => { };
        const listener = { callback, once };
        this.add(this.listeners, event, listener);
        return () => this.remove(this.listeners, event, listener);
    }
    /** Subscribe once — auto-unsubscribe after first call */
    once(event, callback) {
        return this.on(event, callback ?? true, true);
    }
    // ─── Unsubscribe ────────────────────────────────────────────
    /**
     * Unsubscribe from events.
     *
     * @example
     * event.off('save');         // remove all listeners for 'save'
     * event.off('save', fn);    // remove specific listener
     * event.off(['save', 'update']);
     * event.off({ save: fn1 });
     */
    off(event, callback) {
        // Object syntax
        if (typeof event === 'object' && !Array.isArray(event)) {
            for (const [name, fn] of Object.entries(event)) {
                this.off(name, fn);
            }
            return;
        }
        // Space-separated
        if (typeof event === 'string' && event.includes(' ')) {
            event = event.split(/\s+/).filter(Boolean);
        }
        // Array
        if (Array.isArray(event)) {
            for (const name of event) {
                for (const listener of this.multiListeners.get(name) ?? []) {
                    if (!callback || listener.callback === callback)
                        this.removeMulti(listener);
                }
                this.off(name, callback);
            }
            return;
        }
        // Single event
        if (typeof event !== 'string')
            return;
        if (!callback) {
            this.listeners.delete(event);
        }
        else {
            for (const listener of this.listeners.get(event) ?? []) {
                if (listener.callback === callback)
                    this.remove(this.listeners, event, listener);
            }
        }
    }
    add(index, event, listener) {
        let bucket = index.get(event);
        if (!bucket)
            index.set(event, bucket = new Set());
        bucket.add(listener);
    }
    remove(index, event, listener) {
        const bucket = index.get(event);
        if (!bucket)
            return;
        bucket.delete(listener);
        if (bucket.size === 0)
            index.delete(event);
    }
    removeMulti(listener) {
        for (const name of listener.events)
            this.remove(this.multiListeners, name, listener);
    }
    // ─── Emit ───────────────────────────────────────────────────
    /** Emit event with arguments */
    emit(event, ...args) {
        const list = this.listeners.get(event);
        if (list) {
            for (const listener of [...list]) {
                if (listener.fired)
                    continue;
                if (listener.once) {
                    listener.fired = true;
                    this.remove(this.listeners, event, listener);
                }
                try {
                    listener.callback(...args);
                }
                catch (err) {
                    console.error(`[EventService] Error in listener for "${event}":`, err);
                }
            }
        }
        // Select the matching bucket after singles, preserving dispatch order
        // and giving recursive emits their own snapshot.
        const multi = this.multiListeners.get(event);
        if (!multi)
            return;
        for (const listener of [...multi]) {
            if (listener.fired)
                continue;
            if (listener.once) {
                listener.fired = true;
                this.removeMulti(listener);
            }
            try {
                listener.callback(...args);
            }
            catch (err) {
                console.error('[EventService] Error in multi-event listener:', err);
            }
        }
    }
    // ─── Utility ────────────────────────────────────────────────
    /** Remove all listeners */
    clear() {
        this.listeners.clear();
        this.multiListeners.clear();
    }
    /** Listener count for a specific event */
    listenerCount(event) {
        return (this.listeners.get(event)?.size ?? 0) + (this.multiListeners.get(event)?.size ?? 0);
    }
    /** Check if event has listeners */
    hasListeners(event) {
        return this.listenerCount(event) > 0;
    }
    /** Get all registered event names */
    eventNames() {
        const names = new Set(this.listeners.keys());
        for (const name of this.multiListeners.keys())
            names.add(name);
        return [...names];
    }
    /** Destroy — alias for clear */
    destroy() {
        this.clear();
    }
}
EventService.instances = new Map();
//# sourceMappingURL=EventService.js.map