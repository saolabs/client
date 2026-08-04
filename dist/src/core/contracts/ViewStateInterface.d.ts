export interface ViewStateInterface {
    /** StateManager accessor */
    __: StateManagerInterface;
    /** Subscribe to state changes */
    on(key: string | number | string[] | Record<string, (value: any) => void>, callback?: (value: any) => void): () => void;
    /** Unsubscribe */
    off(key: string | number | string[] | Record<string, (value: any) => void>, callback?: (value: any) => void): void;
    [key: string]: any;
}
export interface StateManagerInterface {
    /** Create reactive state — returns [value, setter, key] */
    useState(value: any, key?: string | number): [any, (newValue: any) => void, string | number];
    /**
     * State dẫn xuất có memo hoá — chỉ tính lại khi `deps` đổi, và lazy
     * (đánh dấu bẩn lúc dep đổi, tính lúc đọc). Đọc qua `getStateByKey(key)`
     * hoặc `subscribe([key])` như state thường.
     */
    computed(key: string, fn: () => any, deps?: string[]): () => any;
    /** Update state by key */
    updateStateByKey(key: string | number, value: any): any;
    /** Get state value by key (supports nested paths: 'user.name') */
    getStateByKey(key: string | number): any;
    /** Subscribe to state changes */
    subscribe(key: string | number | string[] | Record<string, (value: any) => void>, callback?: (value: any) => void): () => void;
    /** Unsubscribe */
    unsubscribe(key: string | number | string[] | Record<string, (value: any) => void>, callback?: (value: any) => void): void;
    /**
     * Register shorthand — pre-declare a state slot, returns setter.
     * Value is optional — compiler calls register(key) with 1 arg;
     * initial value is set later via update$xxx() in commitConstructorData.
     */
    register(key: string | number, value?: any): (newValue: any) => void;
    /**
     * Setter map — exposed for direct access by compiled views.
     * e.g. __STATE__.__.setters.setCount = setCount;
     */
    setters: Record<string | number, (value: any) => void>;
    /**
     * Flag — true while commitConstructorData is running, false after lockUpdateRealState().
     * Compiler-generated update$xxx() checks this before calling updateStateByKey.
     */
    readonly canUpdateStateByKey: boolean;
    /**
     * Lock — called at end of commitConstructorData() to prevent update$xxx from
     * being accidentally triggered after initialization.
     */
    lockUpdateRealState(): void;
    /**
     * Unlock — called before updateVariableData() to allow update$xxx again.
     */
    unlockUpdateRealState(): void;
    /**
     * Flush đồng bộ pending state changes (huỷ RAF đang chờ nếu có).
     * Dùng sau commitData()/mount để DOM phản ánh state ngay trong cùng tick.
     */
    flushNow(): void;
    /** Destroy — cleanup all listeners and states */
    destroy(): void;
}
/** State listener callback */
export type StateListener = (value: any) => void;
/** Multi-key state listener */
export interface MultiKeyStateListener {
    keys: Set<string | number>;
    callback: (values: Record<string, any>) => void;
    called: boolean;
}
/** State item stored internally by StateManager */
export interface StateItem {
    value: any;
    setValue: (value: any) => void;
    key: string | number;
}
//# sourceMappingURL=ViewStateInterface.d.ts.map