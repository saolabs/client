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
}

interface MultiListener {
    events: Set<string>;
    callback: EventCallback;
    once: boolean;
    called: boolean;
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


    private listeners = new Map<string, SingleListener[]>();
    private multiListeners: MultiListener[] = [];

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
            if (events.size === 0) return () => { };

            const listener: MultiListener = {
                events,
                callback: callback as EventCallback,
                once,
                called: false,
            };
            this.multiListeners.push(listener);

            return () => {
                const idx = this.multiListeners.indexOf(listener);
                if (idx !== -1) this.multiListeners.splice(idx, 1);
            };
        }

        // Single event
        if (typeof event !== 'string' || typeof callback !== 'function') return () => { };

        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        const listener: SingleListener = { callback, once };
        this.listeners.get(event)!.push(listener);

        return () => this.off(event as string, callback as EventCallback);
    }

    /** Subscribe once — auto-unsubscribe after first call */
    once(
        event: string | string[] | Record<string, EventCallback>,
        callback?: EventCallback,
    ): () => void {
        return this.on(event, callback, true);
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
            const eventSet = new Set(event);
            this.multiListeners = this.multiListeners.filter((l) => {
                if (callback && l.callback !== callback) return true;
                return ![...l.events].some((e) => eventSet.has(e));
            });
            event.forEach((e) => this.off(e, callback));
            return;
        }

        // Single event
        if (typeof event !== 'string') return;

        if (!callback) {
            this.listeners.delete(event);
        } else {
            const list = this.listeners.get(event);
            if (list) {
                const filtered = list.filter((l) => l.callback !== callback);
                filtered.length > 0
                    ? this.listeners.set(event, filtered)
                    : this.listeners.delete(event);
            }
        }
    }

    // ─── Emit ───────────────────────────────────────────────────

    /** Emit event with arguments */
    emit(event: string, ...args: any[]): void {
        // Reset multi-listener flags
        this.multiListeners.forEach((l) => (l.called = false));

        // Single listeners
        const list = this.listeners.get(event);
        if (list) {
            const snapshot = [...list];
            const toRemove: SingleListener[] = [];

            for (const listener of snapshot) {
                try {
                    listener.callback(...args);
                } catch (err) {
                    console.error(`[EventService] Error in listener for "${event}":`, err);
                }
                if (listener.once) toRemove.push(listener);
            }

            if (toRemove.length) {
                this.listeners.set(
                    event,
                    list.filter((l) => !toRemove.includes(l)),
                );
            }
        }

        // Multi listeners
        const multiToRemove: MultiListener[] = [];
        for (const listener of this.multiListeners) {
            if (listener.events.has(event) && !listener.called) {
                listener.called = true;
                try {
                    listener.callback(...args);
                } catch (err) {
                    console.error(`[EventService] Error in multi-event listener:`, err);
                }
                if (listener.once) multiToRemove.push(listener);
            }
        }

        if (multiToRemove.length) {
            this.multiListeners = this.multiListeners.filter((l) => !multiToRemove.includes(l));
        }
    }

    // ─── Utility ────────────────────────────────────────────────

    /** Remove all listeners */
    clear(): void {
        this.listeners.clear();
        this.multiListeners = [];
    }

    /** Listener count for a specific event */
    listenerCount(event: string): number {
        const single = this.listeners.get(event)?.length ?? 0;
        const multi = this.multiListeners.filter((l) => l.events.has(event)).length;
        return single + multi;
    }

    /** Check if event has listeners */
    hasListeners(event: string): boolean {
        return this.listenerCount(event) > 0;
    }

    /** Get all registered event names */
    eventNames(): string[] {
        const names = new Set<string>(this.listeners.keys());
        for (const l of this.multiListeners) {
            l.events.forEach((e) => names.add(e));
        }
        return [...names];
    }

    /** Destroy — alias for clear */
    destroy(): void {
        this.clear();
    }
}
