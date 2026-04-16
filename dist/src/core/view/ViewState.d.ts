import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { StateManagerInterface, ViewStateInterface, StateListener } from "../contracts/ViewStateInterface";
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
export declare class StateManager implements StateManagerInterface {
    private states;
    private listeners;
    private multiKeyListeners;
    private pendingChanges;
    private stateIndex;
    private flushRAF;
    private hasPendingFlush;
    private isFlushing;
    private _isDestroyed;
    /** Flag — cho phép update state qua update$xxx chỉ trước lock */
    private _canUpdateStateByKey;
    /** Setter functions exposed for direct property assignment on ViewState */
    setters: Record<string | number, (value: any) => void>;
    /** Reference to owning ViewController */
    controller: ViewControllerInterface | null;
    /** Reference to owning ViewState wrapper */
    private stateInstance;
    /** Properties that should NOT become state keys */
    private ownProperties;
    constructor(stateInstance: ViewState, controller?: ViewControllerInterface | null);
    /** Public getter — compiled output checks this before updateStateByKey */
    get canUpdateStateByKey(): boolean;
    /**
     * Lock — ngăn update$xxx() hoạt động sau initialization.
     * Gọi cuối commitConstructorData().
     */
    lockUpdateRealState(): void;
    /**
     * Unlock — cho phép updateVariableData gọi update$xxx lại.
     * Gọi trước updateVariableData(), lock lại khi xong.
     */
    unlockUpdateRealState(): void;
    /**
     * Bulk state update — set nhiều state keys QUIETLY (không trigger listeners).
     * Dùng trong initialization — set initial values trước khi lock.
     */
    updateRealState(stateMap: Record<string | number, any>): void;
    /**
     * Create a reactive state — similar to React's useState.
     *
     * @returns [currentValue, setValue, stateKey]
     *
     * Also defines a getter/setter on the ViewState instance so that
     * `viewState.count` reads/writes the state reactively.
     */
    useState(value: any, key?: string | number): [any, (newValue: any) => void, string | number];
    /** Register shorthand — just returns the setter */
    register(key: string | number, value: any): (newValue: any) => void;
    /** Update state by key */
    updateStateByKey(key: string | number, value: any): any;
    /**
     * Get state value by key — supports nested paths: 'user.name', 'items.0.id'
     */
    getStateByKey(key: string | number): any;
    /**
     * Update nested state by dot-path key: 'user.name' → clones root, sets nested, triggers change
     */
    updateStateAddressKey(key: string | number, value: any): void;
    subscribe(key: string | number | string[] | Record<string, StateListener>, callback?: StateListener): () => void;
    unsubscribe(key: string | number | string[] | Record<string, StateListener>, callback?: StateListener): void;
    private commitStateChange;
    private executeFlush;
    private flushChanges;
    destroy(): void;
    private setsEqual;
    /** Debug: get all state data as plain object */
    toJSON(): Record<string | number, any>;
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
export declare class ViewState implements ViewStateInterface {
    __: StateManager;
    [key: string]: any;
    constructor(controller?: ViewControllerInterface | null);
    on(key: string | number | string[] | Record<string, (value: any) => void>, callback?: (value: any) => void): () => void;
    off(key: string | number | string[] | Record<string, (value: any) => void>, callback?: (value: any) => void): void;
    unsubscribe(key: string | number | string[] | Record<string, (value: any) => void>, callback?: (value: any) => void): void;
    /**
     * __useState — wrapper API cho compiled output.
     * Tương tự React useState, return [value, setter].
     *
     * Compiled output: const useState = (value) => __STATE__.__useState(value);
     */
    __useState(value: any, key?: string | number): [any, (newValue: any) => void];
}
//# sourceMappingURL=ViewState.d.ts.map