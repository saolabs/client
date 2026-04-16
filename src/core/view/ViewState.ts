import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { StateManagerInterface, ViewStateInterface, StateItem, StateListener, MultiKeyStateListener } from "../contracts/ViewStateInterface";

/**
 * StateManager — manages reactive state for a ViewController.
 * 
 * Core reactive primitive — when a state value changes:
 *   1. Batch the change (add to pendingChanges)
 *   2. Schedule a flush via requestAnimationFrame
 *   3. On flush: notify all subscribed listeners
 *   4. Listeners can trigger Reactive.update() → DOM re-render
 * 
 * This replaces the old string-based re-render:
 *   OLD: state changes → re-render entire template string → diff/scan DOM
 *   NEW: state changes → notify only affected Reactive regions → targeted DOM update
 * 
 * @example
 * const [count, setCount] = viewState.__.useState(0, 'count');
 * viewState.__.subscribe('count', (val) => myReactive.update());
 * setCount(1); // → triggers listener → Reactive re-renders its region only
 */
export class StateManager implements StateManagerInterface {
    private states: Record<string | number, StateItem> = {};
    private listeners = new Map<string | number, StateListener[]>();
    private multiKeyListeners: MultiKeyStateListener[] = [];
    private pendingChanges = new Set<string | number>();
    private stateIndex = 0;
    private flushRAF: number | null = null;
    private hasPendingFlush = false;
    private isFlushing = false;
    private _isDestroyed = false;

    /** Flag — cho phép update state qua update$xxx chỉ trước lock */
    private _canUpdateStateByKey: boolean = true;

    /** Setter functions exposed for direct property assignment on ViewState */
    setters: Record<string | number, (value: any) => void> = {};

    /** Reference to owning ViewController */
    controller: ViewControllerInterface | null = null;

    /** Reference to owning ViewState wrapper */
    private stateInstance: ViewState;

    /** Properties that should NOT become state keys */
    private ownProperties: string[] = ['__', 'on', 'off', 'unsubscribe'];

    constructor(stateInstance: ViewState, controller?: ViewControllerInterface | null) {
        this.stateInstance = stateInstance;
        this.controller = controller ?? null;
    }

    // ─── canUpdateStateByKey ─────────────────────────────────────

    /** Public getter — compiled output checks this before updateStateByKey */
    get canUpdateStateByKey(): boolean {
        return this._canUpdateStateByKey;
    }

    /**
     * Lock — ngăn update$xxx() hoạt động sau initialization.
     * Gọi cuối commitConstructorData().
     */
    lockUpdateRealState(): void {
        this._canUpdateStateByKey = false;
    }

    /**
     * Unlock — cho phép updateVariableData gọi update$xxx lại.
     * Gọi trước updateVariableData(), lock lại khi xong.
     */
    unlockUpdateRealState(): void {
        this._canUpdateStateByKey = true;
    }

    /**
     * Bulk state update — set nhiều state keys QUIETLY (không trigger listeners).
     * Dùng trong initialization — set initial values trước khi lock.
     */
    updateRealState(stateMap: Record<string | number, any>): void {
        if (!this._canUpdateStateByKey) return;
        for (const key in stateMap) {
            if (stateMap.hasOwnProperty(key) && this.states[key]) {
                this.states[key].value = stateMap[key];
            }
        }
    }

    // ─── useState ───────────────────────────────────────────────

    /**
     * Create a reactive state — similar to React's useState.
     * 
     * @returns [currentValue, setValue, stateKey]
     * 
     * Also defines a getter/setter on the ViewState instance so that
     * `viewState.count` reads/writes the state reactively.
     */
    useState(value: any, key?: string | number): [any, (newValue: any) => void, string | number] {
        // If key already exists, return existing state
        if (key !== undefined && key !== null && this.states[key]) {
            return [this.states[key].value, this.states[key].setValue, key];
        }

        const stateKey = String(key ?? this.stateIndex++);

        const setValue = (newValue: any) => {
            const oldValue = this.states[stateKey].value;
            this.states[stateKey].value = newValue;
            this.commitStateChange(stateKey, oldValue);
        };

        this.states[stateKey] = { value, setValue, key: stateKey };
        this.setters[stateKey] = setValue;

        // Define reactive property on ViewState if not a reserved name
        if (!this.ownProperties.includes(stateKey)) {
            const self = this;
            Object.defineProperty(this.stateInstance, stateKey, {
                get: () => self.states[stateKey].value,
                set: (val) => {
                    if (typeof self.setters[stateKey] === 'function') {
                        self.setters[stateKey](val);
                    }
                },
                configurable: false,
                enumerable: true,
            });
        }

        return [value, setValue, stateKey];
    }

    // ─── State Access ───────────────────────────────────────────

