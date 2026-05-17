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
import { FragmentInterface, HtmlInterface } from "../contracts/utils";
import type { ViewControllerConfig, ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { ViewInterface } from "../contracts/ViewInterface";
import type { ViewManagerInterface, ActiveViewInfo } from "../contracts/ViewManagerInterface";
import { BlockManager, BlockManagerService } from "../services/BlockManager";
import { Html } from "../elements/Html";
import { hasData } from "../helpers/utils";
import logger from "../services/LoggerService";
import { StoreService } from "../services/StoreService";
import { View } from "./View";
import { InitMode, InitModes } from "../contracts/common";
import { OOTEnum } from "../types/utils";
import { WrapperInterface } from "../contracts/ElementInterface";
import { app } from "../helpers/app";

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

function isRenderableObject(result: unknown): result is { saoType: string } {
    return typeof result === 'object' && result !== null && 'saoType' in result;
}

export class ViewManager implements ViewManagerInterface {
    /** DI container */
    private App: ApplicationInterface | null = null;

    private systemData: Record<string, any> = {}; // For internal use, not exposed to views

    /** ROOT DOM container where views mount */
    private container: HTMLElement | null = null;
    private rootElement: Html | null = null; // Html wrapper for the root container
    /** View module registry: name → factory or async loader */
    private viewRegistry: Record<string, ((...args: any[]) => any) | (() => Promise<any>)> = {};

    /** Currently mounted views (keyed by path) */
    private activeViews: Map<string, ActiveViewInfo> = new Map();

    /** The outermost active view (layout or page) */
    private currentView: ActiveViewInfo | null = null;

    /** Current layout path — for layout reuse detection */
    private currentLayoutPath: string | null = null;

    private currentLayoutView: ViewInterface | null = null; // Store the current layout view instance for reuse
    private currentPageView: ViewInterface | null = null; // Store the current page view instance for reference in blocks and sections
    private currentViewType: 'view' | 'layout' | null = null; // Track whether the current view is a page or layout for correct lifecycle handling


    /** Current layout view info — reused if same layout */
    private currentLayout: ActiveViewInfo | null = null;

    private cachedLayouts: Map<string, ViewInterface> = new Map(); // Cache for previously mounted layouts

    /** All views in the current mount chain (outermost → innermost) */
    private viewStack: ViewInterface[] = [];

    /** Whether the manager has been initialized */
    private _isInitialized = false;

    /** Render counter for debugging */
    private renderCount = 0;

    public store: StoreService = StoreService.instance("ViewManager");

    public blockManager: BlockManagerService = BlockManager;

    constructor(app?: ApplicationInterface) {
        if (app) this.App = app;
    }
    isViewMounted(path: string): boolean {
        throw new Error("Method not implemented.");
    }
    destroy(): void {
        throw new Error("Method not implemented.");
    }


    // ─── Configuration ──────────────────────────────────────────

    /**
     * Set the DI container reference.
     */
    setApp(app: ApplicationInterface): void {
        this.App = app;
    }

    /**
     * Set the root DOM container.
     */
    setContainer(container: HTMLElement): void {
        this.container = container;
    }

    /**
     * Get the root container element.
     */
    getContainer(): HTMLElement | null {
        return this.container;
    }

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
    setViewRegistry(registry: Record<string, ((...args: any[]) => any) | (() => Promise<any>)>): void {
        this.viewRegistry = { ...this.viewRegistry, ...registry };
    }

    /**
     * Register a single view module.
     */
    registerView(name: string, loader: ((...args: any[]) => any) | (() => Promise<any>)): void {
        this.viewRegistry[name] = loader;
    }

    /**
     * Initialize the ViewManager.
     */
    init(config?: { container?: HTMLElement | string; registry?: Record<string, any> }): void {
        if (config?.container) {
            if (typeof config.container === 'string') {
                const found = document.querySelector(config.container);
                if (found instanceof HTMLElement) {
                    this.container = found;

                } else {
                    console.warn(`[ViewManager] Container selector "${config.container}" not found.`);
                }
            } else {
                this.container = config.container instanceof HTMLElement ? config.container : document.body;
            }
        }
        if (!this.container) {
            this.container = document.body; // Default to body if no container provided
        }
        this.rootElement = new Html({
            ctx: this,
            tagName: this.container.tagName.toLowerCase(),
            element: this.container,
            initMode: 'hydrate',
            childrenFactory: () => [],
        });
        if (config?.registry) {
            this.setViewRegistry(config.registry);
        }
        this._isInitialized = true;
    }

    showError(message: string, details?: any) {
        logger.error(message, details);
        if (this.container) {
            this.container.innerHTML = `<div style="padding: 20px; background: #fee; color: #900; border: 1px solid #900;">
                <h2>Error</h2>
                <p>${message}</p>
                ${details ? `<pre style="white-space: pre-wrap; background: #fdd; padding: 10px; border: 1px solid #900;">${JSON.stringify(details, null, 2)}</pre>` : ''}
            </div>`;
        }
    }

    // ─── View Loading ───────────────────────────────────────────
    hasView(name: string): boolean {
        return Object.prototype.hasOwnProperty.call(this.viewRegistry, name);
    }

    exists(name: string): boolean {
        return this.hasView(name);
    }

    view(name: string, data: Record<string, any>, cache: boolean): any {
        try {
            if (cache && this.store.has(name)) {
                const cachedView = this.store.get<View>(name);
                if (hasData(data)) {
                    cachedView?.__ctrl__.updateData(data);
                }
                return cachedView;
            }
            const factory = this.viewRegistry[name];
            if (!factory || typeof factory !== 'function') {
                logger.error(`View "${name}" not found in registry.`);
                return null;
            }
            const view = factory(data ? { data } : {}, { App: this.App, View: this, ...this.systemData });
            if (!view) {
                logger.error(`Factory for view "${name}" did not return a valid view instance.`);
                return null;
            }
            if (cache) {
                this.store.set(name, view);
            }
            return view;

        }
        catch (err) {
            logger.error(`Error loading view ${name}:`, err);
            return null;
        }
    }

    private createRenderPageViewError(view: ViewInterface, renderLevel: number, message?: string): RenderPageViewError {
        return {
            type: 'error',
            message: message ?? (renderLevel === 0
                ? `View "${view.__ctrl__.path}" did not return any content from render().`
                : `Nested view "${view.__ctrl__.path}" did not return any content from render().`),
            view,
            result: null,
            superView: null,
            finalView: view,
        };
    }

    private createRenderPageViewSuccess(
        view: ViewInterface,
        result: ViewInterface | unknown,
        superView: ViewInterface | null,
        finalView: ViewInterface
    ): RenderPageViewSuccess {
        return {
            type: 'success',
            message: '',
            view,
            result,
            superView,
            finalView,
        };
    }

    private getRenderResultType(result: unknown): OOTEnum {
        return isRenderableObject(result) ? result.saoType as OOTEnum : OOTEnum.UNKNOWN;
    }


    async callViewRenderFactory(
        view: ViewInterface,
        method: 'render' | 'prerender' = 'render',
        data: Record<string, any> = {},
        mountRoot: HtmlInterface | null = null,
        initMode: InitMode = InitModes.CREATE,
        cache: boolean = false,
        renderLevel: number = 0
    ): Promise<RenderPageViewResult> {
        const ctrl = view.__ctrl__;

        if (hasData(data)) {
            ctrl.updateData(data);
        }

        const result = method === 'render'
            ? ctrl.render()
            : (ctrl.prerender ? ctrl.prerender() : null);

        if (!result) {
            return this.createRenderPageViewError(view, renderLevel,
                `View "${ctrl.path}" returned nothing from ${method}().`);
        }

        const resultType = this.getRenderResultType(result);

        if (resultType === OOTEnum.WRAPPER) {
            return this.createRenderPageViewSuccess(view, result, null, view);
        }

        if (resultType === OOTEnum.VIEW) {
            const superResult = await this.renderPageView(
                result as ViewInterface, {}, mountRoot, initMode, cache, renderLevel + 1
            );
            if (superResult.type === 'error') {
                return { ...superResult, view };
            }
            return this.createRenderPageViewSuccess(
                view,
                result,
                superResult.view,
                superResult.finalView ?? (result as ViewInterface)
            );
        }

        return this.createRenderPageViewError(view, renderLevel,
            `View "${ctrl.path}" returned invalid content (type: ${resultType}) from ${method}().`);
    }

    async renderPageView(
        view: ViewInterface, 
        data: Record<string, any>, 
        mountRoot: HtmlInterface | null = null, 
        initMode: InitMode = InitModes.CREATE, 
        cache: boolean = false, 
        renderLevel: number = 0
    ): Promise<RenderPageViewResult> {
        try {
            const ctrl = view.__ctrl__;
            if (hasData(data)) {
                ctrl.updateData(data);
            }
            const config: ViewControllerConfig = ctrl.getConfig();
            const hasAsyncData = config.hasAwaitData || config.hasFetchData;

            // ── Case 1: Không có async data → render ngay ──
            if (!hasAsyncData) {
                return this.callViewRenderFactory(view, 'render', data, mountRoot, initMode, cache, renderLevel);
            }

            // ── Resolve fetch URL từ ViewController config hoặc fallback Router ──
            const App = app() as ApplicationInterface;
            const Http = App.Http;
            const fetchConfig = config.fetch;
            const fetchUrl = (config.hasAwaitData && fetchConfig?.url)? fetchConfig?.url : App.Router.getFullUrl();

            // ── Case 2: Có async + có prerender → prerender skeleton trước, fetch sau ──
            if (config.hasPrerender) {
                const prerenderResult = await this.callViewRenderFactory(view, 'prerender', data, mountRoot, initMode, cache, renderLevel);
                if (prerenderResult.type === 'error') {
                    logger.error(`Error prerendering view "${ctrl.path}":`, prerenderResult.message);
                    // Fallback: render trực tiếp không qua prerender
                    return this.callViewRenderFactory(view, 'render', data, mountRoot, initMode, cache, renderLevel);
                }

                // Fire-and-forget: fetch data rồi re-render thay thế skeleton
                // TODO: Sau khi render() xong, cần swap DOM từ preloadElement → mainElement
                // ViewController.wrapper() tự động lưu prerender vào preloadElement, render vào mainElement
                // Cần bổ sung logic: unmount preloadElement khỏi DOM → mount mainElement vào cùng vị trí
                Http.get(fetchUrl).then(async (response: any) => {
                    const asyncData = response?.data ?? {};
                    if (hasData(asyncData)) {
                        ctrl.updateData(asyncData);
                    }
                    const finalResult = await this.callViewRenderFactory(view, 'render', asyncData, mountRoot, initMode, cache, renderLevel);
                    if (finalResult.type === 'error') {
                        logger.error(`Error rendering view "${ctrl.path}" after async data fetch:`, finalResult.message);
                    }
                    // TODO: swap preloadElement → mainElement trong DOM
                    // ctrl.preloadElement?.destroy();
                    // ctrl.mainElement?.setParentElement(mountRoot);
                    // ctrl.mainElement?.render();
                }).catch((err: any) => {
                    logger.error(`Error fetching async data for view "${ctrl.path}":`, err);
                });

                // Return prerender result ngay — mountView sẽ mount skeleton
                return prerenderResult;
            }

            // ── Case 3: Có async + không prerender → await fetch rồi render ──
            let asyncData: Record<string, any> = {};
            try {
                const response = await Http.get(fetchUrl);
                asyncData = response?.data ?? {};
            } catch (err) {
                logger.error(`Error fetching async data for view "${ctrl.path}":`, err);
            }

            if (!hasData(asyncData)) {
                logger.warn(`View "${ctrl.path}" has async data config but fetch returned no data.`);
            }

            return this.callViewRenderFactory(view, 'render', asyncData, mountRoot, initMode, cache, renderLevel);
        }
        catch (err) {
            logger.error(`Error rendering view ${view.__ctrl__.path}:`, err);
            return this.createRenderPageViewError(view, renderLevel, `Error rendering view "${view.__ctrl__.path}".`);
        }
    }










    // ─── Mount Orchestration ────────────────────────────────────

    async mountView(name: string, data?: Record<string, any>, route?: ActiveRouteInterface, navigationType: RouterNavigationType = 'push'): Promise<any> {
        // ── Phase 1: Load view ──
        const view = this.view(name, data ?? {}, true);
        if (!view) {
            this.showError(`Failed to load view "${name}".`);
            return null;
        }

        const oldPageView = this.currentPageView;
        const oldLayoutView = this.currentLayoutView;
        const oldLayoutPath = this.currentLayoutPath;

        view.__ctrl__.urlPath = route?.$urlPath ?? null;

        if(oldLayoutView){
            oldLayoutView.__ctrl__.stop();
            oldLayoutView.__ctrl__.deactive();
        }
        oldPageView?.__ctrl__.stop();
        oldPageView?.__ctrl__.deactive();

        // ── Phase 2: Render chain ──
        const renderResult = await this.renderPageView(view, data ?? {}, this.rootElement, InitModes.CREATE, true);
        if (renderResult.type === 'error') {
            this.showError(renderResult.message);
            return null;
        }

        const pageView: ViewInterface = renderResult.view;
        const finalView: ViewInterface = renderResult.finalView;
        const hasSuperView = renderResult.superView !== null;
        const newLayoutPath = hasSuperView ? finalView.__ctrl__.path : null;

        // bắt đầu logic

        // ── Phase 3: Classify mount scenario ──
        const isSameLayout = hasSuperView
            && oldLayoutView !== null
            && finalView === oldLayoutView;

        // ── Duplicate navigation guard ──
        if (oldPageView === pageView
            && view.__ctrl__.urlPath === oldPageView?.__ctrl__?.urlPath) {
            return renderResult;
        }

        // ============══════════════════════════════════════════════════════════
        // case 1: khong có superView
        if(!hasSuperView){
            if(oldLayoutView){
                this.currentLayoutView = null;
                this.currentLayoutPath = null;
            }

            pageView.__ctrl__.setParentElement(this.rootElement!);
            if(pageView.__ctrl__.mainElement){
                pageView.__ctrl__.mainElement.setParentElement(this.rootElement!);
                
            }
            else if(pageView.__ctrl__.preloadElement){
                pageView.__ctrl__.preloadElement.setParentElement(this.rootElement!);
            }

        }


        // ── Update state ──
        this.currentPageView = pageView;
        this.currentLayoutView = hasSuperView ? finalView : null;
        this.currentLayoutPath = newLayoutPath;
        this.currentViewType = hasSuperView ? 'layout' : 'view';
        this.viewStack = hasSuperView ? [finalView, pageView] : [pageView];
        this.renderCount++;

        return renderResult;
    }

    // ─── DOM Building ───────────────────────────────────────────

    /**
     * Build DOM từ finalView's Wrapper vào container.
     * Wrapper.render() sẽ execute childrenFactory → tạo DOM tree.
     */
    private buildViewDOM(finalView: ViewInterface): void {
        const wrapper = finalView.__ctrl__.mainElement;
        if (!wrapper) {
            logger.error(`[ViewManager] finalView "${finalView.__ctrl__.path}" has no mainElement (Wrapper).`);
            return;
        }
        wrapper.setParentElement(this.rootElement);
        wrapper.render();
    }

    // ─── Lifecycle: Stop ────────────────────────────────────────

    private stopPageView(pageView: ViewInterface | null): void {
        if (!pageView) return;
        // Stop block content (tracked by BlockManager)
        this.stopBlockContent();
        // Fire onDeactivated hook
        if (typeof pageView.onDeactivated === 'function') {
            try { pageView.onDeactivated(); }
            catch (e) { logger.error(`[ViewManager] onDeactivated error:`, e); }
        }
    }

    private stopLayoutView(layoutView: ViewInterface | null): void {
        if (!layoutView) return;
        const wrapper = layoutView.__ctrl__.mainElement;
        if (wrapper && typeof wrapper.stop === 'function') {
            wrapper.stop();
        }
        if (typeof layoutView.onDeactivated === 'function') {
            try { layoutView.onDeactivated(); }
            catch (e) { logger.error(`[ViewManager] layout onDeactivated error:`, e); }
        }
    }

    private stopBlockContent(): void {
        // BlockManager tracks mounted children per outlet
        for (const [name, children] of (this.blockManager as any).mountedChildren) {
            if (Array.isArray(children)) {
                for (const child of children) {
                    if (child && typeof child.stop === 'function') {
                        child.stop();
                    }
                }
            }
        }
    }

    // ─── Lifecycle: Start ───────────────────────────────────────

    private startViewChain(pageView: ViewInterface, finalView: ViewInterface, hasSuperView: boolean): void {
        if (hasSuperView) {
            // 1. Start layout element tree
            this.startLayoutView(finalView);
            // 2. Start page's block content
            this.startBlockContent();
            // 3. Fire page onMounted
            if (typeof pageView.onMounted === 'function') {
                try { pageView.onMounted(); }
                catch (e) { logger.error(`[ViewManager] page onMounted error:`, e); }
            }
        } else {
            // Standalone view — start wrapper tree directly
            const wrapper = pageView.__ctrl__.mainElement;
            if (wrapper && typeof wrapper.start === 'function') {
                wrapper.start();
            }
            if (typeof pageView.onMounted === 'function') {
                try { pageView.onMounted(); }
                catch (e) { logger.error(`[ViewManager] onMounted error:`, e); }
            }
        }
    }

    private startLayoutView(layoutView: ViewInterface): void {
        const wrapper = layoutView.__ctrl__.mainElement;
        if (wrapper && typeof wrapper.start === 'function') {
            wrapper.start();
        }
        if (typeof layoutView.onMounted === 'function') {
            try { layoutView.onMounted(); }
            catch (e) { logger.error(`[ViewManager] layout onMounted error:`, e); }
        }
    }

    private startBlockContent(): void {
        for (const [name, children] of (this.blockManager as any).mountedChildren) {
            if (Array.isArray(children)) {
                for (const child of children) {
                    if (child && typeof child.start === 'function') {
                        child.start();
                    }
                }
            }
        }
    }

    // ─── Lifecycle: Commit Data ─────────────────────────────────

    private commitViewChain(pageView: ViewInterface, finalView: ViewInterface, hasSuperView: boolean): void {
        if (hasSuperView) {
            finalView.__ctrl__.commitData();
            pageView.__ctrl__.commitData();
        } else {
            pageView.__ctrl__.commitData();
        }
    }

    // ─── Unmount ────────────────────────────────────────────────

    private unmountLayoutDOM(layoutView: ViewInterface | null): void {
        if (!layoutView) return;
        const wrapper = layoutView.__ctrl__.mainElement;
        if (wrapper && typeof wrapper.destroy === 'function') {
            wrapper.destroy();
        }
    }

    unmountAll(): void {
        this.stopPageView(this.currentPageView);
        this.stopLayoutView(this.currentLayoutView);
        this.blockManager.clearAllOutlets();
        this.blockManager.destroy();

        if (this.currentPageView) {
            this.currentPageView.__ctrl__.destroy();
        }
        if (this.currentLayoutView) {
            this.currentLayoutView.__ctrl__.destroy();
        }

        this.currentPageView = null;
        this.currentLayoutView = null;
        this.currentLayoutPath = null;
        this.currentViewType = null;
        this.activeViews.clear();
        this.viewStack = [];
    }

    unmountView(path: string): void {
        const info = this.activeViews.get(path);
        if (!info) return;
        this.activeViews.delete(path);
    }

    // ─── Getters ────────────────────────────────────────────────

    getCurrentLayout(): ViewInterface | null {
        return this.currentLayoutView;
    }

    getCurrentView(): ViewInterface | null {
        return this.currentPageView;
    }

    getViewStack(): ViewInterface[] {
        return this.viewStack;
    }

    isInitialized(): boolean {
        return this._isInitialized;
    }


}
