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
import { BlockManager } from "../services/BlockManager";
import { PageCacheService, detachWrapperDOM } from "../services/PageCache";
import { Html } from "../elements/Html";
import { hasData } from "../helpers/utils";
import { hydrateElementList } from "../helpers/view";
import markerRegistry from "../services/MarkerRegistry";
import logger from "../services/LoggerService";
import { StoreService } from "../services/StoreService";
import { InitModes } from "../contracts/common";
import { OOTEnum } from "../types/utils";
import { app } from "../helpers/app";
function isRenderableObject(result) {
    return typeof result === 'object' && result !== null && 'saoType' in result;
}
export class ViewManager {
    constructor(app) {
        /** DI container */
        this.App = null;
        this.systemData = {}; // For internal use, not exposed to views
        /** ROOT DOM container where views mount */
        this.container = null;
        this.rootElement = null; // Html wrapper for the root container
        /** View module registry: name → factory or async loader */
        this.viewRegistry = {};
        /** Currently mounted views (keyed by path) */
        this.activeViews = new Map();
        /** The outermost active view (layout or page) */
        this.currentView = null;
        /** Current layout path — for layout reuse detection */
        this.currentLayoutPath = null;
        this.currentLayoutView = null; // Store the current layout view instance for reuse
        this.currentPageView = null; // Store the current page view instance for reference in blocks and sections
        this.currentViewType = null; // Track whether the current view is a page or layout for correct lifecycle handling
        /**
         * SSR boot info — view entry (page) + viewId server đã render. Set ở init()
         * từ config.ssr (đọc từ DOM lúc boot). Router consume 1 lần cho route đầu
         * tiên → hydrateView; các route sau là CSR (SPA takeover).
         */
        this.ssrBoot = null;
        /** Current layout view info — reused if same layout */
        this.currentLayout = null;
        this.cachedLayouts = new Map(); // Cache for previously mounted layouts
        /** All views in the current mount chain (outermost → innermost) */
        this.viewStack = [];
        /** Whether the manager has been initialized */
        this._isInitialized = false;
        /** Render counter for debugging */
        this.renderCount = 0;
        this.store = StoreService.instance("ViewManager");
        this.blockManager = BlockManager;
        // ─── PageCache integration ──────────────────────────────────
        /** bfcache-style cache cho trang đã ghé (ROUTE_RENDER_FLOW.md §8) */
        this.pageCache = new PageCacheService();
        if (app)
            this.App = app;
    }
    /**
     * Kiểm tra một view có đang mount (active) không.
     * Dùng để guard duplicate mount hoặc kiểm tra trạng thái từ bên ngoài.
     */
    isViewMounted(path) {
        return this.activeViews.has(path);
    }
    /**
     * Destroy ViewManager hoàn toàn — dọn sạch mọi view, DOM, state.
     * Gọi khi teardown app (hot reload, test cleanup, unmount root).
     */
    destroy() {
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
    setApp(app) {
        this.App = app;
    }
    /**
     * Set the root DOM container.
     */
    setContainer(container) {
        this.container = container;
    }
    /**
     * Get the root container element.
     */
    getContainer() {
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
    setViewRegistry(registry) {
        this.viewRegistry = { ...this.viewRegistry, ...registry };
    }
    /**
     * Register a single view module.
     */
    registerView(name, loader) {
        this.viewRegistry[name] = loader;
    }
    /**
     * Initialize the ViewManager.
     */
    init(config) {
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
        if (config?.container) {
            if (typeof config.container === 'string') {
                const found = document.querySelector(config.container);
                if (found instanceof HTMLElement) {
                    this.container = found;
                }
                else {
                    console.warn(`[ViewManager] Container selector "${config.container}" not found.`);
                }
            }
            else {
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
    showError(message, details) {
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
    hasView(name) {
        return Object.prototype.hasOwnProperty.call(this.viewRegistry, name);
    }
    exists(name) {
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
    generateViewId() {
        return `v${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    }
    view(name, data, cache) {
        try {
            if (cache && this.store.has(name)) {
                const cachedView = this.store.get(name);
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
    createRenderPageViewError(view, renderLevel, message) {
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
    createRenderPageViewSuccess(view, result, superView, finalView) {
        return {
            type: 'success',
            message: '',
            view,
            result,
            superView,
            finalView,
        };
    }
    getRenderResultType(result) {
        return isRenderableObject(result) ? result.saoType : OOTEnum.UNKNOWN;
    }
    async callViewRenderFactory(view, method = 'render', data = {}, mountRoot = null, initMode = InitModes.CREATE, cache = false, renderLevel = 0) {
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
            return this.createRenderPageViewError(view, renderLevel, `View "${ctrl.path}" returned nothing from ${method}().`);
        }
        const resultType = this.getRenderResultType(result);
        if (resultType === OOTEnum.WRAPPER) {
            return this.createRenderPageViewSuccess(view, result, null, view);
        }
        if (resultType === OOTEnum.VIEW) {
            const superView = result;
            // ── Hydrate: gán viewId của layout TRƯỚC khi render nó ──────────
            // Page gọi extendView(layoutPath, {}) → layout tự sinh viewId ngẫu
            // nhiên, KHÔNG khớp viewId server đã render. Phải gán đúng id ở đây
            // (trước render → trước khi Wrapper layout capture ctx.viewId), bằng
            // cách đọc lại từ DOM view marker <!--s:v:{id}-s--> server để lại.
            if (initMode === InitModes.HYDRATE) {
                const discovered = this.discoverChainViewId(mountRoot, new Set([ctrl.viewId]));
                if (discovered) {
                    superView.__ctrl__.viewId = discovered;
                }
            }
            const superResult = await this.renderPageView(superView, {}, mountRoot, initMode, cache, renderLevel + 1);
            if (superResult.type === 'error') {
                return { ...superResult, view };
            }
            return this.createRenderPageViewSuccess(view, superView, superResult.view, superResult.finalView ?? superView);
        }
        return this.createRenderPageViewError(view, renderLevel, `View "${ctrl.path}" returned invalid content (type: ${resultType}) from ${method}().`);
    }
    /**
     * Discover viewId của một layout/superView từ SSR DOM (hydration).
     *
     * Page gọi extendView() KHÔNG truyền viewId của layout (server tự sinh id),
     * nên client đọc lại từ marker <!--s:v:{id}-s--> mà server đã render trong
     * container. Trả về id view marker đầu tiên chưa nằm trong excludeIds.
     *
     * ⚠ Hiện xử lý single layout. Nested layout (chain > 1) cần match marker
     *   theo độ sâu lồng nhau — TODO khi hỗ trợ nested hydration.
     */
    discoverChainViewId(mountRoot, excludeIds) {
        const root = mountRoot?.getElement?.() ?? this.rootElement?.getElement?.();
        if (!root)
            return null;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
        let node;
        while ((node = walker.nextNode())) {
            const parsed = markerRegistry.parseComment(node.nodeValue ?? '');
            if (parsed && parsed.tag === 'view' && !parsed.isClose && !excludeIds.has(parsed.id)) {
                return parsed.id;
            }
        }
        return null;
    }
    async renderPageView(view, data, mountRoot = null, initMode = InitModes.CREATE, cache = false, renderLevel = 0) {
        try {
            const ctrl = view.__ctrl__;
            if (hasData(data)) {
                ctrl.updateData(data);
            }
            const config = ctrl.getConfig();
            const hasAsyncData = config.hasAwaitData || config.hasFetchData;
            // ── Case 1: Không có async data → render ngay ──
            if (!hasAsyncData) {
                return this.callViewRenderFactory(view, 'render', data, mountRoot, initMode, cache, renderLevel);
            }
            // ── Resolve fetch URL từ ViewController config hoặc fallback Router ──
            const App = app();
            const Http = App.Http;
            const fetchConfig = config.fetch;
            const fetchUrl = (config.hasAwaitData && fetchConfig?.url) ? fetchConfig?.url : App.Router.getFullUrl();
            // ── Case 2: Có async + có prerender → prerender skeleton trước, fetch sau ──
            if (config.hasPrerender) {
                const prerenderResult = await this.callViewRenderFactory(view, 'prerender', data, mountRoot, initMode, cache, renderLevel);
                if (prerenderResult.type === 'error') {
                    logger.error(`Error prerendering view "${ctrl.path}":`, prerenderResult.message);
                    // Fallback: render trực tiếp không qua prerender
                    return this.callViewRenderFactory(view, 'render', data, mountRoot, initMode, cache, renderLevel);
                }
                // Fire-and-forget: fetch data → re-render → swap skeleton → main
                Http.get(fetchUrl).then(async (response) => {
                    const asyncData = response?.data ?? {};
                    if (hasData(asyncData)) {
                        ctrl.updateData(asyncData);
                    }
                    // Render main content (kết quả sẽ nằm trong ctrl.mainElement)
                    const finalResult = await this.callViewRenderFactory(view, 'render', asyncData, mountRoot, initMode, cache, renderLevel);
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
                    ctrl.commitData();
                    ctrl.mainElement?.start?.();
                    logger.info(`[ViewManager] prerender → main swap done for "${ctrl.path}"`);
                }).catch((err) => {
                    logger.error(`Error fetching async data for view "${ctrl.path}":`, err);
                });
                // Return prerender result ngay — mountView sẽ mount skeleton
                return prerenderResult;
            }
            // ── Case 3: Có async + không prerender → await fetch rồi render ──
            let asyncData = {};
            try {
                const response = await Http.get(fetchUrl);
                asyncData = response?.data ?? {};
            }
            catch (err) {
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
    /**
     * Mount view khi navigate — luồng chuẩn (ROUTE_RENDER_FLOW.md):
     *   sweep TTL → duplicate guard → pause+cache trang cũ →
     *   pop? restore từ PageCache : mount mới (render → mount DOM → commitData → start)
     *
     * LƯU Ý Phase 2: mới hoàn thiện nhánh standalone (không layout).
     * Nhánh layout (extends) thuộc Phase 3.
     */
    async mountView(name, data, route, navigationType = 'push') {
        const targetUrl = route?.$urlPath ?? name;
        // ── Phase 0: TTL sweep + duplicate guard ──
        this.pageCache.sweep();
        if (this.currentPageView
            && this.currentPageView.__ctrl__.urlPath === targetUrl) {
            return null; // đã đứng đúng trang này
        }
        const oldPageView = this.currentPageView;
        const oldLayoutView = this.currentLayoutView;
        // ── Phase 1: Rời trang cũ ──
        // Standalone → pause + PageCache. Page thuộc layout → destroy
        // (PageCache cho layout-page: Phase 3.5). Layout cũ xử lý SAU khi
        // biết layout mới có trùng không (Phase 5).
        if (!oldLayoutView && oldPageView) {
            this.deactivateStandalonePage(oldPageView);
        }
        this.currentPageView = null;
        // ── Phase 2: pop → thử restore từ PageCache ──
        if (navigationType === 'pop') {
            const entry = this.pageCache.take(targetUrl);
            if (entry) {
                return this.restoreFromCache(entry);
            }
        }
        else {
            // push tới URL đã có cache → data tươi: invalidate bản cũ
            this.pageCache.invalidate(targetUrl);
        }
        // ── Phase 3: Load view (instance MỚI cho page — instance sống do PageCache giữ) ──
        const view = this.view(name, data ?? {}, false);
        if (!view) {
            this.showError(`Failed to load view "${name}".`);
            return null;
        }
        view.__ctrl__.urlPath = targetUrl;
        // ── Phase 4: Render chain ──
        const renderResult = await this.renderPageView(view, data ?? {}, this.rootElement, InitModes.CREATE, false);
        if (renderResult.type === 'error') {
            this.showError(renderResult.message);
            return null;
        }
        const pageView = renderResult.view;
        const finalView = renderResult.finalView;
        const hasSuperView = renderResult.superView !== null;
        const newLayoutPath = hasSuperView ? finalView.__ctrl__.path : null;
        // ── Phase 5: Mount DOM ──
        if (!hasSuperView) {
            // Trang mới standalone — layout cũ (nếu có) destroy toàn bộ
            if (oldLayoutView) {
                this.destroyLayoutChain(oldPageView, oldLayoutView);
                this.currentLayoutView = null;
                this.currentLayoutPath = null;
            }
            // mount(): gắn DOM vào container + fire mounting/mounted + acquire style/script
            pageView.__ctrl__.mount(this.rootElement);
            // ── Phase 6: Commit data → Start → Flush ──
            pageView.__ctrl__.commitData();
            pageView.__ctrl__.start();
            pageView.__ctrl__.states.__.flushNow();
            pageView.__ctrl__.flushReactiveUpdatesNow();
            pageView.__ctrl__.active();
        }
        else {
            // ═══ Layout branch (@extends) — ROUTE_RENDER_FLOW.md §4, §5 ═══
            const isSameLayout = oldLayoutView !== null && finalView === oldLayoutView;
            if (isSameLayout) {
                // Layout giữ nguyên DOM + subscriptions. Chỉ swap ruột outlet.
                // 1. Destroy page cũ (clear block content của nó khỏi outlets)
                if (oldPageView) {
                    oldPageView.__ctrl__.destroy();
                }
                // 2. Mount block content page mới vào outlets (blocks đã đăng ký khi render)
                this.blockManager.mountAll();
                // 3. Commit + start CHỈ page mới — layout đứng ngoài
                pageView.__ctrl__.mount(); // page content đã ở outlets → fire hook + acquire asset
                pageView.__ctrl__.commitData();
                this.blockManager.startAll();
                pageView.__ctrl__.start();
                pageView.__ctrl__.states.__.flushNow();
                pageView.__ctrl__.flushReactiveUpdatesNow();
                pageView.__ctrl__.active();
            }
            else {
                // Layout mới (hoặc trước đó là standalone/layout khác)
                // 1. Dọn cái cũ
                if (oldLayoutView) {
                    this.destroyLayoutChain(oldPageView, oldLayoutView);
                }
                // 2. Mount layout wrapper vào container (render outlets, structure)
                const layoutCtrl = finalView.__ctrl__;
                layoutCtrl.mount(this.rootElement); // gắn DOM layout + fire hook + acquire asset layout
                // 3. Mount block content của page vào outlets
                this.blockManager.mountAll();
                pageView.__ctrl__.mount(); // page content đã ở outlets → fire hook + acquire asset
                // 4. Commit ngoài vào trong → start layout → start block content → page
                layoutCtrl.commitData();
                pageView.__ctrl__.commitData();
                layoutCtrl.start();
                layoutCtrl.states.__.flushNow();
                layoutCtrl.flushReactiveUpdatesNow();
                layoutCtrl.active();
                this.blockManager.startAll();
                pageView.__ctrl__.start();
                pageView.__ctrl__.states.__.flushNow();
                pageView.__ctrl__.flushReactiveUpdatesNow();
                pageView.__ctrl__.active();
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
    /** Destroy toàn bộ chain page + layout cũ (đổi layout hoặc về standalone) */
    destroyLayoutChain(oldPageView, oldLayoutView) {
        if (oldPageView) {
            oldPageView.__ctrl__.destroy();
        }
        const layoutPath = oldLayoutView.__ctrl__.path;
        oldLayoutView.__ctrl__.destroy();
        // Layout cached theo path trong store (extendView dùng cache=true) —
        // instance đã destroy không được phép trả về từ cache nữa
        if (layoutPath && this.store.has(layoutPath)) {
            this.store.remove?.(layoutPath);
        }
    }
    /**
     * Navigate đi khỏi trang standalone: pause + detach DOM → PageCache.
     * View khai báo cache:false (hoặc ttl 0) → destroy luôn.
     */
    deactivateStandalonePage(pageView) {
        const ctrl = pageView.__ctrl__;
        const wrapper = ctrl.mainElement;
        const urlPath = ctrl.urlPath;
        const cacheConfig = ctrl.getConfig('cache');
        if (!wrapper || !urlPath || cacheConfig === false) {
            ctrl.destroy();
            return;
        }
        ctrl.pause();
        const fragment = detachWrapperDOM(wrapper);
        this.pageCache.set(urlPath, {
            views: [pageView],
            fragment,
            scroll: {
                x: typeof window !== 'undefined' ? window.scrollX ?? 0 : 0,
                y: typeof window !== 'undefined' ? window.scrollY ?? 0 : 0,
            },
            ttl: typeof cacheConfig === 'object' && cacheConfig?.ttl != null ? cacheConfig.ttl : undefined,
        });
    }
    /** Back/forward hit cache: gắn lại DOM + resume — không render, không gọi API */
    restoreFromCache(entry) {
        const container = this.rootElement.getElement();
        container.appendChild(entry.fragment);
        for (const v of entry.views) {
            v.__ctrl__.resume();
            v.__ctrl__.active();
        }
        const pageView = entry.views[entry.views.length - 1];
        this.currentPageView = pageView;
        this.currentLayoutView = null;
        this.currentLayoutPath = null;
        this.currentViewType = 'view';
        this.viewStack = [...entry.views];
        this.renderCount++;
        // Restore scroll
        try {
            if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
                window.scrollTo(entry.scroll.x, entry.scroll.y);
            }
        }
        catch { /* jsdom không hỗ trợ — bỏ qua */ }
        return { type: 'restored', view: pageView, finalView: pageView, superView: null };
    }
    // ─── DOM Building ───────────────────────────────────────────
    /**
     * Build DOM từ finalView's Wrapper vào container.
     * Wrapper.render() sẽ execute childrenFactory → tạo DOM tree.
     */
    buildViewDOM(finalView) {
        const wrapper = finalView.__ctrl__.mainElement;
        if (!wrapper) {
            logger.error(`[ViewManager] finalView "${finalView.__ctrl__.path}" has no mainElement (Wrapper).`);
            return;
        }
        wrapper.setParentElement(this.rootElement);
        wrapper.render();
    }
    // ─── Lifecycle: Stop ────────────────────────────────────────
    stopPageView(pageView) {
        if (!pageView)
            return;
        // Stop block content (tracked by BlockManager)
        this.stopBlockContent();
        // Fire onDeactivated hook
        if (typeof pageView.onDeactivated === 'function') {
            try {
                pageView.onDeactivated();
            }
            catch (e) {
                logger.error(`[ViewManager] onDeactivated error:`, e);
            }
        }
    }
    stopLayoutView(layoutView) {
        if (!layoutView)
            return;
        const wrapper = layoutView.__ctrl__.mainElement;
        if (wrapper && typeof wrapper.stop === 'function') {
            wrapper.stop();
        }
        if (typeof layoutView.onDeactivated === 'function') {
            try {
                layoutView.onDeactivated();
            }
            catch (e) {
                logger.error(`[ViewManager] layout onDeactivated error:`, e);
            }
        }
    }
    stopBlockContent() {
        // BlockManager tracks mounted children per outlet
        for (const [name, children] of this.blockManager.mountedChildren) {
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
    startViewChain(pageView, finalView, hasSuperView) {
        if (hasSuperView) {
            // 1. Start layout element tree
            this.startLayoutView(finalView);
            // 2. Start page's block content
            this.startBlockContent();
            // 3. Fire page onMounted
            if (typeof pageView.onMounted === 'function') {
                try {
                    pageView.onMounted();
                }
                catch (e) {
                    logger.error(`[ViewManager] page onMounted error:`, e);
                }
            }
        }
        else {
            // Standalone view — start wrapper tree directly
            const wrapper = pageView.__ctrl__.mainElement;
            if (wrapper && typeof wrapper.start === 'function') {
                wrapper.start();
            }
            if (typeof pageView.onMounted === 'function') {
                try {
                    pageView.onMounted();
                }
                catch (e) {
                    logger.error(`[ViewManager] onMounted error:`, e);
                }
            }
        }
    }
    startLayoutView(layoutView) {
        const wrapper = layoutView.__ctrl__.mainElement;
        if (wrapper && typeof wrapper.start === 'function') {
            wrapper.start();
        }
        if (typeof layoutView.onMounted === 'function') {
            try {
                layoutView.onMounted();
            }
            catch (e) {
                logger.error(`[ViewManager] layout onMounted error:`, e);
            }
        }
    }
    startBlockContent() {
        for (const [name, children] of this.blockManager.mountedChildren) {
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
    commitViewChain(pageView, finalView, hasSuperView) {
        if (hasSuperView) {
            finalView.__ctrl__.commitData();
            pageView.__ctrl__.commitData();
        }
        else {
            pageView.__ctrl__.commitData();
        }
    }
    // ─── Unmount ────────────────────────────────────────────────
    unmountLayoutDOM(layoutView) {
        if (!layoutView)
            return;
        const wrapper = layoutView.__ctrl__.mainElement;
        if (wrapper && typeof wrapper.destroy === 'function') {
            wrapper.destroy();
        }
    }
    unmountAll() {
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
    unmountView(path) {
        const info = this.activeViews.get(path);
        if (!info)
            return;
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
    async hydrateView(name, data, route) {
        // Không có viewId từ server → không hydrate được, fallback CSR
        if (!data.__SSR_VIEW_ID__) {
            console.warn('[ViewManager] hydrateView: __SSR_VIEW_ID__ không có. Fallback → mountView.');
            return this.mountView(name, data, route);
        }
        const targetUrl = route?.$urlPath ?? name;
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
        const renderResult = await this.renderPageView(view, viewData, this.rootElement, InitModes.HYDRATE, false);
        if (renderResult.type === 'error') {
            this.showError(renderResult.message);
            return null;
        }
        const pageView = renderResult.view;
        const finalView = renderResult.finalView;
        const hasSuperView = renderResult.superView !== null;
        // ── Mount phase ─────────────────────────────────────────────────
        // Khác mountView: KHÔNG gọi mountTo() (sẽ clearHTML → xoá DOM server).
        // Thay vào đó gọi render() trên Wrapper để tạo element tree —
        // các Html/Output con sẽ claim server DOM nodes qua hydrate mode.
        // DOM structure đã có sẵn từ server, chỉ cần gắn JS references.
        if (!hasSuperView) {
            const ctrl = pageView.__ctrl__;
            ctrl.setParentElement(this.rootElement);
            // ── Bước 1: Commit state TRƯỚC khi render (thứ tự đặc thù hydration) ──
            // childrenFactory của @if/@foreach phụ thuộc state (vd `if (show)`).
            // Phải khôi phục state = trạng thái server đã dùng → factory sinh đúng
            // element tree → Html/Output con CLAIM đúng SSR DOM thay vì tạo mới.
            ctrl.commitData();
            // Discard pending changes do commitData sinh ra: SSR DOM đã phản ánh
            // các giá trị này rồi. flushNow() lúc CHƯA subscribe → notify rỗng,
            // chỉ xoá hàng đợi → tránh re-render phá DOM đã claim ở bước flush sau.
            ctrl.states.__.flushNow();
            // ── Bước 2: Render element tree ở HYDRATE mode (claim DOM) ──────────
            if (ctrl.mainElement) {
                ctrl.mainElement.setParentElement(this.rootElement);
                // Wrapper.render() tạo children trực tiếp; hydrateElementList gọi
                // render() đệ quy cho từng con (Html claim DOM, Output/Reactive
                // claim markers) mà KHÔNG appendChild — giữ nguyên DOM server.
                const children = ctrl.mainElement.render();
                if (children && children.length > 0) {
                    hydrateElementList(this.rootElement, children);
                }
            }
            // ── Bước 3: Chuyển sang CREATE — re-render sau này dùng CSR flow ────
            ctrl.initMode = InitModes.CREATE;
            // ── Bước 4: Start (subscribe) → flush no-op → active ───────────────
            ctrl.start();
            ctrl.states.__.flushNow();
            ctrl.flushReactiveUpdatesNow();
            ctrl.active();
        }
        else {
            // ═══ Hydrate layout chain (@extends) ═══════════════════════════
            const layoutCtrl = finalView.__ctrl__;
            const pageCtrl = pageView.__ctrl__;
            // Bước 1: Commit state cả layout + page TRƯỚC render; flush ngay
            // (chưa subscribe → discard pending) để không re-render phá DOM claim.
            layoutCtrl.commitData();
            layoutCtrl.states.__.flushNow();
            pageCtrl.commitData();
            pageCtrl.states.__.flushNow();
            // Bước 2: Claim DOM layout — Wrapper → Html(container) → BlockOutlet
            // claim cặp marker server. KHÔNG mountTo (sẽ clearHTML phá SSR).
            layoutCtrl.setParentElement(this.rootElement);
            if (layoutCtrl.mainElement) {
                layoutCtrl.mainElement.setParentElement(this.rootElement);
                const children = layoutCtrl.mainElement.render();
                if (children && children.length > 0) {
                    hydrateElementList(this.rootElement, children);
                }
            }
            // Bước 3: Claim block content vào outlets ở HYDRATE mode — factory
            // page chạy, Html/Output/Reactive con claim DOM server giữa marker.
            // (pageCtrl.initMode vẫn HYDRATE tại đây để this.html() claim.)
            this.blockManager.mountAllHydrate();
            // Bước 4: Chuyển sang CREATE — re-render sau này dùng CSR flow.
            layoutCtrl.initMode = InitModes.CREATE;
            pageCtrl.initMode = InitModes.CREATE;
            // Bước 5: Start layout → block content → page (ngoài vào trong).
            layoutCtrl.start();
            layoutCtrl.states.__.flushNow();
            layoutCtrl.flushReactiveUpdatesNow();
            layoutCtrl.active();
            this.blockManager.startAll();
            pageCtrl.start();
            pageCtrl.states.__.flushNow();
            pageCtrl.flushReactiveUpdatesNow();
            pageCtrl.active();
        }
        // ── Cập nhật state giống mountView ──────────────────────────────
        this.currentPageView = pageView;
        this.currentLayoutView = hasSuperView ? finalView : null;
        this.currentLayoutPath = hasSuperView ? finalView.__ctrl__.path : null;
        this.currentViewType = hasSuperView ? 'layout' : 'view';
        this.viewStack = hasSuperView ? [finalView, pageView] : [pageView];
        this.renderCount++;
        return renderResult;
    }
    // ─── Getters ────────────────────────────────────────────────
    getCurrentLayout() {
        return this.currentLayoutView;
    }
    getCurrentView() {
        return this.currentPageView;
    }
    // ─── SSR boot ───────────────────────────────────────────────
    /** Còn SSR boot chưa consume? (route đầu tiên nên hydrate thay vì mount) */
    hasSSRBoot() {
        return this.ssrBoot !== null;
    }
    /**
     * Lấy viewId SSR cho một view name nếu nó là entry server đã render, rồi
     * CONSUME (xoá) — đảm bảo chỉ route ĐẦU TIÊN hydrate; navigate sau là CSR.
     * Trả null nếu không có SSR boot hoặc view không khớp entry.
     */
    consumeSSRViewId(viewName) {
        if (this.ssrBoot && this.ssrBoot.view === viewName) {
            const id = this.ssrBoot.viewId;
            this.ssrBoot = null;
            return id;
        }
        return null;
    }
    getViewStack() {
        return this.viewStack;
    }
    isInitialized() {
        return this._isInitialized;
    }
}
//# sourceMappingURL=ViewManager.js.map