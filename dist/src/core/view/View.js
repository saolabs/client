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
export class View {
    constructor(path, viewType = 'view', viewControllerClass) {
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
    $__setup__(__data__ = {}, systemData = {}) {
        // Override in subclass
    }
    // ─── Convenience Accessors ──────────────────────────────────
    get path() {
        return this.__ctrl__.path;
    }
    get viewType() {
        return this.__ctrl__.viewType;
    }
    /** Shortcut to controller */
    get __() {
        return this.__ctrl__;
    }
    /** Shortcut to ViewState */
    get $state() {
        return this.__ctrl__.states;
    }
    get oneType() {
        return 'View';
    }
    set oneType(value) {
        // No-op setter to satisfy the Interface; this property is always 'View'
    }
    get parent() {
        return this.__ctrl__.getParentView();
    }
    get children() {
        return this.__ctrl__.getChildrenViews();
    }
    get superView() {
        return this.__ctrl__.getSuperView();
    }
    get originView() {
        return this.__ctrl__.getOriginView();
    }
}
//# sourceMappingURL=View.js.map