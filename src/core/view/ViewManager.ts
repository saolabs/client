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
import { BlockOutlet } from "../elements/BlockOutlet";
import { PageCacheService, PageCacheEntry, detachWrapperDOM } from "../services/PageCache";
import { Html } from "../elements/Html";
import { hasData } from "../helpers/utils";
import { activateView, claimHydratedView, commitView, flushView } from "../helpers/view";
import markerRegistry from "../services/MarkerRegistry";
import logger from "../services/LoggerService";
import { StoreService } from "../services/StoreService";
import { View } from "./View";
import { InitMode, InitModes } from "../contracts/common";
import { OOTEnum } from "../types/utils";
import { WrapperInterface } from "../contracts/ElementInterface";
import { app } from "../helpers/app";

/**
 * SSR boot info — server nhúng sau khi render xong (RUNTIME_CONTRACT §6).
 * `view` = registry path của page entry, `viewId` = id server đã dùng để prefix
 * markers/classes của page. viewId của layout chain được client discover từ DOM.
 */
export type SSRBootInfo = {
    view: string;
    viewId: string;
    container?: string;
};

type RenderPageViewSuccess = {
    type: 'success';
    message: string;
    view: ViewInterface;
    result: ViewInterface | unknown;
    superView: ViewInterface | null;
    finalView: ViewInterface;
    /** Origin → outermost: [page, inner layout, ..., root layout]. */
    chain: ViewInterface[];
};

type RenderPageViewError = {
    type: 'error';
    message: string;
    view: ViewInterface;
    result: null;
    superView: null;
    finalView: ViewInterface;
    chain: ViewInterface[];
};

type RenderPageViewCancelled = {
    type: 'cancelled';
    message: string;
    view: ViewInterface;
    result: null;
    superView: null;
    finalView: ViewInterface;
    chain: ViewInterface[];
};

type RenderPageViewResult = RenderPageViewSuccess | RenderPageViewError | RenderPageViewCancelled;

function isRenderableObject(result: unknown): result is { saoType: string } {
    return typeof result === 'object' && result !== null && 'saoType' in result;
}

export class ViewManager implements ViewManagerInterface {
    /** DI container */
    private App: ApplicationInterface | null = null;

    private systemData: Record<string, any> = {}; // For internal use, not exposed to views
    private contextRevision: string | null = null;
    private contextViews: string | null = null;

    /** ROOT DOM container where views mount */
    private container: HTMLElement | null = null;
    private rootElement: HtmlInterface | null = null; // Html wrapper for the root container
    /** View module registry: name → factory or async loader */
    private viewRegistry: Record<string, ((...args: any[]) => any) | (() => Promise<any>)> = {};

    /** Currently mounted views (keyed by path) */
    private activeViews: Map<string, ActiveViewInfo> = new Map();

    /** The outermost active view (layout or page) */
    private currentView: ActiveViewInfo | null = null;

    /** Current layout path — for layout reuse detection */
    private currentLayoutPath: string | null = null;

    private currentLayoutView: ViewInterface | null = null; // Store the current layout view instance for reuse
    /** Mounted layouts ordered outermost → innermost. */
    private currentLayoutChain: ViewInterface[] = [];
    private currentPageView: ViewInterface | null = null; // Store the current page view instance for reference in blocks and sections
    private currentViewType: 'view' | 'layout' | null = null; // Track whether the current view is a page or layout for correct lifecycle handling

    /**
     * SSR boot info — view entry (page) + viewId server đã render. Set ở init()
     * từ config.ssr (đọc từ DOM lúc boot). Router consume 1 lần cho route đầu
     * tiên → hydrateView; các route sau là CSR (SPA takeover).
     */
    private ssrBoot: SSRBootInfo | null = null;

    /** Exact Page/Layout instance relationships exported by Blade for hydration. */
    private ssrViewData: Record<string, any> = {};


    /** Current layout view info — reused if same layout */
    private currentLayout: ActiveViewInfo | null = null;

    private cachedLayouts: Map<string, ViewInterface> = new Map(); // Cache for previously mounted layouts

    /** All views in the current mount chain (outermost → innermost) */
    private viewStack: ViewInterface[] = [];

    /** Whether the manager has been initialized */
    private _isInitialized = false;

    /** Render counter for debugging */
    private renderCount = 0;

    /** Invalidates fire-and-forget render work when a newer navigation begins. */
    private navigationGeneration = 0;

    public store: StoreService = StoreService.instance("ViewManager");

    public blockManager: BlockManagerService = BlockManager;

    constructor(app?: ApplicationInterface) {
        if (app) this.App = app;

        // Layout instance sống ở CẢ HAI nơi: PageCache (DOM detached) + store
        // (để extendView trả lại đúng instance). Entry bị evict/expire → instance
        // đã destroy → PHẢI gỡ khỏi store, nếu không extendView trả instance chết.
        this.pageCache.onEvict = (entry) => {
            for (const v of entry.views) {
                const path = v.__ctrl__?.path;
                if (path && this.store.has(path) && this.store.get(path) === v) {
                    this.store.remove?.(path);
                }
            }
        };
    }
    /**
     * Kiểm tra một view có đang mount (active) không.
     * Dùng để guard duplicate mount hoặc kiểm tra trạng thái từ bên ngoài.
     */
    isViewMounted(path: string): boolean {
        return this.activeViews.has(path);
    }

    /** Invalidate async render/fetch work owned by the current navigation. */
    cancelNavigation(): void {
        this.navigationGeneration++;
    }

