import type { ViewType } from "../contracts/ViewControllerInterface";
import type { ViewInterface, ViewLifecycleHooks } from "../contracts/ViewInterface";
import type { SaoObjectType } from "../types/utils";
import { ViewController } from "./ViewController";
/**
 * View — the base class for all views in SaoView.
 *
 * A View is the unit that the user writes. It contains:
 *   - User-defined properties (reactive state, computed values)
 *   - User-defined methods (event handlers, business logic)
 *   - Lifecycle hooks (onInit, onMounted, onUpdated, onDestroy)
 *   - A ViewController (hidden as __ctrl__) that manages everything internally
 *
 * The ViewController is non-enumerable so it doesn't show up in serialization
 * or when iterating over the View's properties.
 *
 * Usage:
 *   Typically the compiler generates a subclass of View with $__setup__
 *   that declares state, methods, and the render factory.
 *
 * @example
 * // Compiled output from counter.one:
 * class CounterView extends View {
 *     $__setup__() {
 *         const [count, setCount] = this.__ctrl__.states.__.useState(0, 'count');
 *         this.count = count;
 *         this.setCount = setCount;
 *         this.increment = () => setCount(this.count + 1);
 *     }
 * }
 */
export declare class View implements ViewInterface, ViewLifecycleHooks {
    __ctrl__: ViewController;
    [key: string]: any;
    constructor(path: string, viewType?: ViewType, viewControllerClass?: any);
    /**
     * Setup hook — called by framework after construction.
     * Compiled .one output overrides this to declare state, methods, render factory.
     *
     * @param __data__    — Route params, props, etc.
     * @param systemData  — System-level data (SSR data, global config, etc.)
     */
    $__setup__(__data__?: Record<string, any>, systemData?: Record<string, any>): void;
    onInit?(): void | Promise<void>;
    onMounted?(): void | Promise<void>;
    onUpdated?(): void | Promise<void>;
    onDestroy?(): void | Promise<void>;
    onActivated?(): void | Promise<void>;
    onDeactivated?(): void | Promise<void>;
    get path(): string;
    get viewType(): ViewType;
    /** Shortcut to controller */
    get __(): ViewController;
    /** Shortcut to ViewState */
    get $state(): any;
    get saoType(): SaoObjectType;
    set saoType(value: SaoObjectType);
    get parent(): ViewInterface | null;
    get children(): ViewInterface[];
    get superView(): ViewInterface | null;
    get originView(): ViewInterface | null;
}
//# sourceMappingURL=View.d.ts.map