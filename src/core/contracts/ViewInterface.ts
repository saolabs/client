import type { OneObjectType } from "../types/utils";
import type { ViewControllerInterface, ViewType } from "./ViewControllerInterface";
import type { FragmentInterface } from "./ElementInterface";

// ─── View Interface ──────────────────────────────────────────────

export interface ViewInterface {
    oneType: OneObjectType;
    __ctrl__: ViewControllerInterface;
    path: string;
    viewType: ViewType;
    [key: string]: any;
}

// ─── View Types ──────────────────────────────────────────────────

/** Render factory for a View — compiled output calls this to build the DOM tree */
export type ViewRenderFactory = () => FragmentInterface | ViewInterface | null;

/** View class constructor signature */
export type ViewConstructor = new (path: string, viewType: 'view' | 'layout' | 'component', viewControllerClass?: any) => ViewInterface;

/** View lifecycle hooks — user can implement any of these */
export interface ViewLifecycleHooks {
    onInit?(): void | Promise<void>;
    onMounted?(): void | Promise<void>;
    onUpdated?(): void | Promise<void>;
    onDestroy?(): void | Promise<void>;
    onActivated?(): void | Promise<void>;
    onDeactivated?(): void | Promise<void>;
}