    /**
     * Destroy ViewManager hoàn toàn — dọn sạch mọi view, DOM, state.
     * Gọi khi teardown app (hot reload, test cleanup, unmount root).
     */
    destroy(): void {
        this.navigationGeneration++;
        // 1. Stop và destroy tất cả views đang active
        this.unmountAll();
        // 2. Dọn PageCache
        this.pageCache.clear();
        // 3. Reset registry và internal state
        this.viewRegistry = {};
        this.rootElement = null;
        this.container = null;
        this._isInitialized = false;
        this.renderCount = 0;
        this.store.clear();
        logger.info('[ViewManager] destroyed.');
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
    init(config?: { container?: HTMLElement | string; registry?: Record<string, any>; ssr?: SSRBootInfo | null; systemData?: Record<string, any>; ssrData?: Record<string, any>; revision?: string; contextViews?: string }): void {
        // SSR boot info (server-rendered): chứa view entry + viewId để route đầu
        // tiên gọi hydrateView thay vì mountView. Xem RUNTIME_CONTRACT §6 (boot).
        if (config?.ssr && config.ssr.view && config.ssr.viewId) {
            this.ssrBoot = config.ssr;
        }
        // systemData (server __layout__/__base__/__page__/...): spread vào mọi
        // view factory ở view() để compiled view resolve superView/namespace.
        if (config?.systemData && typeof config.systemData === 'object') {
            this.systemData = { ...this.systemData, ...config.systemData };
        }
        if (typeof config?.revision === 'string') {
            this.contextRevision = config.revision;
        }
        if (typeof config?.contextViews === 'string') {
            this.contextViews = config.contextViews;
        }
        if (config?.ssrData && typeof config.ssrData === 'object') {
            this.ssrViewData = config.ssrData;
        }
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
            initMode: InitModes.HYDRATE,
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

    /**
     * generateViewId — tạo unique ID cho mỗi view instance.
     *
     * Compiled output gọi:
     *   const __VIEW_ID__ = __data__.__SSR_VIEW_ID__ || App.View.generateViewId();
     *
     * Dùng trong constructor của compiled View class để gán viewId
     * (tránh hai instance cùng view path dùng chung ID gây clobber registry).
     */
    generateViewId(): string {
        return `v${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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
            // Truyền data PHẲNG cho factory: compiled factory nhận __data__ là
            // chính object data (đọc __data__.__SSR_VIEW_ID__, setup({data:__data__})).
            // Trước đây bọc { data } → __data__.__SSR_VIEW_ID__ = undefined và
            // ctrl.data bị lồng (vỡ route-param). Xem docs/HYDRATION.md §9.2.
            const view = factory(data ?? {}, { App: this.App, View: this, ...this.systemData });
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
            chain: [view],
        };
    }

    private createRenderPageViewCancelled(view: ViewInterface): RenderPageViewCancelled {
        return {
            type: 'cancelled',
            message: '',
            view,
            result: null,
            superView: null,
            finalView: view,
            chain: [view],
        };
    }

    private isNavigationCurrent(generation: number): boolean {
        return generation === this.navigationGeneration;
    }

    private createRenderPageViewSuccess(
        view: ViewInterface,
        result: ViewInterface | unknown,
        superView: ViewInterface | null,
        finalView: ViewInterface,
        chain: ViewInterface[] = [view],
    ): RenderPageViewSuccess {
        return {
            type: 'success',
            message: '',
            view,
            result,
            superView,
            finalView,
            chain,
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
        renderLevel: number = 0,
        navigationGeneration: number = this.navigationGeneration,
    ): Promise<RenderPageViewResult> {
        if (!this.isNavigationCurrent(navigationGeneration)) {
            return this.createRenderPageViewCancelled(view);
        }
        const ctrl = view.__ctrl__;

        if (hasData(data)) {
            ctrl.updateData(data);
        }

        // Truyền initMode vào controller TRƯỚC khi render —
        // để tất cả elements con (Html, Wrapper, Reactive, Output...)
        // biết mình đang ở chế độ hydrate hay create.
        ctrl.initMode = initMode;

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
            const superView = result as ViewInterface;

            // CSR navigation may resolve @extends to the exact Layout instance
            // that is already active. Its DOM, outlets and lifecycle are retained,
            // so rendering it again only recreates declarations and can repeat
            // user side effects. Reuse the already-resolved outer chain instead.
            // Hydration must still render every level to claim Blade's SSR DOM.
            if (initMode === InitModes.CREATE) {
                const activeLayoutIndex = this.currentLayoutChain.indexOf(superView);
                if (activeLayoutIndex >= 0) {
                    const reusedChain = this.currentLayoutChain
                        .slice(0, activeLayoutIndex + 1)
                        .reverse();
                    return this.createRenderPageViewSuccess(
                        view,
                        superView,
                        superView,
                        reusedChain[reusedChain.length - 1] ?? superView,
                        [view, ...reusedChain],
                    );
                }
            }

            // ── Hydrate: gán viewId của layout TRƯỚC khi render nó ──────────
            // Page gọi extendView(layoutPath, {}) → layout tự sinh viewId ngẫu
            // nhiên, KHÔNG khớp viewId server đã render. Phải gán đúng id ở đây
            // (trước render → trước khi Wrapper layout capture ctx.viewId), bằng
            // cách đọc lại từ DOM view marker <!--s:v:{id}-s--> server để lại.
            if (initMode === InitModes.HYDRATE) {
                const discovered = this.discoverChainViewId(
                    mountRoot,
                    new Set([ctrl.viewId]),
                    superView.__ctrl__.path,
                    ctrl.viewId,
                );
                if (discovered) {
                    superView.__ctrl__.viewId = discovered;
                }
            }

            const superResult = await this.renderPageView(
                superView, {}, mountRoot, initMode, cache, renderLevel + 1, navigationGeneration
            );
            if (superResult.type !== 'success') {
                return { ...superResult, view };
            }
            return this.createRenderPageViewSuccess(
                view,
                superView,
                superResult.view,
                superResult.finalView ?? superView,
                [view, ...superResult.chain],
            );
        }

        return this.createRenderPageViewError(view, renderLevel,
            `View "${ctrl.path}" returned invalid content (type: ${resultType}) from ${method}().`);
    }

    /**
     * Discover viewId của một layout/superView từ SSR DOM (hydration).
     *
     * Page gọi extendView() KHÔNG truyền viewId của layout (server tự sinh id),
     * nên client lấy lại id từ quan hệ instance mà Blade export. Nếu output cũ
     * chưa có quan hệ này, client mới discover từ metadata/marker trong DOM.
     *
     * Nested chain ưu tiên quan hệ parent chính xác trong APP_CONFIGS.view.ssrData,
     * sau đó mới tới `data-view-name`/`data-view-id`; marker scan là fallback.
     */
    private discoverChainViewId(
        mountRoot: HtmlInterface | null,
        excludeIds: Set<string>,
        viewPath?: string,
        parentViewId?: string,
    ): string | null {
        if (viewPath) {
            const instances = this.ssrViewData[viewPath]?.instances;
            if (instances && typeof instances === 'object') {
                for (const [instanceId, instance] of Object.entries(instances)) {
                    const id = (instance as any)?.viewId ?? instanceId;
                    if (id && !excludeIds.has(id)
                        && (!parentViewId || (instance as any)?.parent?.id === parentViewId)) {
                        return id;
                    }
                }
            }
            const records = document.querySelectorAll('script[data-ref="view-data"][data-view-id]');
            for (const record of records) {
                const id = record.getAttribute('data-view-id');
                if (record.getAttribute('data-view-name') === viewPath
                    && id && !excludeIds.has(id)) return id;
            }
        }
        const root = mountRoot?.getElement?.() ?? this.rootElement?.getElement?.();
        if (!root) return null;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
        let node: Comment | null;
        while ((node = walker.nextNode() as Comment | null)) {
            const parsed = markerRegistry.parseComment(node.nodeValue ?? '');
            if (parsed && parsed.tag === 'view' && !parsed.isClose && !excludeIds.has(parsed.id)) {
                return parsed.id;
            }
        }
        return null;
    }

    async renderPageView(
        view: ViewInterface,
        data: Record<string, any>,
        mountRoot: HtmlInterface | null = null,
        initMode: InitMode = InitModes.CREATE,
        cache: boolean = false,
        renderLevel: number = 0,
        navigationGeneration: number = this.navigationGeneration,
    ): Promise<RenderPageViewResult> {
        try {
            if (!this.isNavigationCurrent(navigationGeneration)) {
                return this.createRenderPageViewCancelled(view);
            }
            const ctrl = view.__ctrl__;
            if (hasData(data)) {
                ctrl.updateData(data);
            }
            const config: ViewControllerConfig = ctrl.getConfig();
            const hasAsyncData = config.hasAwaitData || config.hasFetchData;

            // ── Case 1: Không có async data → render ngay ──
            if (!hasAsyncData) {
                return this.callViewRenderFactory(view, 'render', data, mountRoot, initMode, cache, renderLevel, navigationGeneration);
            }

            // ── Resolve fetch URL từ ViewController config hoặc fallback Router ──
            const App = app() as ApplicationInterface;
            const Http = App.Http;
            const fetchConfig = config.fetch;
            const fetchUrl = (config.hasAwaitData && fetchConfig?.url) ? fetchConfig?.url : App.Router.getFullUrl();

            // ── Case 2: Có async + có prerender → prerender skeleton trước, fetch sau ──
            if (config.hasPrerender) {
                const renderGeneration = navigationGeneration;
                const prerenderResult = await this.callViewRenderFactory(view, 'prerender', data, mountRoot, initMode, cache, renderLevel, navigationGeneration);
                if (prerenderResult.type === 'cancelled') return prerenderResult;
                if (prerenderResult.type === 'error') {
                    logger.error(`Error prerendering view "${ctrl.path}":`, prerenderResult.message);
                    // Fallback: render trực tiếp không qua prerender
                    return this.callViewRenderFactory(view, 'render', data, mountRoot, initMode, cache, renderLevel, navigationGeneration);
                }

                // Fire-and-forget: fetch data → re-render → swap skeleton → main
                Http.get(fetchUrl).then(async (response: any) => {
                    // Route mới hoặc manager teardown đã bắt đầu: tuyệt đối không
                    // render/mount kết quả cũ trở lại root DOM.
                    if (renderGeneration !== this.navigationGeneration
                        || ctrl.lifecycleState === 'destroyed') return;

                    const asyncData = this.extractAsyncData(response);
                    if (hasData(asyncData)) {
                        ctrl.updateData(asyncData);
                    }

                    // Render main content (kết quả sẽ nằm trong ctrl.mainElement)
                    const finalResult = await this.callViewRenderFactory(view, 'render', asyncData, mountRoot, initMode, cache, renderLevel, navigationGeneration);
                    if (renderGeneration !== this.navigationGeneration
                        || ctrl.lifecycleState === 'destroyed') return;
                    if (finalResult.type === 'error') {
                        logger.error(`Error rendering view "${ctrl.path}" after async data fetch:`, finalResult.message);
                        return;
                    }

                    // ── Swap: preloadElement (skeleton) → mainElement (real) ──
                    // 1. Destroy skeleton khỏi DOM
                    if (ctrl.preloadElement && typeof ctrl.preloadElement.destroy === 'function') {
                        ctrl.preloadElement.stop?.();
                        ctrl.preloadElement.destroy();
                    }
                    // 2. Mount mainElement vào cùng vị trí (mountRoot)
                    if (ctrl.mainElement && mountRoot) {
                        ctrl.mainElement.setParentElement(mountRoot);
                        ctrl.mainElement.mountTo(mountRoot);
                    }
                    // 3. Commit data + start reactivity
                    commitView(ctrl);
                    ctrl.mainElement?.start?.();
                    logger.info(`[ViewManager] prerender → main swap done for "${ctrl.path}"`);
                }).catch((err: any) => {
                    if (this.isNavigationCurrent(renderGeneration)) {
                        logger.error(`Error fetching async data for view "${ctrl.path}":`, err);
                    }
                });

                // Return prerender result ngay — mountView sẽ mount skeleton
                return prerenderResult;
            }

            // ── Case 3: Có async + không prerender → await fetch rồi render ──
            let asyncData: Record<string, any> = {};
            try {
                const response = await Http.get(fetchUrl);
                asyncData = this.extractAsyncData(response);
            } catch (err) {
                if (!this.isNavigationCurrent(navigationGeneration)) {
                    return this.createRenderPageViewCancelled(view);
                }
                logger.error(`Error fetching async data for view "${ctrl.path}":`, err);
            }

            if (!this.isNavigationCurrent(navigationGeneration)) {
                return this.createRenderPageViewCancelled(view);
            }

            if (!hasData(asyncData)) {
                logger.warn(`View "${ctrl.path}" has async data config but fetch returned no data.`);
            }

            return this.callViewRenderFactory(view, 'render', asyncData, mountRoot, initMode, cache, renderLevel, navigationGeneration);
        }
        catch (err) {
            logger.error(`Error rendering view ${view.__ctrl__.path}:`, err);
            return this.createRenderPageViewError(view, renderLevel, `Error rendering view "${view.__ctrl__.path}".`);
        }
    }










    // ─── Mount Orchestration ────────────────────────────────────

    /**
     * Mount view khi navigate — luồng chuẩn (ROUTE_RENDER_FLOW.md):
     *   sweep TTL → duplicate guard → pause+cache trang cũ (standalone LẪN
     *   page thuộc layout) → thử restore từ PageCache (theo view name + URI,
     *   trong TTL, mọi navigation type) → mount mới
     *   (render → mount DOM → commitData → start).
     *
     * Lifecycle khi RỜI trang (deactivatePage):
     *   - page cacheable  → pause (pausing/paused) + detach DOM → PageCache
     *   - page cache:false → destroy (stopping/stopped → unmounting/unmounted → destroyed)
     *   - layout KHÔNG đổi → không hook nào fire trên layout (giữ nguyên DOM + subscription)
     *   - layout đổi/về standalone → destroy layout chain
     */
    async mountView(name: string, data?: Record<string, any>, route?: ActiveRouteInterface, navigationType: RouterNavigationType = 'push'): Promise<any> {
        // Request URI = path + query (KHÔNG hash) — Router cung cấp qua $uri
        const targetUrl = (route as any)?.$uri ?? route?.$urlPath ?? name;

        // ── Phase 0: TTL sweep + duplicate guard ──
        this.pageCache.sweep();
        if (this.currentPageView
            && this.currentPageView.__ctrl__.urlPath === targetUrl) {
            return null; // đã đứng đúng trang này
        }

        // Mọi async work của navigation trước trở thành stale từ thời điểm này.
        const navigationGeneration = ++this.navigationGeneration;

        const oldPageView = this.currentPageView;
        const oldLayoutView = this.currentLayoutView;
        const oldLayoutChain = [...this.currentLayoutChain];
        // BlockManager hiện đăng ký block theo outlet dùng chung. Với page
        // thuộc Layout, phải detach ownership cũ trước khi render page mới;
        // nếu không block mới sẽ ghi đè registry và cache sai DOM.
        // Standalone không có ràng buộc này nên được giữ active tới commit.
        const oldPageRequiresEarlyDeactivate = oldPageView !== null && oldLayoutChain.length > 0;
        let oldPageDeactivated = false;
        if (oldPageRequiresEarlyDeactivate) {
            this.deactivatePage(oldPageView!, oldLayoutView);
            this.currentPageView = null;
            oldPageDeactivated = true;
        }

        // ── Phase 1: thử restore từ PageCache (key = view name + request URI) ──
        // Trong TTL: mọi navigation type đều restore (bfcache). Hết TTL → mount tươi.
        const cachedEntry = this.pageCache.take(this.cacheKey(name, targetUrl));
        if (cachedEntry) {
            if (oldPageView && !oldPageDeactivated) {
                this.deactivatePage(oldPageView, oldLayoutView);
                oldPageDeactivated = true;
            }
            this.currentPageView = null;
            const restored = this.restoreFromCache(cachedEntry, oldLayoutView, navigationType);
            if (restored) return restored;
        }

        // ── Phase 2: Load + render chain trong khi page cũ vẫn active. ──
        // Chỉ khi render thành công mới pause/destroy page cũ; fetch/render lỗi
        // không được làm màn hình hiện tại biến mất.
        const view = this.view(name, data ?? {}, false);
        if (!view) {
            const message = `Failed to load view "${name}".`;
            if (oldPageView && oldPageDeactivated) {
                this.restoreDeactivatedPage(oldPageView!, oldLayoutView);
            }
            if (oldPageView) logger.error(message);
            else this.showError(message);
            return null;
        }
        view.__ctrl__.urlPath = targetUrl;

        const renderResult = await this.renderPageView(
            view, data ?? {}, this.rootElement, InitModes.CREATE, false, 0, navigationGeneration
        );
        if (renderResult.type === 'cancelled') {
            view.__ctrl__.destroy();
            if (oldPageView && oldPageDeactivated) {
                this.restoreDeactivatedPage(oldPageView!, oldLayoutView);
            }
            return null;
        }
        if (renderResult.type === 'error') {
            view.__ctrl__.destroy();
            if (oldPageView && oldPageDeactivated) {
                this.restoreDeactivatedPage(oldPageView!, oldLayoutView);
            }
            if (oldPageView) logger.error(renderResult.message);
            else this.showError(renderResult.message);
            return null;
        }

        // ── Phase 3: commit transition ──
        // Page/Layout mới đã resolve xong; bây giờ mới rời chain cũ và mount chain mới.
        if (oldPageView && !oldPageDeactivated) {
            this.deactivatePage(oldPageView, oldLayoutView);
        }
        this.currentPageView = null;
        this.activateRenderedChain(renderResult, InitModes.CREATE, oldLayoutChain);

        return renderResult;
    }

    /** Commit the successfully mounted/hydrated chain as the only active route state. */
    private commitActiveChain(
        pageView: ViewInterface,
        layoutChain: ViewInterface[],
    ): void {
        this.currentPageView = pageView;
        this.currentLayoutChain = [...layoutChain];
        this.currentLayoutView = layoutChain[0] ?? null;
        this.currentLayoutPath = this.currentLayoutView?.__ctrl__.path ?? null;
        this.currentViewType = layoutChain.length > 0 ? 'layout' : 'view';
        this.viewStack = [...layoutChain, pageView];
        this.renderCount++;
    }

    /**
     * Common post-render transaction. Rendering decides the Page/Layout chain;
     * this step applies the DOM strategy, activates it, then publishes one
     * coherent active-chain state.
     */
    private activateRenderedChain(
        renderResult: RenderPageViewSuccess,
        initMode: InitMode,
        oldLayoutChain: ViewInterface[] = [],
    ): void {
        const pageView = renderResult.view;
        const layoutChain = renderResult.chain.slice(1).reverse();

        if (initMode === InitModes.HYDRATE) {
            this.activateHydratedChain(pageView, layoutChain);
        } else {
            this.activateCreatedChain(pageView, layoutChain, oldLayoutChain);
        }

        this.commitActiveChain(pageView, layoutChain);
    }

    /** CSR strategy: insert new DOM, while preserving/reusing a compatible Layout. */
    private activateCreatedChain(
        pageView: ViewInterface,
        layoutChain: ViewInterface[],
        oldLayoutChain: ViewInterface[],
    ): void {
        const pageCtrl = pageView.__ctrl__;

        if (layoutChain.length === 0) {
            if (oldLayoutChain.length > 0) {
                this.deactivateLayoutChain(oldLayoutChain);
                this.currentLayoutView = null;
                this.currentLayoutChain = [];
                this.currentLayoutPath = null;
            }
            pageCtrl.mount(this.rootElement!);
            commitView(pageCtrl);
            activateView(pageCtrl);
            return;
        }

        let common = 0;
        while (common < oldLayoutChain.length
            && common < layoutChain.length
            && oldLayoutChain[common] === layoutChain[common]) {
            common++;
        }

        if (common === 0 && oldLayoutChain.length > 0) {
            this.deactivateLayoutChain(oldLayoutChain);
        } else {
            // Root layout vẫn dùng chung; chỉ dọn phần chain không còn reuse.
            for (let i = oldLayoutChain.length - 1; i >= common; i--) {
                this.destroyLayoutView(oldLayoutChain[i]);
            }
        }

        const resumed = common === 0 && this.resumeLayoutChainFromCache(layoutChain);
        const newLayouts: ViewInterface[] = [];

        if (!resumed) {
            let start = common;
            if (common === 0) {
                layoutChain[0].__ctrl__.mount(this.rootElement!);
                newLayouts.push(layoutChain[0]);
                start = 1;
            }
            for (let i = start; i < layoutChain.length; i++) {
                const layout = layoutChain[i];
                this.blockManager.mountViewBlocks(layout.__ctrl__.viewId);
                layout.__ctrl__.mount();
                newLayouts.push(layout);
            }
        }

        this.blockManager.mountViewBlocks(pageCtrl.viewId);
        pageCtrl.mount();
        for (const layout of newLayouts) commitView(layout.__ctrl__);
        commitView(pageCtrl);

        for (const layout of newLayouts) activateView(layout.__ctrl__);
        this.blockManager.startAll();
        activateView(pageCtrl);
    }

    /** Hydration strategy: claim Blade DOM without insert/clear mutations. */
    private activateHydratedChain(
        pageView: ViewInterface,
        layoutChain: ViewInterface[],
    ): void {
        const pageCtrl = pageView.__ctrl__;

        if (layoutChain.length === 0) {
            commitView(pageCtrl, true);
            claimHydratedView(pageCtrl, this.rootElement!);
            pageCtrl.mount();
            pageCtrl.initMode = InitModes.CREATE;
            activateView(pageCtrl);
            return;
        }

        for (const layout of layoutChain) commitView(layout.__ctrl__, true);
        commitView(pageCtrl, true);
        const rootLayoutCtrl = layoutChain[0].__ctrl__;
        claimHydratedView(rootLayoutCtrl, this.rootElement!);
        rootLayoutCtrl.mount();
        for (let i = 1; i < layoutChain.length; i++) {
            const ctrl = layoutChain[i].__ctrl__;
            this.blockManager.hydrateViewBlocks(ctrl.viewId);
            ctrl.mount();
        }
        this.blockManager.hydrateViewBlocks(pageCtrl.viewId);
        pageCtrl.mount();
        for (const layout of layoutChain) layout.__ctrl__.initMode = InitModes.CREATE;
        pageCtrl.initMode = InitModes.CREATE;

        for (const layout of layoutChain) activateView(layout.__ctrl__);
        this.blockManager.startAll();
        activateView(pageCtrl);
    }

    /**
     * Destroy layout cũ (đổi layout hoặc về standalone).
     * Page cũ đã rời ở Phase 1 (deactivatePage) — không destroy tại đây.
     */
    private destroyLayoutView(layoutView: ViewInterface): void {
        const layoutPath = layoutView.__ctrl__.path;
        layoutView.__ctrl__.destroy();
        // Layout cached theo path trong store (extendView dùng cache=true) —
        // instance đã destroy không được phép trả về từ cache nữa
        if (layoutPath && this.store.has(layoutPath)) {
            this.store.remove?.(layoutPath);
        }
    }

    private destroyLayoutChain(layoutChain: ViewInterface[]): void {
        for (let i = layoutChain.length - 1; i >= 0; i--) {
            this.destroyLayoutView(layoutChain[i]);
        }
    }

    // ─── PageCache integration ──────────────────────────────────

    /** bfcache-style cache cho trang đã ghé (ROUTE_RENDER_FLOW.md §8) */
    public pageCache: PageCacheService = new PageCacheService();

    /**
     * Cache key = `${viewName}::${requestUri}` — URI gồm path + query,
     * KHÔNG gồm hash (strip defensive tại đây).
     */
    private cacheKey(viewName: string, uri: string): string {
        return `${viewName}::${(uri ?? '').split('#')[0]}`;
    }

    /** Cache key cho layout — namespace riêng, không đụng key page (name::uri) */
    private layoutCacheKey(layoutPath: string): string {
        return `__layout__::${layoutPath}`;
    }

    private layoutChainIdentity(layoutChain: ViewInterface[]): string {
        return layoutChain.map(view => view.__ctrl__.path).join('>');
    }

    /**
     * Rời một layout (đổi layout / về standalone): pause + detach toàn vùng DOM
     * → PageCache (key `__layout__::{path}`). KHÁC destroy ở 2 điểm:
     *   1. Instance GIỮ NGUYÊN trong store — extendView của page sau trả lại
     *      đúng instance này (đang paused) → resumeLayoutFromCache nhận ra.
     *   2. Outlets gỡ khỏi BlockManager registry (không destroy) — tránh
     *      mountAll đụng outlet trùng tên của layout đang nằm trong cache.
     * Layout khai cache:false (hoặc ttl 0) → destroy như cũ.
     */
    private deactivateLayout(layoutView: ViewInterface): void {
        this.deactivateLayoutChain([layoutView]);
    }

    private deactivateLayoutChain(layoutChain: ViewInterface[]): void {
        const rootCtrl = layoutChain[0]?.__ctrl__;
        if (!rootCtrl) return;
        const cacheConfig = rootCtrl.getConfig('cache');
        const ttl = typeof cacheConfig === 'object' && cacheConfig?.ttl != null ? cacheConfig.ttl : undefined;
        const wrapper = rootCtrl.mainElement;

        if (!wrapper || cacheConfig === false || ttl === 0) {
            this.destroyLayoutChain(layoutChain);
            return;
        }

        for (let i = layoutChain.length - 1; i >= 0; i--) {
            layoutChain[i].__ctrl__.pause();
        }
        for (const layout of layoutChain) {
            this.blockManager.detachOutletsOfView(layout.__ctrl__.viewId);
        }
        const fragment = detachWrapperDOM(wrapper);
        this.pageCache.set(this.layoutCacheKey(this.layoutChainIdentity(layoutChain)), {
            views: [...layoutChain],
            fragment,
            layoutPath: null,
            scroll: { x: 0, y: 0 },
            ttl,
        });
    }

    /**
     * Layout lấy từ store đang PAUSED (đã vào cache trước đó) → reattach
     * fragment + resume thay vì mount lại. Trả false nếu layout không paused
     * (layout mới tạo → caller mount bình thường).
     */
    private resumeLayoutChainFromCache(layoutChain: ViewInterface[]): boolean {
        if (layoutChain.length === 0
            || layoutChain.some(layout => layout.__ctrl__.lifecycleState !== 'paused')) return false;

        const entry = this.pageCache.take(this.layoutCacheKey(this.layoutChainIdentity(layoutChain)));
        if (entry) {
            this.rootElement!.getElement().appendChild(entry.fragment);
            for (const layout of layoutChain) layout.__ctrl__.resume();
        } else {
            return false;
        }
        for (const layout of layoutChain) this.reregisterLayoutOutlets(layout.__ctrl__);
        return true;
    }

    /** Đăng ký lại outlets của layout vừa resume vào BlockManager registry */
    private reregisterLayoutOutlets(layoutCtrl: ViewControllerInterface): void {
        const elements: Map<string, any> | undefined = (layoutCtrl as any).elements;
        if (!elements) return;
        for (const [id, el] of elements) {
            if (el instanceof BlockOutlet && !(el as any).__destroyed__) {
                this.blockManager.addOutlet(id, el);
            }
        }
    }

    /**
     * Navigate rời một page: pause + detach DOM → PageCache.
     *   - Standalone: detach toàn vùng wrapper (markers + content).
     *   - Page thuộc layout: detach block content THEO OUTLET — layout giữ nguyên,
     *     không hook nào fire trên layout.
     * View khai cache:false (hoặc ttl 0) → destroy luôn.
     */
    private deactivatePage(
        pageView: ViewInterface,
        layoutView: ViewInterface | null,
        layoutChain: ViewInterface[] = this.currentLayoutChain,
    ): void {
        const ctrl = pageView.__ctrl__;
        const urlPath = ctrl.urlPath;
        const cacheConfig = ctrl.getConfig('cache');
        const ttl = typeof cacheConfig === 'object' && cacheConfig?.ttl != null ? cacheConfig.ttl : undefined;

        if (!urlPath || cacheConfig === false || ttl === 0) {
            ctrl.destroy();
            return;
        }

        const scroll = {
            x: typeof window !== 'undefined' ? window.scrollX ?? 0 : 0,
            y: typeof window !== 'undefined' ? window.scrollY ?? 0 : 0,
        };

        if (!layoutView) {
            const wrapper = ctrl.mainElement;
            if (!wrapper) {
                ctrl.destroy();
                return;
            }
            // pause TRƯỚC detach: flush pending → DOM snapshot nhất quán rồi mới rời
            ctrl.pause();
            const fragment = detachWrapperDOM(wrapper);
            this.pageCache.set(this.cacheKey(ctrl.path, urlPath), {
                views: [pageView], fragment, layoutPath: null, scroll, ttl,
            });
        } else {
            ctrl.pause();
            const outletContents = this.blockManager.detachPageContent(ctrl.viewId);
            this.pageCache.set(this.cacheKey(ctrl.path, urlPath), {
                views: [pageView],
                outletContents,
                layoutPath: this.layoutChainIdentity(layoutChain.length > 0 ? layoutChain : [layoutView]),
                scroll,
                ttl,
            });
        }
    }

    /** Roll back an early Layout-page detach when prepare/render did not commit. */
    private restoreDeactivatedPage(
        pageView: ViewInterface,
        layoutView: ViewInterface | null,
    ): boolean {
        const ctrl = pageView.__ctrl__;
        if (!ctrl.urlPath) return false;
        const entry = this.pageCache.take(this.cacheKey(ctrl.path, ctrl.urlPath));
        if (!entry) return false;
        return this.restoreFromCache(entry, layoutView, 'pop') !== null;
    }

    /**
     * Cache hit: gắn lại DOM + resume — không render, không gọi API.
     *   - Entry standalone: layout cũ (nếu còn) pause+cache → gắn fragment vào container.
     *   - Entry layout-page: layout đang mount trùng layoutPath → restore thẳng
     *     vào outlets. Không trùng → thử resurrect layout từ layout cache
     *     (bfcache đầy đủ: restore CẢ layout LẪN page trong một lần). Layout
     *     cũng không có trong cache → putBack entry (còn TTL thì lần điều hướng
     *     sau restore được), trả null để caller mount tươi.
     * Scroll: pop → khôi phục vị trí cũ; push → về đầu trang.
     */
    private restoreFromCache(
        entry: PageCacheEntry,
        oldLayoutView: ViewInterface | null,
        navigationType: RouterNavigationType
    ): any {
        const pageView = entry.views[entry.views.length - 1];

        if (entry.layoutPath) {
            // ── Page thuộc layout ────────────────────────────────────────
            // 1. Layout đang mount trùng path? → dùng luôn
            let layoutChain = this.layoutChainIdentity(this.currentLayoutChain) === entry.layoutPath
                ? [...this.currentLayoutChain]
                : [];
            let layoutView: ViewInterface | null = layoutChain[0] ?? null;

            // 2. Không trùng → thử resurrect layout từ layout cache
            if (!layoutView && entry.outletContents) {
                const layoutEntry = this.pageCache.take(this.layoutCacheKey(entry.layoutPath));
                if (layoutEntry) {
                    if (this.currentLayoutChain.length > 0) {
                        this.deactivateLayoutChain(this.currentLayoutChain);
                    }
                    layoutChain = [...layoutEntry.views];
                    const lv = layoutChain[0];
                    this.rootElement!.getElement().appendChild(layoutEntry.fragment);
                    for (const layout of layoutChain) layout.__ctrl__.resume();
                    for (const layout of layoutChain) this.reregisterLayoutOutlets(layout.__ctrl__);
                    layoutView = lv;
                }
            }

            // 3. Không có layout để restore vào → trả entry lại cache, mount tươi
            if (!layoutView || !entry.outletContents) {
                this.pageCache.putBack(entry);
                return null;
            }

            this.blockManager.restorePageContent(pageView.__ctrl__.viewId, entry.outletContents);
            for (const v of entry.views) {
                v.__ctrl__.resume();
            }
            this.currentPageView = pageView;
            this.currentLayoutView = layoutView;
            this.currentLayoutChain = layoutChain;
            this.currentLayoutPath = layoutView.__ctrl__.path;
            this.currentViewType = 'layout';
            this.viewStack = [...layoutChain, pageView];
        } else {
            // ── Standalone ───────────────────────────────────────────────
            if (this.currentLayoutChain.length > 0) {
                this.deactivateLayoutChain(this.currentLayoutChain);
                this.currentLayoutView = null;
                this.currentLayoutChain = [];
                this.currentLayoutPath = null;
            }
            const container = this.rootElement!.getElement();
            container.appendChild(entry.fragment);
            for (const v of entry.views) {
                v.__ctrl__.resume();
            }
            this.currentPageView = pageView;
            this.currentLayoutView = null;
            this.currentLayoutChain = [];
            this.currentLayoutPath = null;
            this.currentViewType = 'view';
            this.viewStack = [...entry.views];
        }
        this.renderCount++;

        try {
            if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
                if (navigationType === 'pop') {
                    window.scrollTo(entry.scroll.x, entry.scroll.y);
                } else {
                    window.scrollTo(0, 0);
                }
            }
        } catch { /* jsdom không hỗ trợ — bỏ qua */ }

        return {
            type: 'restored',
            view: pageView,
            finalView: this.currentLayoutView ?? pageView,
            superView: this.currentLayoutView,
        };
    }

    // ─── Unmount ────────────────────────────────────────────────

    unmountAll(): void {
        // Stop block content (unsubscribe) trước, rồi destroy chain trong → ngoài.
        // ctrl.destroy() tự fire đủ hook: stopping/stopped → unmounting/unmounted → destroyed.
        this.blockManager.stopAll();

        if (this.currentPageView) {
            this.currentPageView.__ctrl__.destroy();
        }
        for (let i = this.currentLayoutChain.length - 1; i >= 0; i--) {
            this.currentLayoutChain[i].__ctrl__.destroy();
        }

        this.blockManager.clearAllOutlets();
        this.blockManager.destroy();

        this.currentPageView = null;
        this.currentLayoutView = null;
        this.currentLayoutChain = [];
        this.currentLayoutPath = null;
        this.currentViewType = null;
        this.activeViews.clear();
        this.viewStack = [];
    }

    /**
     * Apply an atomic context update received from a JSON response before the
     * Router retries navigation with the newly materialized route table.
     */
    applyViewContext(state: Record<string, any>): boolean {
        const revision = typeof state?.revision === 'string' ? state.revision : null;
        if (!revision || revision === this.contextRevision) return false;

        this.cancelNavigation();
        this.contextRevision = revision;
        this.contextViews = typeof state.views === 'string' ? state.views : this.contextViews;
        if (state.systemData && typeof state.systemData === 'object') {
            this.systemData = { ...this.systemData, ...state.systemData };
        }

        // Cached pages/layout factories belong to the previous namespace.
        this.pageCache.clear();
        this.store.clear();
        this.ssrBoot = null;

        if (typeof window !== 'undefined') {
            const appConfigs = (window as any).APP_CONFIGS ??= {};
            appConfigs.view ??= {};
            appConfigs.view.revision = revision;
            appConfigs.view.contextViews = this.contextViews;
            appConfigs.view.systemData = { ...this.systemData };
        }

        return true;
    }

    getContextRevision(): string | null {
        return this.contextRevision;
    }

    private extractAsyncData(response: any): Record<string, any> {
        const payload = response?.data ?? {};
        if (payload && typeof payload === 'object'
            && Object.prototype.hasOwnProperty.call(payload, 'data')
            && (Object.prototype.hasOwnProperty.call(payload, 'viewContext')
                || Object.prototype.hasOwnProperty.call(payload, 'view'))) {
            return payload.data ?? {};
        }
        return payload;
    }

    unmountView(path: string): void {
        const info = this.activeViews.get(path);
        if (!info) return;
        this.activeViews.delete(path);
    }

    /**
     * hydrateView — Hydrate một view đã được server-side render.
     *
     * SSR flow:
     *   1. Laravel render Blade template → HTML gửi về client
     *   2. Blade dùng $__VIEW_ID__ để prefix class của mỗi element (e.g. "v12345-af0882bc")
     *   3. Laravel truyền $__VIEW_ID__ về client qua page data (__SSR_VIEW_ID__)
     *   4. Client gọi hydrateView() — view được tạo với cùng viewId
     *   5. Html elements tìm server-rendered DOM nodes bằng class {viewId}-{elementId}
     *   6. Reactive regions claim server markers via SaoMarker.first()
     *   7. Event handlers và state subscriptions được gắn vào DOM đã có
     *
     * Lưu ý: Không gây layout shift vì cấu trúc DOM được reuse (Html claim),
     * chỉ text nodes và markers được re-tạo (nội dung giống nhau nên không thấy được).
     *
     * @param name - View registry key (e.g. 'web.home')
     * @param data - View data, PHẢI chứa __SSR_VIEW_ID__ từ server
     * @param route - Active route (optional)
     *
     * Tham chiếu: COMPILER_CONTRACT.md §hydration, Html.ts §constructor
     */
    /**
     * hydrateView — Hydrate một view đã được server-side render (SSR).
     *
     * Flow:
     *   1. Server (Laravel) render Blade → HTML gửi về client
     *   2. Blade dùng $__VIEW_ID__ prefix class mỗi element ("v12345-af0882bc")
     *   3. Client gọi hydrateView() với __SSR_VIEW_ID__ = cùng viewId
     *   4. Html elements claim server DOM nodes bằng class {viewId}-{elementId}
     *   5. Output claim comment markers + text nodes giữa markers
     *   6. Event handlers và state subscriptions gắn vào DOM có sẵn
     *
     * Khác mountView:
     *   - Không xoá DOM cũ, không tạo HTML element mới (claim cái đã có)
     *   - Markers (Reactive, Output) vẫn được tạo mới nếu server không emit
     *   - Sau hydrate, SPA navigation dùng mountView bình thường (CSR)
     */
    async hydrateView(
        name: string,
        data: Record<string, any> & { __SSR_VIEW_ID__: string },
        route?: ActiveRouteInterface,
    ): Promise<any> {
        // Không có viewId từ server → không hydrate được, fallback CSR
        if (!data.__SSR_VIEW_ID__) {
            console.warn('[ViewManager] hydrateView: __SSR_VIEW_ID__ không có. Fallback → mountView.');
            return this.mountView(name, data, route);
        }

        const navigationGeneration = ++this.navigationGeneration;

        const targetUrl = (route as any)?.$uri ?? route?.$urlPath ?? name;

        // Tách __SSR_VIEW_ID__ khỏi data TRƯỚC khi tạo view — đây là key nội bộ
        // hydration, không phải view data. Tạo factory với viewData PHẲNG đã sạch
        // → ctrl.data không lẫn __SSR_VIEW_ID__, và (data flat) factory đọc đúng.
        const { __SSR_VIEW_ID__: ssrViewId, ...viewData } = data;

        const view = this.view(name, viewData, false);
        if (!view) {
            this.showError(`hydrateView: View "${name}" không tìm thấy.`);
            return null;
        }
        view.__ctrl__.urlPath = targetUrl;

        // Ghi đè viewId bằng SSR viewId — đảm bảo Html elements claim đúng
        // server DOM nodes có class prefix = viewId (e.g. "vssr-abc12-page-root").
        // (Belt-and-suspenders: đúng cả khi factory không đọc __SSR_VIEW_ID__.)
        view.__ctrl__.viewId = ssrViewId;

        // Render ở HYDRATE mode — elements claim DOM thay vì tạo mới
        const renderResult = await this.renderPageView(
            view, viewData, this.rootElement, InitModes.HYDRATE, false, 0, navigationGeneration
        );
        if (renderResult.type === 'cancelled') {
            view.__ctrl__.destroy();
            return null;
        }
        if (renderResult.type === 'error') {
            view.__ctrl__.destroy();
            this.showError(renderResult.message);
            return null;
        }

        this.activateRenderedChain(renderResult, InitModes.HYDRATE);

        return renderResult;
    }

    // ─── Getters ────────────────────────────────────────────────

    getCurrentLayout(): ViewInterface | null {
        return this.currentLayoutView;
    }

    getCurrentView(): ViewInterface | null {
        return this.currentPageView;
    }

    // ─── SSR boot ───────────────────────────────────────────────

    /** Còn SSR boot chưa consume? (route đầu tiên nên hydrate thay vì mount) */
    hasSSRBoot(): boolean {
        return this.ssrBoot !== null;
    }

    /**
     * Lấy viewId SSR cho một view name nếu nó là entry server đã render, rồi
     * CONSUME (xoá) — đảm bảo chỉ route ĐẦU TIÊN hydrate; navigate sau là CSR.
     * Trả null nếu không có SSR boot hoặc view không khớp entry.
     */
    consumeSSRViewId(viewName: string): string | null {
        if (this.ssrBoot && this.ssrBoot.view === viewName) {
            const id = this.ssrBoot.viewId;
            this.ssrBoot = null;
            return id;
        }
        return null;
    }

    getViewStack(): ViewInterface[] {
        return this.viewStack;
    }

    isInitialized(): boolean {
        return this._isInitialized;
    }


}
