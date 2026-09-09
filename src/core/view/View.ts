import type { ViewControllerInterface, ViewType } from "../contracts/ViewControllerInterface.js";
import type { ViewInterface, ViewLifecycleHooks } from "../contracts/ViewInterface.js";
import type { SaoObjectType } from "../types/utils.js";
import { ViewController } from "./ViewController.js";

/** Declared View API without the legacy catch-all that would hide misspelled members. */
type ViewMembers = {
    [K in keyof View as string extends K ? never : number extends K ? never : K]: View[K];
};

/** The exported object's methods run on the View after its members are merged. */
export type ViewUserConfig<T extends object> = T & ThisType<T & ViewMembers>;

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
    // Users can override these in their view class (mẫu examples/sao/app.sao).
    // Cặp before/after cho mỗi transition:
    mounting?(): void | Promise<void>;
    mounted?(): void | Promise<void>;
    starting?(): void | Promise<void>;
    started?(): void | Promise<void>;
    pausing?(): void | Promise<void>;
    paused?(): void | Promise<void>;
    resuming?(): void | Promise<void>;
    resumed?(): void | Promise<void>;
    stopping?(): void | Promise<void>;
    stopped?(): void | Promise<void>;
    unmounting?(): void | Promise<void>;
    unmounted?(): void | Promise<void>;
    destroying?(): void | Promise<void>;
    destroyed?(): void | Promise<void>;

    // Legacy alias (tương thích cũ):
    onInit?(): void | Promise<void>;
    onMounted?(): void | Promise<void>;
    onUpdated?(): void | Promise<void>;
    onDestroy?(): void | Promise<void>;
    onActivated?(): void | Promise<void>;
    onDeactivated?(): void | Promise<void>;
    onPause?(): void | Promise<void>;
    onResume?(): void | Promise<void>;

    /**
     * Phát sự kiện lên cha đã `@include` view này.
     *
     * Là method của View (không chỉ hàm trong scope compiled) để template gọi
     * thẳng được: `@click(emit('edit', card['id']))` biên dịch thành
     * `{ handler: 'emit' }`, và ViewController.addEventListener tra handler
     * dạng chuỗi trên chính View.
     */
    emit(event: string, ...args: any[]): any {
        return this.__ctrl__.emit(event, ...args);
    }

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
    get saoType(): SaoObjectType {
        return 'View';
    }
    set saoType(value: SaoObjectType) {
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