    /** Register shorthand — just returns the setter */
    register(key: string | number, value: any): (newValue: any) => void {
        return this.useState(value, key)[1];
    }

    /** Update state by key */
    updateStateByKey(key: string | number, value: any): any {
        if (!this.states[key]) return undefined;
        const oldValue = this.states[key].value;
        this.states[key].value = value;
        this.commitStateChange(key, oldValue);
        return value;
    }

    /**
     * Get state value by key — supports nested paths: 'user.name', 'items.0.id'
     */
    getStateByKey(key: string | number): any {
        const keyStr = String(key);

        if (!keyStr.includes('.')) {
            return this.states[keyStr]?.value ?? null;
        }

        const paths = keyStr.split('.');
        const rootKey = paths[0];
        if (!this.states[rootKey]) return null;

        let current = this.states[rootKey].value;
        for (let i = 1; i < paths.length; i++) {
            if (typeof current !== 'object' || current === null) return null;
            current = current[paths[i]];
            if (current === undefined) return null;
        }
        return current;
    }

    /**
     * Update nested state by dot-path key: 'user.name' → clones root, sets nested, triggers change
     */
    updateStateAddressKey(key: string | number, value: any): void {
        const keyStr = String(key);
        const keyPaths = keyStr.split('.');
        const rootKey = keyPaths.shift();
        if (!rootKey || !this.states[rootKey]) return;

        const stateValue = this.states[rootKey].value;
        if (keyPaths.length === 0 || typeof stateValue !== 'object' || stateValue === null) {
            return this.setters[rootKey]?.(value);
        }

        // Clone to create a new reference for reactivity detection
        let clonedValue = Array.isArray(stateValue) ? [...stateValue] : { ...stateValue };
        let current: any = clonedValue;

        for (let i = 0; i < keyPaths.length - 1; i++) {
            const path = keyPaths[i];
            if (typeof current[path] !== 'object' || current[path] === null) {
                current[path] = {};
            } else {
                current[path] = Array.isArray(current[path]) ? [...current[path]] : { ...current[path] };
            }
            current = current[path];
        }
        current[keyPaths[keyPaths.length - 1]] = value;
        this.setters[rootKey]?.(clonedValue);
    }

    // ─── Subscribe / Unsubscribe ────────────────────────────────

    subscribe(
        key: string | number | string[] | Record<string, StateListener>,
        callback?: StateListener
    ): () => void {
        // Array of keys
        if (Array.isArray(key)) {
            if (key.length === 0) return () => {};
            if (key.length === 1 && callback) return this.subscribe(key[0], callback);
            if (typeof callback !== 'function') return () => {};

            const keys = new Set<string | number>();
            for (const k of key) {
                if (this.states[k]) keys.add(k);
            }
            if (keys.size === 0) return () => {};

            const listener: MultiKeyStateListener = { keys, callback, called: false };
            this.multiKeyListeners.push(listener);

            return () => {
                const idx = this.multiKeyListeners.indexOf(listener);
                if (idx !== -1) this.multiKeyListeners.splice(idx, 1);
            };
        }

        // Object map of keys → callbacks
        if (typeof key === 'object' && key !== null) {
            const unsubs: Record<string, () => void> = {};
            for (const k in key) {
                unsubs[k] = this.subscribe(k, key[k]);
            }
            return () => { for (const k in unsubs) unsubs[k](); };
        }

        // Single key
        if (typeof callback !== 'function') return () => {};
        if (!this.listeners.has(key)) this.listeners.set(key, []);
        this.listeners.get(key)!.push(callback);
        const index = this.listeners.get(key)!.length - 1;

        return () => {
            const listeners = this.listeners.get(key);
            if (listeners) {
                listeners.splice(index, 1);
                if (listeners.length === 0) this.listeners.delete(key);
            }
        };
    }

    unsubscribe(
        key: string | number | string[] | Record<string, StateListener>,
        callback?: StateListener
    ): void {
        if (Array.isArray(key)) {
            if (key.length === 0) return;
            if (key.length === 1) { this.unsubscribe(key[0], callback); return; }

            const keySet = new Set(key);
            if (!callback) {
                for (let i = this.multiKeyListeners.length - 1; i >= 0; i--) {
                    if (this.setsEqual(this.multiKeyListeners[i].keys, keySet)) {
                        this.multiKeyListeners.splice(i, 1);
                    }
                }
                return;
            }
            const idx = this.multiKeyListeners.findIndex(l =>
                l.callback === callback && this.setsEqual(l.keys, keySet)
            );
            if (idx !== -1) this.multiKeyListeners.splice(idx, 1);
            return;
        }

        if (typeof key === 'object' && key !== null) {
            for (const k in key) this.unsubscribe(k, key[k]);
            return;
        }

        if (callback) {
            const listeners = this.listeners.get(key);
            if (listeners) {
                const idx = listeners.indexOf(callback);
                if (idx !== -1) {
                    listeners.splice(idx, 1);
                    if (listeners.length === 0) this.listeners.delete(key);
                }
            }
        } else {
            this.listeners.delete(key);
        }
    }

