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
export type EventCallback = (...args: any[]) => void;
export declare class EventService {
    static instances: Map<any, EventService>;
    static getInstance(key?: any): EventService;
    static instance(key?: any): EventService;
    static removeInstance(key?: any): void;
    private listeners;
    private multiListeners;
    /**
     * Subscribe to events. Returns unsubscribe function.
     *
     * @example
     * event.on('save', (data) => { ... });
     * event.on(['save', 'update'], (data) => { ... });
     * event.on('save update', (data) => { ... });
     * event.on({ save: fn1, update: fn2 });
     */
    on(event: string | string[] | Record<string, EventCallback>, callback?: EventCallback | boolean, once?: boolean): () => void;
    /** Subscribe once — auto-unsubscribe after first call */
    once(event: string | string[] | Record<string, EventCallback>, callback?: EventCallback): () => void;
    /**
     * Unsubscribe from events.
     *
     * @example
     * event.off('save');         // remove all listeners for 'save'
     * event.off('save', fn);    // remove specific listener
     * event.off(['save', 'update']);
     * event.off({ save: fn1 });
     */
    off(event: string | string[] | Record<string, EventCallback>, callback?: EventCallback): void;
    /** Emit event with arguments */
    emit(event: string, ...args: any[]): void;
    /** Remove all listeners */
    clear(): void;
    /** Listener count for a specific event */
    listenerCount(event: string): number;
    /** Check if event has listeners */
    hasListeners(event: string): boolean;
    /** Get all registered event names */
    eventNames(): string[];
    /** Destroy — alias for clear */
    destroy(): void;
}
//# sourceMappingURL=EventService.d.ts.map