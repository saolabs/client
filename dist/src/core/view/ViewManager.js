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
import { Html } from "../elements/Html";
import { hasData } from "../hellpers/utils";
import logger from "../services/LoggerService";
import { StoreService } from "../services/StoreService";
import { InitModes } from "../contracts/common";
import { OOTEnum } from "../types/utils";
import { app } from "../hellpers/app";
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
        this.rootElement = new Html({
            ctx: this,
            tagName: this.container.tagName.toLowerCase(),
            element: this.container,
            initMode: 'hydrate',
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
            const superResult = await this.renderPageView(result, {}, mountRoot, initMode, cache, renderLevel + 1);
            if (superResult.type === 'error') {
                return { ...superResult, view };
            }
            return this.createRenderPageViewSuccess(view, result, superResult.view, superResult.finalView ?? result);
        }
        return this.createRenderPageViewError(view, renderLevel, `View "${ctrl.path}" returned invalid content (type: ${resultType}) from ${method}().`);
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
                // Fire-and-forget: fetch data rồi re-render thay thế skeleton
                // TODO: Sau khi render() xong, cần swap DOM từ preloadElement → mainElement
                // ViewController.wrapper() tự động lưu prerender vào preloadElement, render vào mainElement
                // Cần bổ sung logic: unmount preloadElement khỏi DOM → mount mainElement vào cùng vị trí
                Http.get(fetchUrl).then(async (response) => {
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
    async mountView(name, data, route, navigationType = 'push') {
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
        if (oldLayoutView) {
            oldLayoutView.__ctrl__.stop();
        }
        oldPageView?.__ctrl__.stop();
        // ── Phase 2: Render chain ──
        const renderResult = await this.renderPageView(view, data ?? {}, this.rootElement, InitModes.CREATE, true);
        if (renderResult.type === 'error') {
            this.showError(renderResult.message);
            return null;
        }
        const pageView = renderResult.view;
        const finalView = renderResult.finalView;
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
        // ══════════════════════════════════════════════════════════
        // Case 1: Có superView + cùng layout instance (reuse layout)
        // ══════════════════════════════════════════════════════════
        if (hasSuperView && isSameLayout) {
            // Cắt origin chain cũ → gắn page mới vào layout
            oldLayoutView.__ctrl__.ejectOriginChain();
            pageView.__ctrl__.setChainFromOrigin();
            // Mount block content mới vào layout outlets
            this.blockManager.mountAll();
        }
        // ══════════════════════════════════════════════════════════
        // Case 2: Có superView + layout khác (hoặc first mount có layout)
        // ══════════════════════════════════════════════════════════
        else if (hasSuperView) {
            // Cleanup toàn bộ old views
            oldLayoutView?.__ctrl__.ejectOriginChain();
            this.stopPageView(oldPageView);
            this.stopLayoutView(oldLayoutView);
            this.blockManager.clearAllOutlets();
            this.unmountLayoutDOM(oldLayoutView);
            // Gắn origin chain cho layout mới
            pageView.__ctrl__.setChainFromOrigin();
            // Build DOM từ layout wrapper vào container
            this.buildViewDOM(finalView);
            // Mount block content vào layout outlets
            this.blockManager.mountAll();
            // Commit & Start toàn bộ chain
            this.commitViewChain(pageView, finalView, true);
            this.startViewChain(pageView, finalView, true);
        }
        // ══════════════════════════════════════════════════════════
        // Case 3: Không có superView (standalone view)
        // ══════════════════════════════════════════════════════════
        else {
            // Cleanup toàn bộ old views
            oldLayoutView?.__ctrl__.ejectOriginChain();
            this.stopPageView(oldPageView);
            this.stopLayoutView(oldLayoutView);
            this.blockManager.clearAllOutlets();
            this.unmountLayoutDOM(oldLayoutView);
            // Build DOM trực tiếp vào container
            this.buildViewDOM(pageView);
            // Commit & Start
            this.commitViewChain(pageView, pageView, false);
            this.startViewChain(pageView, pageView, false);
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
//# sourceMappingURL=ViewManager.js.map