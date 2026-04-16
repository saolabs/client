import type { ViewControllerInterface, ViewType } from "../contracts/ViewControllerInterface";
import type { ViewInterface, ViewLifecycleHooks } from "../contracts/ViewInterface";
import type { OneObjectType } from "../types/utils";
import { ViewController } from "./ViewController";

/**
 * View — the base class for all views in OneView.
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
export class View implements ViewInterface, ViewLifecycleHooks {
    public __ctrl__!: ViewController;
    [key: string]: any;

    constructor(path: string, viewType: ViewType = 'view', viewControllerClass?: any) {
        const CtrlClass = viewControllerClass ?? ViewController;
        const controller = new CtrlClass(this, path, viewType);

        // Store controller as non-enumerable, non-writable property
        Object.defineProperty(this, '__ctrl__', {
            value: controller,
            writable: false,
            enumerable: false,
            configurable: false,
        });
    }

    /**
     * Setup hook — called by framework after construction.
     * Compiled .one output overrides this to declare state, methods, render factory.
     * 
     * @param __data__    — Route params, props, etc.
     * @param systemData  — System-level data (SSR data, global config, etc.)
     */
    $__setup__(__data__: Record<string, any> = {}, systemData: Record<string, any> = {}): void {
        // Override in subclass
    }

    // ─── Lifecycle Hooks ────────────────────────────────────────
    // Users can override these in their view class

    onInit?(): void | Promise<void>;
    onMounted?(): void | Promise<void>;
    onUpdated?(): void | Promise<void>;
    onDestroy?(): void | Promise<void>;
    onActivated?(): void | Promise<void>;
    onDeactivated?(): void | Promise<void>;

    // ─── Convenience Accessors ──────────────────────────────────

    get path(): string {
        return this.__ctrl__.path;
    }

    get viewType(): ViewType {
        return this.__ctrl__.viewType;
    }

    /** Shortcut to controller */
    get __(): ViewController {
        return this.__ctrl__;
    }

    /** Shortcut to ViewState */
    get $state(): any {
        return this.__ctrl__.states;
    }
    get oneType(): OneObjectType {
        return 'View';
    }
    set oneType(value: OneObjectType) {
        // No-op setter to satisfy the Interface; this property is always 'View'
    }

    get parent(): ViewInterface | null {
        return this.__ctrl__.getParentView();
    }
    get children(): ViewInterface[] {
        return this.__ctrl__.getChildrenViews();
    }
    get superView(): ViewInterface | null {
        return this.__ctrl__.getSuperView();
    }
    get originView(): ViewInterface | null {
        return this.__ctrl__.getOriginView();
    }
}
