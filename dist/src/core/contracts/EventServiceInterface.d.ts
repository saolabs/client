export type EventCallback = (...args: any[]) => void;
export interface EventServiceInterface {
    /**
     * Subscribe to events. Returns unsubscribe function.
     *
     * Supports:
     *   - Single event:       on('click', fn)
     *   - Multiple events:    on(['click', 'hover'], fn)
     *   - Space-separated:    on('click hover', fn)
     *   - Object syntax:      on({ click: fn1, hover: fn2 })
     */
    on(event: string | string[] | Record<string, EventCallback>, callback?: EventCallback | boolean, once?: boolean): () => void;
    /** Subscribe once — auto-unsubscribe after first call */
    once(event: string | string[] | Record<string, EventCallback>, callback?: EventCallback): () => void;
    /**
     * Unsubscribe from events.
     *
     * - off('save')          — remove all listeners for 'save'
     * - off('save', fn)      — remove specific listener
     * - off(['save', 'update'])
     * - off({ save: fn1 })
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
//# sourceMappingURL=EventServiceInterface.d.ts.map