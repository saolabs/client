"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewManager = void 0;
const BlockManager_1 = require("../services/BlockManager");
const PageCache_1 = require("../services/PageCache");
const Html_1 = require("../elements/Html");
const utils_1 = require("../helpers/utils");
const LoggerService_1 = __importDefault(require("../services/LoggerService"));
const StoreService_1 = require("../services/StoreService");
const common_1 = require("../contracts/common");
const utils_2 = require("../types/utils");
const app_1 = require("../helpers/app");
function isRenderableObject(result) {
    return typeof result === 'object' && result !== null && 'saoType' in result;
}
class ViewManager {
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
        /** Current layout view info — reused if same layout */
        this.currentLayout = null;
        this.cachedLayouts = new Map(); // Cache for previously mounted layouts
        /** All views in the current mount chain (outermost → innermost) */
        this.viewStack = [];
        /** Whether the manager has been initialized */
        this._isInitialized = false;
        /** Render counter for debugging */
        this.renderCount = 0;
        this.store = StoreService_1.StoreService.instance("ViewManager");
        this.blockManager = BlockManager_1.BlockManager;
        // ─── PageCache integration ──────────────────────────────────
        /** bfcache-style cache cho trang đã ghé (ROUTE_RENDER_FLOW.md §8) */
        this.pageCache = new PageCache_1.PageCacheService();
        if (app)
            this.App = app;
    }
    isViewMounted(path) {
        throw new Error("Method not implemented.");
    }
    destroy() {
        throw new Error("Method not implemented.");
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
        this.rootElement = new Html_1.Html({
            ctx: this,
            tagName: this.container.tagName.toLowerCase(),
            element: this.container,
            initMode: common_1.InitModes.HYDRATE,
            childrenFactory: () => [],
        });
        if (config?.registry) {
            this.setViewRegistry(config.registry);
        }
        this._isInitialized = true;
    }
    showError(message, details) {
        LoggerService_1.default.error(message, details);
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
                if ((0, utils_1.hasData)(data)) {
                    cachedView?.__ctrl__.updateData(data);
                }
                return cachedView;
            }
            const factory = this.viewRegistry[name];
            if (!factory || typeof factory !== 'function') {
                LoggerService_1.default.error(`View "${name}" not found in registry.`);
                return null;
            }
            const view = factory(data ? { data } : {}, { App: this.App, View: this, ...this.systemData });
            if (!view) {
                LoggerService_1.default.error(`Factory for view "${name}" did not return a valid view instance.`);
                return null;
            }
            if (cache) {
                this.store.set(name, view);
            }
            return view;
        }
        catch (err) {
            LoggerService_1.default.error(`Error loading view ${name}:`, err);
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
        return isRenderableObject(result) ? result.saoType : utils_2.OOTEnum.UNKNOWN;
    }
    async callViewRenderFactory(view, method = 'render', data = {}, mountRoot = null, initMode = common_1.InitModes.CREATE, cache = false, renderLevel = 0) {
        const ctrl = view.__ctrl__;
        if ((0, utils_1.hasData)(data)) {
            ctrl.updateData(data);
        }
        const result = method === 'render'
            ? ctrl.render()
            : (ctrl.prerender ? ctrl.prerender() : null);
        if (!result) {
            return this.createRenderPageViewError(view, renderLevel, `View "${ctrl.path}" returned nothing from ${method}().`);
        }
        const resultType = this.getRenderResultType(result);
        if (resultType === utils_2.OOTEnum.WRAPPER) {
            return this.createRenderPageViewSuccess(view, result, null, view);
        }
        if (resultType === utils_2.OOTEnum.VIEW) {
            const superResult = await this.renderPageView(result, {}, mountRoot, initMode, cache, renderLevel + 1);
            if (superResult.type === 'error') {
                return { ...superResult, view };
            }
            return this.createRenderPageViewSuccess(view, result, superResult.view, superResult.finalView ?? result);
        }
        return this.createRenderPageViewError(view, renderLevel, `View "${ctrl.path}" returned invalid content (type: ${resultType}) from ${method}().`);
    }
    async renderPageView(view, data, mountRoot = null, initMode = common_1.InitModes.CREATE, cache = false, renderLevel = 0) {
        try {
            const ctrl = view.__ctrl__;
            if ((0, utils_1.hasData)(data)) {
                ctrl.updateData(data);
            }
            const config = ctrl.getConfig();
            const hasAsyncData = config.hasAwaitData || config.hasFetchData;
            // ── Case 1: Không có async data → render ngay ──
            if (!hasAsyncData) {
                return this.callViewRenderFactory(view, 'render', data, mountRoot, initMode, cache, renderLevel);
            }
            // ── Resolve fetch URL từ ViewController config hoặc fallback Router ──
            const App = (0, app_1.app)();
            const Http = App.Http;
            const fetchConfig = config.fetch;
            const fetchUrl = (config.hasAwaitData && fetchConfig?.url) ? fetchConfig?.url : App.Router.getFullUrl();
            // ── Case 2: Có async + có prerender → prerender skeleton trước, fetch sau ──
            if (config.hasPrerender) {
                const prerenderResult = await this.callViewRenderFactory(view, 'prerender', data, mountRoot, initMode, cache, renderLevel);
                if (prerenderResult.type === 'error') {
                    LoggerService_1.default.error(`Error prerendering view "${ctrl.path}":`, prerenderResult.message);
                    // Fallback: render trực tiếp không qua prerender
                    return this.callViewRenderFactory(view, 'render', data, mountRoot, initMode, cache, renderLevel);
                }
                // Fire-and-forget: fetch data rồi re-render thay thế skeleton
                // TODO: Sau khi render() xong, cần swap DOM từ preloadElement → mainElement
                // ViewController.wrapper() tự động lưu prerender vào preloadElement, render vào mainElement
                // Cần bổ sung logic: unmount preloadElement khỏi DOM → mount mainElement vào cùng vị trí
                Http.get(fetchUrl).then(async (response) => {
                    const asyncData = response?.data ?? {};
                    if ((0, utils_1.hasData)(asyncData)) {
                        ctrl.updateData(asyncData);
                    }
                    const finalResult = await this.callViewRenderFactory(view, 'render', asyncData, mountRoot, initMode, cache, renderLevel);
                    if (finalResult.type === 'error') {
                        LoggerService_1.default.error(`Error rendering view "${ctrl.path}" after async data fetch:`, finalResult.message);
                    }
                    // TODO: swap preloadElement → mainElement trong DOM
                    // ctrl.preloadElement?.destroy();
                    // ctrl.mainElement?.setParentElement(mountRoot);
                    // ctrl.mainElement?.render();
                }).catch((err) => {
                    LoggerService_1.default.error(`Error fetching async data for view "${ctrl.path}":`, err);
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
                LoggerService_1.default.error(`Error fetching async data for view "${ctrl.path}":`, err);
            }
            if (!(0, utils_1.hasData)(asyncData)) {
                LoggerService_1.default.warn(`View "${ctrl.path}" has async data config but fetch returned no data.`);
            }
            return this.callViewRenderFactory(view, 'render', asyncData, mountRoot, initMode, cache, renderLevel);
        }
        catch (err) {
            LoggerService_1.default.error(`Error rendering view ${view.__ctrl__.path}:`, err);
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
        const renderResult = await this.renderPageView(view, data ?? {}, this.rootElement, common_1.InitModes.CREATE, false);
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
            pageView.__ctrl__.setParentElement(this.rootElement);
            if (pageView.__ctrl__.mainElement) {
                pageView.__ctrl__.mainElement.setParentElement(this.rootElement);
                pageView.__ctrl__.mainElement.mountTo(this.rootElement);
            }
            else if (pageView.__ctrl__.preloadElement) {
                pageView.__ctrl__.preloadElement.setParentElement(this.rootElement);
                pageView.__ctrl__.preloadElement.mountTo(this.rootElement);
            }
            // ── Phase 6: Commit data → Start (FIX: trước đây không bao giờ được gọi) ──
            pageView.__ctrl__.commitData();
            pageView.__ctrl__.start();
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
                pageView.__ctrl__.commitData();
                this.blockManager.startAll();
                pageView.__ctrl__.start(); // fire onMounted của page
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
                layoutCtrl.setParentElement(this.rootElement);
                if (layoutCtrl.mainElement) {
                    layoutCtrl.mainElement.setParentElement(this.rootElement);
                    layoutCtrl.mainElement.mountTo(this.rootElement);
                }
                // 3. Mount block content của page vào outlets
                this.blockManager.mountAll();
                // 4. Commit ngoài vào trong → start layout → start block content → page
                layoutCtrl.commitData();
                pageView.__ctrl__.commitData();
                layoutCtrl.start(); // layout tree + onMounted layout
                layoutCtrl.active();
                this.blockManager.startAll(); // block content của page
                pageView.__ctrl__.start(); // onMounted page
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
        const fragment = (0, PageCache_1.detachWrapperDOM)(wrapper);
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
            LoggerService_1.default.error(`[ViewManager] finalView "${finalView.__ctrl__.path}" has no mainElement (Wrapper).`);
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
                LoggerService_1.default.error(`[ViewManager] onDeactivated error:`, e);
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
                LoggerService_1.default.error(`[ViewManager] layout onDeactivated error:`, e);
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
                    LoggerService_1.default.error(`[ViewManager] page onMounted error:`, e);
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
                    LoggerService_1.default.error(`[ViewManager] onMounted error:`, e);
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
                LoggerService_1.default.error(`[ViewManager] layout onMounted error:`, e);
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
    // ─── Getters ────────────────────────────────────────────────
    getCurrentLayout() {
        return this.currentLayoutView;
    }
    getCurrentView() {
        return this.currentPageView;
    }
    getViewStack() {
        return this.viewStack;
    }
    isInitialized() {
        return this._isInitialized;
    }
}
exports.ViewManager = ViewManager;
