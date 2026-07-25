import type { ViewInterface } from "./ViewInterface";
import type { ApplicationInterface } from "./ApplicationInterface";
import { RouterNavigationType } from "./RouterInterface";


// ─── ViewManager Interface ───────────────────────────────────────

export interface ActiveViewInfo {
    view: ViewInterface;
    path: string;
    isLayout: boolean;
    isActive: boolean;
}

export interface ViewManagerInterface {
    [key: string]: any;
    /** Set DI container */
    setApp(app: ApplicationInterface): void;
    /** Set root DOM container */
    setContainer(container: HTMLElement): void;
    /** Get root container */
    getContainer(): HTMLElement | null;
    /** Register view modules by name */
    setViewRegistry(registry: Record<string, ((...args: any[]) => any) | (() => Promise<any>)>): void;
    /** Register a single view module */
    registerView(name: string, loader: ((...args: any[]) => any) | (() => Promise<any>)): void;
    /** Initialize with optional config */
    init(config?: { container?: HTMLElement; registry?: Record<string, any> }): void;
    /** Mount a view by name — main entry point */
    mountView(name: string, data?: Record<string, any>, route?: any, navigationType?: RouterNavigationType ): any;
    /**
     * Hydrate a server-side rendered view.
     * data PHẢI có __SSR_VIEW_ID__ — viewId mà Blade dùng để prefix element classes.
     */
    hydrateView(name: string, data: Record<string, any> & { __SSR_VIEW_ID__: string }, route?: any): any;
    /** Còn SSR boot chưa consume? (route đầu tiên nên hydrate thay vì mount) */
    hasSSRBoot?(): boolean;
    /** Lấy + consume viewId SSR cho view name (chỉ trả 1 lần, cho route đầu) */
    consumeSSRViewId?(viewName: string): string | null;
    /** Unmount all active views */
    unmountAll(): void;
    /** Unmount a specific view by path */
    unmountView(path: string): void;
    /** Get currently active page view */
    getCurrentView(): ViewInterface | null;
    /** Get current layout view */
    getCurrentLayout(): ViewInterface | null;
    /** Get full view stack */
    getViewStack(): ViewInterface[];
    /** Check if a view is mounted */
    isViewMounted(path: string): boolean;
    /** Invalidate async work of the navigation currently being rendered. */
    cancelNavigation?(): void;
    /** Full destroy */
    destroy(): void;
    /**
     * generateViewId — tạo unique ID cho mỗi view instance.
     * Compiled output gọi: App.View.generateViewId()
     */
    generateViewId(): string;
    /**
     * exists — kiểm tra view đã đăng ký trong registry chưa.
     * Dùng bởi @includeIf directive.
     */
    exists(name: string): boolean;
    /**
     * view — lấy view instance từ registry, có thể cache.
     */
    view(name: string, data: Record<string, any>, cache: boolean): any;
}