    // ─── Batch Flush System ─────────────────────────────────────

    private commitStateChange(key: string | number, _oldValue: any): void {
        if (this._isDestroyed) return;
        const newValue = this.states[key]?.value;
        if (_oldValue === newValue) return;

        this.pendingChanges.add(key);

        if (!this.hasPendingFlush) {
            this.hasPendingFlush = true;
            this.flushRAF = requestAnimationFrame(() => this.executeFlush());
        }
    }

    private executeFlush(): void {
        if (this._isDestroyed || this.isFlushing) return;
        try {
            this.isFlushing = true;
            this.flushChanges();
        } finally {
            this.isFlushing = false;
            this.hasPendingFlush = false;
            this.flushRAF = null;
        }
    }

    private flushChanges(): void {
        if (this.pendingChanges.size === 0) return;

        const changed = Array.from(this.pendingChanges);
        this.pendingChanges.clear();

        // Reset multi-key listener flags
        for (const listener of this.multiKeyListeners) {
            listener.called = false;
        }

        // Notify single-key listeners
        for (const changedKey of changed) {
            const listeners = this.listeners.get(changedKey);
            if (listeners) {
                const currentValue = this.states[changedKey]?.value;
                for (const listener of listeners) {
                    try { listener(currentValue); }
                    catch (e) { console.error('[ViewState] Listener error:', e); }
                }
            }

            // Notify multi-key listeners
            for (const mkl of this.multiKeyListeners) {
                if (!mkl.called && mkl.keys.has(changedKey)) {
                    mkl.called = true;
                    const values: Record<string, any> = {};
                    for (const k of mkl.keys) {
                        if (changed.includes(k as any)) {
                            values[String(k)] = this.states[k]?.value;
                        }
                    }
                    try { mkl.callback(values); }
                    catch (e) { console.error('[ViewState] Multi-key listener error:', e); }
                }
            }
        }
    }

    // ─── Cleanup ────────────────────────────────────────────────

    destroy(): void {
        this._isDestroyed = true;
        if (this.flushRAF !== null) {
            cancelAnimationFrame(this.flushRAF);
            this.flushRAF = null;
        }
        this.listeners.clear();
        this.multiKeyListeners = [];
        this.pendingChanges.clear();
        this.states = {};
        this.setters = {};
        this.controller = null;
    }

    // ─── Helpers ────────────────────────────────────────────────

    private setsEqual(a: Set<any>, b: Set<any>): boolean {
        if (a.size !== b.size) return false;
        for (const item of a) if (!b.has(item)) return false;
        return true;
    }

    /** Debug: get all state data as plain object */
    toJSON(): Record<string | number, any> {
        const data: Record<string | number, any> = {};
        for (const key in this.states) data[key] = this.states[key].value;
        return data;
    }
}

/**
 * ViewState — thin wrapper around StateManager.
 * 
 * Provides a clean API surface for view code:
 *   - viewState.count        → getter reads state value
 *   - viewState.count = 5    → setter triggers reactive update
 *   - viewState.__           → access StateManager directly
 *   - viewState.on('count', cb) → subscribe shorthand
 * 
 * The StateManager is stored as a non-enumerable `__` property
 * to keep it hidden from serialization/iteration.
 */
export class ViewState implements ViewStateInterface {
    __!: StateManager;
    [key: string]: any;

    constructor(controller?: ViewControllerInterface | null) {
        const manager = new StateManager(this, controller);
        Object.defineProperty(this, '__', {
            value: manager,
            writable: false,
            configurable: false,
            enumerable: false,
        });
    }

    on(
        key: string | number | string[] | Record<string, (value: any) => void>,
        callback?: (value: any) => void
    ): () => void {
        return this.__.subscribe(key, callback);
    }

    off(
        key: string | number | string[] | Record<string, (value: any) => void>,
        callback?: (value: any) => void
    ): void {
        this.__.unsubscribe(key, callback);
    }

    unsubscribe(
        key: string | number | string[] | Record<string, (value: any) => void>,
        callback?: (value: any) => void
    ): void {
        this.__.unsubscribe(key, callback);
    }

    /**
     * __useState — wrapper API cho compiled output.
     * Tương tự React useState, return [value, setter].
     *
     * Compiled output: const useState = (value) => __STATE__.__useState(value);
     */
    __useState(value: any, key?: string | number): [any, (newValue: any) => void] {
        const [val, setter] = this.__.useState(value, key);
        return [val, setter];
    }
}
