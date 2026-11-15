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

// ─── Types ──────────────────────────────────────────────────────

export type EventCallback = (...args: any[]) => void;

interface SingleListener {
    callback: EventCallback;
    once: boolean;
    fired?: boolean;
}

interface MultiListener extends SingleListener {
    events: Set<string>;
}

// ─── EventService ───────────────────────────────────────────────

export class EventService {

    static instances: Map<any, EventService> = new Map();

    static getInstance(key: any = 'default'): EventService {
        if (!EventService.instances.has(key)) {
            EventService.instances.set(key, new EventService());
        }
        return EventService.instances.get(key)!;
    }

    static instance(key: any = 'default'): EventService {
        return EventService.getInstance(key);
    }

    static removeInstance(key: any = 'default'): void {
        EventService.instances.delete(key);
    }


    private listeners = new Map<string, Set<SingleListener>>();
    private multiListeners = new Map<string, Set<MultiListener>>();

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
    on(
        event: string | string[] | Record<string, EventCallback>,
        callback?: EventCallback | boolean,
        once: boolean = false,
    ): () => void {
        // Object syntax: on({ click: fn1, hover: fn2 })
        if (typeof event === 'object' && !Array.isArray(event)) {
            const unsubs: Array<() => void> = [];
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
            if (events.size === 0 || typeof callback !== 'function') return () => {};

            const listener: MultiListener = { events, callback, once };
            for (const name of events) this.add(this.multiListeners, name, listener);
            return () => this.removeMulti(listener);
        }

        // Single event
        if (typeof event !== 'string' || typeof callback !== 'function') return () => { };

        const listener: SingleListener = { callback, once };
        this.add(this.listeners, event, listener);
        return () => this.remove(this.listeners, event, listener);
    }

    /** Subscribe once — auto-unsubscribe after first call */
    once(
        event: string | string[] | Record<string, EventCallback>,
        callback?: EventCallback,
    ): () => void {
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
    off(
        event: string | string[] | Record<string, EventCallback>,
        callback?: EventCallback,
    ): void {
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
                    if (!callback || listener.callback === callback) this.removeMulti(listener);
                }
                this.off(name, callback);
            }
            return;
        }

        // Single event
        if (typeof event !== 'string') return;

        if (!callback) {
            this.listeners.delete(event);
        } else {
            for (const listener of this.listeners.get(event) ?? []) {
                if (listener.callback === callback) this.remove(this.listeners, event, listener);
            }
        }
    }

    private add<T>(index: Map<string, Set<T>>, event: string, listener: T): void {
        let bucket = index.get(event);
        if (!bucket) index.set(event, bucket = new Set());
        bucket.add(listener);
    }

    private remove<T>(index: Map<string, Set<T>>, event: string, listener: T): void {
        const bucket = index.get(event);
        if (!bucket) return;
        bucket.delete(listener);
        if (bucket.size === 0) index.delete(event);
    }

    private removeMulti(listener: MultiListener): void {
        for (const name of listener.events) this.remove(this.multiListeners, name, listener);
    }

    // ─── Emit ───────────────────────────────────────────────────

    /** Emit event with arguments */
    emit(event: string, ...args: any[]): void {
        const list = this.listeners.get(event);
        if (list) {
            for (const listener of [...list]) {
                if (listener.fired) continue;
                if (listener.once) {
                    listener.fired = true;
                    this.remove(this.listeners, event, listener);
                }
                try {
                    listener.callback(...args);
                } catch (err) {
                    console.error(`[EventService] Error in listener for "${event}":`, err);
                }
            }
        }

        // Select the matching bucket after singles, preserving dispatch order
        // and giving recursive emits their own snapshot.
        const multi = this.multiListeners.get(event);
        if (!multi) return;
        for (const listener of [...multi]) {
            if (listener.fired) continue;
            if (listener.once) {
                listener.fired = true;
                this.removeMulti(listener);
            }
            try {
                listener.callback(...args);
            } catch (err) {
                console.error('[EventService] Error in multi-event listener:', err);
            }
        }
    }

    // ─── Utility ────────────────────────────────────────────────

    /** Remove all listeners */
    clear(): void {
        this.listeners.clear();
        this.multiListeners.clear();
    }

    /** Listener count for a specific event */
    listenerCount(event: string): number {
        return (this.listeners.get(event)?.size ?? 0) + (this.multiListeners.get(event)?.size ?? 0);
    }

    /** Check if event has listeners */
    hasListeners(event: string): boolean {
        return this.listenerCount(event) > 0;
    }

    /** Get all registered event names */
    eventNames(): string[] {
        const names = new Set<string>(this.listeners.keys());
        for (const name of this.multiListeners.keys()) names.add(name);
        return [...names];
    }

    /** Destroy — alias for clear */
    destroy(): void {
        this.clear();
    }
}
