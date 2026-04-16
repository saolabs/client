/**
 * ViewManager — Orchestrateur quản lý view lifecycle.
 *
 * Responsibilities:
 *   1. Load view modules (dynamic import hoặc registry)
 *   2. Invoke factory → get View instance
 *   3. Resolve layout chain (if hasSuperView)
 *   4. Mount vào container
 *   5. commitData cho all views in chain
 *   6. Start all views (activate reactivity)
 *   7. Track active views for cleanup
 *
 * Khác core/ ViewManager:
 *   - Nhẹ hơn (~300 dòng thay vì 1145)
 *   - Tách rõ concern: ViewManager chỉ orchestrate, không render HTML string
 *   - Element tree rendering → ViewController.render()
 *   - Section system → Block/BlockOutlet
 */
import type { ApplicationInterface } from "../contracts/ApplicationInterface";
import { ActiveRouteInterface, RouterNavigationType } from "../contracts/RouterInterface";
import { HtmlInterface } from "../contracts/utils";
import type { ViewInterface } from "../contracts/ViewInterface";
import type { ViewManagerInterface } from "../contracts/ViewManagerInterface";
import { BlockManagerService } from "../services/BlockManager";
import { StoreService } from "../services/StoreService";
import { InitMode } from "../contracts/common";
type RenderPageViewSuccess = {
    type: 'success';
    message: string;
    view: ViewInterface;
    result: ViewInterface | unknown;
    superView: ViewInterface | null;
    finalView: ViewInterface;
};
type RenderPageViewError = {
    type: 'error';
    message: string;
    view: ViewInterface;
    result: null;
    superView: null;
    finalView: ViewInterface;
};
type RenderPageViewResult = RenderPageViewSuccess | RenderPageViewError;
export declare class ViewManager implements ViewManagerInterface {
    /** DI container */
    private App;
    private systemData;
    /** ROOT DOM container where views mount */
    private container;
    private rootElement;
    /** View module registry: name → factory or async loader */
    private viewRegistry;
    /** Currently mounted views (keyed by path) */
    private activeViews;
    /** The outermost active view (layout or page) */
    private currentView;
    /** Current layout path — for layout reuse detection */
    private currentLayoutPath;
    private currentLayoutView;
    private currentPageView;
    private currentViewType;
    /** Current layout view info — reused if same layout */
    private currentLayout;
    private cachedLayouts;
    /** All views in the current mount chain (outermost → innermost) */
    private viewStack;
    /** Whether the manager has been initialized */
    private _isInitialized;
    /** Render counter for debugging */
    private renderCount;
    store: StoreService;
    blockManager: BlockManagerService;
    constructor(app?: ApplicationInterface);
    isViewMounted(path: string): boolean;
    destroy(): void;
    /**
     * Set the DI container reference.
     */
    setApp(app: ApplicationInterface): void;
    /**
     * Set the root DOM container.
     */
    setContainer(container: HTMLElement): void;
    /**
     * Get the root container element.
     */
    getContainer(): HTMLElement | null;
    /**
     * Register view modules.
     *
     * @example
     * viewManager.setViewRegistry({
     *   'web.home': () => import('./views/web/home.js'),
     *   'web.about': () => import('./views/web/about.js'),
     *   'layouts.main': () => import('./views/layouts/main.js'),
     * });
     */
    setViewRegistry(registry: Record<string, ((...args: any[]) => any) | (() => Promise<any>)>): void;
    /**
     * Register a single view module.
     */
    registerView(name: string, loader: ((...args: any[]) => any) | (() => Promise<any>)): void;
    /**
     * Initialize the ViewManager.
     */
    init(config?: {
        container?: HTMLElement | string;
        registry?: Record<string, any>;
    }): void;
    showError(message: string, details?: any): void;
    hasView(name: string): boolean;
    exists(name: string): boolean;
    view(name: string, data: Record<string, any>, cache: boolean): any;
    private createRenderPageViewError;
    private createRenderPageViewSuccess;
    private getRenderResultType;
    callViewRenderFactory(view: ViewInterface, method?: 'render' | 'prerender', data?: Record<string, any>, mountRoot?: HtmlInterface | null, initMode?: InitMode, cache?: boolean, renderLevel?: number): Promise<RenderPageViewResult>;
    renderPageView(view: ViewInterface, data: Record<string, any>, mountRoot?: HtmlInterface | null, initMode?: InitMode, cache?: boolean, renderLevel?: number): Promise<RenderPageViewResult>;
    mountView(name: string, data?: Record<string, any>, route?: ActiveRouteInterface, navigationType?: RouterNavigationType): Promise<any>;
    /**
     * Build DOM từ finalView's Wrapper vào container.
     * Wrapper.render() sẽ execute childrenFactory → tạo DOM tree.
     */
    private buildViewDOM;
    private stopPageView;
    private stopLayoutView;
    private stopBlockContent;
    private startViewChain;
    private startLayoutView;
    private startBlockContent;
    private commitViewChain;
    private unmountLayoutDOM;
    unmountAll(): void;
    unmountView(path: string): void;
    getCurrentLayout(): ViewInterface | null;
    getCurrentView(): ViewInterface | null;
    getViewStack(): ViewInterface[];
    isInitialized(): boolean;
}
export {};
//# sourceMappingURL=ViewManager.d.ts.map