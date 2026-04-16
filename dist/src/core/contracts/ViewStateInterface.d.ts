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
    /** Update state by key */
    updateStateByKey(key: string | number, value: any): any;
    /** Get state value by key (supports nested paths: 'user.name') */
    getStateByKey(key: string | number): any;
    /** Subscribe to state changes */
    subscribe(key: string | number | string[] | Record<string, (value: any) => void>, callback?: (value: any) => void): () => void;
    /** Unsubscribe */
    unsubscribe(key: string | number | string[] | Record<string, (value: any) => void>, callback?: (value: any) => void): void;
    /** Register shorthand — useState alias */
    register(key: string | number, value: any): (newValue: any) => void;
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