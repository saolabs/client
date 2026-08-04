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
import { SectionManager } from "../services/SectionManager";
import devtools from "../devtools/hook";
import { BlockOutlet } from "../elements/BlockOutlet";
import { PageCacheService, detachWrapperDOM } from "../services/PageCache";
import { Html } from "../elements/Html";
import { hasData } from "../helpers/utils";
import { activateView, claimHydratedView, commitView } from "../helpers/view";
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
        this.contextRevision = null;
        this.contextViews = null;
        /** ROOT DOM container where views mount */
        this.container = null;
        this.rootElement = null; // Html wrapper for the root container
        /** View module registry: name → factory or async loader */
        this.viewRegistry = {};
        /** Currently mounted views (keyed by path) */
        /** The outermost active view (layout or page) */
        this.currentView = null;
        /** Current layout path — for layout reuse detection */
        this.currentLayoutPath = null;
        this.currentLayoutView = null; // Store the current layout view instance for reuse
        /** Mounted layouts ordered outermost → innermost. */
        this.currentLayoutChain = [];
        this.currentPageView = null; // Store the current page view instance for reference in blocks and sections
        this.currentViewType = null; // Track whether the current view is a page or layout for correct lifecycle handling
        /**
         * SSR boot info — view entry (page) + viewId server đã render. Set ở init()
         * từ config.ssr (đọc từ DOM lúc boot). Router consume 1 lần cho route đầu
         * tiên → hydrateView; các route sau là CSR (SPA takeover).
         */
        this.ssrBoot = null;
        /** Exact Page/Layout instance relationships exported by Blade for hydration. */
        this.ssrViewData = {};
        /** Current layout view info — reused if same layout */
        this.currentLayout = null;
        /** All views in the current mount chain (outermost → innermost) */
        this.viewStack = [];
        /** Whether the manager has been initialized */
        this._isInitialized = false;
        /** Render counter for debugging */
        this.renderCount = 0;
        /** Invalidates fire-and-forget render work when a newer navigation begins. */
        this.navigationGeneration = 0;
        this.store = StoreService.instance("ViewManager");
        this.blockManager = BlockManager;
        this.sectionManager = SectionManager;
        /** Factory đã unwrap của các view lazy — tránh await + unwrap lại mỗi lần navigate. */
        this.resolvedFactories = new Map();
        // ─── PageCache integration ──────────────────────────────────
        /** bfcache-style cache cho trang đã ghé (ROUTE_RENDER_FLOW.md §8) */
        this.pageCache = new PageCacheService();
        if (app)
            this.App = app;
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
    isViewMounted(path) {
        if (this.currentPageView?.__ctrl__.path === path)
            return true;
        return this.currentLayoutChain.some(v => v.__ctrl__.path === path);
    }
    /** Invalidate async render/fetch work owned by the current navigation. */
    cancelNavigation() {
        this.navigationGeneration++;
    }
    /**
     * Destroy ViewManager hoàn toàn — dọn sạch mọi view, DOM, state.
     * Gọi khi teardown app (hot reload, test cleanup, unmount root).
     */
    destroy() {
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
        // MarkerRegistry là singleton TOÀN CỤC ở tầng module — không thuộc view
        // nào nên không teardown nào khác chạm tới. Teardown app (hot reload,
        // unmount root, dọn giữa các test) là chỗ duy nhất dọn được nó.
        markerRegistry.clear();
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
        devtools.attach(this);
    }
    /**
     * Phương án CUỐI khi không error boundary nào xử lý (xem ViewController.onError):
     * ghi đè cả container. Dựng bằng DOM API + textContent — message/details có thể
     * mang nội dung từ server/URL, nội suy vào innerHTML là đường tiêm HTML.
     */
    showError(message, details) {
        logger.error(message, details);
        if (!this.container)
            return;
        const box = document.createElement('div');
        box.style.cssText = 'padding:20px;background:#fee;color:#900;border:1px solid #900';
        const title = document.createElement('h2');
        title.textContent = 'Error';
        box.appendChild(title);
        const text = document.createElement('p');
        text.textContent = message;
        box.appendChild(text);
        if (details) {
            const pre = document.createElement('pre');
            pre.style.cssText = 'white-space:pre-wrap;background:#fdd;padding:10px;border:1px solid #900';
            let serialized;
            try {
                serialized = JSON.stringify(details, null, 2) ?? String(details);
            }
            catch {
                serialized = String(details); // circular / getter throw
            }
            pre.textContent = serialized;
            box.appendChild(pre);
        }
        this.container.replaceChildren(box);
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
    /**
     * Tạo View instance. Hỗ trợ registry lazy (`() => import('./x.js')`) — dùng
     * cho view cấp ROUTE (mountView/hydrateView). `@include`/`@extends` chạy
     * trong render tree đồng bộ nên dùng `resolveViewSync()`.
     */
    async view(name, data, cache) {
        try {
            const cached = this.viewFromStore(name, data, cache);
            if (cached)
                return cached;
            const factory = this.resolvedFactories.get(name) ?? this.viewRegistry[name];
            if (!factory || typeof factory !== 'function') {
                logger.error(`View "${name}" not found in registry.`);
                return null;
            }
            const systemData = this.buildSystemData();
            let view = factory(data ?? {}, systemData);
            // Registry lazy → Promise<module>. Await, chuẩn hoá, cache factory đã
            // unwrap để lần navigate sau không phải await/unwrap lại.
            if (view && typeof view.then === 'function') {
                const lazyFactory = this.unwrapLazyFactory(await view);
                if (!lazyFactory) {
                    logger.error(`Lazy view "${name}" did not resolve to a factory or View.`);
                    return null;
                }
                this.resolvedFactories.set(name, lazyFactory);
                view = lazyFactory(data ?? {}, systemData);
            }
            return this.finalizeView(name, view, cache);
        }
        catch (err) {
            // Gồm cả chunk 404 / mạng lỗi khi import() — không để throw ra Router.
            logger.error(`Error loading view ${name}:`, err);
            return null;
        }
    }
    /**
     * Bản đồng bộ cho `@include`/`@extends` — render tree không await được.
     * View lazy CHƯA preload → null + hướng dẫn, thay vì trả Promise làm vỡ
     * ngầm ở `view.__ctrl__` phía sau.
     */
    resolveViewSync(name, data, cache) {
        try {
            const cached = this.viewFromStore(name, data, cache);
            if (cached)
                return cached;
            const factory = this.resolvedFactories.get(name) ?? this.viewRegistry[name];
            if (!factory || typeof factory !== 'function') {
                logger.error(`View "${name}" not found in registry.`);
                return null;
            }
            const view = factory(data ?? {}, this.buildSystemData());
            if (view && typeof view.then === 'function') {
                logger.error(`View "${name}" là lazy nhưng được dùng qua @include/@extends — render tree đồng bộ ` +
                    `không await được. Gọi App.View.preloadView("${name}") trước, hoặc để view này eager trong registry.`);
                return null;
            }
            return this.finalizeView(name, view, cache);
        }
        catch (err) {
            logger.error(`Error loading view ${name}:`, err);
            return null;
        }
    }
    /** Nạp trước một view lazy để `@include`/`@extends` dùng được đồng bộ sau đó. */
    async preloadView(name) {
        if (this.resolvedFactories.has(name))
            return true;
        const view = await this.view(name, {}, false);
        if (!view)
            return false;
        view.__ctrl__?.destroy?.(); // instance dò đường — chỉ cần factory đã cache
        return true;
    }
    viewFromStore(name, data, cache) {
        if (!cache || !this.store.has(name))
            return null;
        const cachedView = this.store.get(name);
        if (hasData(data))
            cachedView?.__ctrl__.updateData(data);
        return cachedView;
    }
    /**
     * Truyền data PHẲNG cho factory: compiled factory nhận __data__ là chính
     * object data (đọc __data__.__SSR_VIEW_ID__, setup({data:__data__})).
     * Trước đây bọc { data } → __data__.__SSR_VIEW_ID__ = undefined và ctrl.data
     * bị lồng (vỡ route-param). Xem docs/HYDRATION.md §9.2.
     */
    buildSystemData() {
        return { App: this.App, View: this, ...this.systemData };
    }
    finalizeView(name, view, cache) {
        if (!view) {
            logger.error(`Factory for view "${name}" did not return a valid view instance.`);
            return null;
        }
        if (cache)
            this.store.set(name, view);
        return view;
    }
    /**
     * Chuẩn hoá kết quả resolve của registry lazy về factory `(data, sys) => View`.
     * Chấp nhận: module namespace (`{ default: factory }`), factory trần, hoặc
     * View instance — người viết registry không phải tự `.then(m => m.default)`.
     */
    unwrapLazyFactory(resolved) {
        if (!resolved)
            return null;
        if (typeof resolved === 'function')
            return resolved;
        if (typeof resolved.default === 'function')
            return resolved.default;
        if (resolved.__ctrl__)
            return () => resolved; // đã là View instance
        return null;
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
            chain: [view],
        };
    }
    createRenderPageViewCancelled(view) {
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
    isNavigationCurrent(generation) {
        return generation === this.navigationGeneration;
    }
    createRenderPageViewSuccess(view, result, superView, finalView, chain = [view]) {
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
    getRenderResultType(result) {
        return isRenderableObject(result) ? result.saoType : OOTEnum.UNKNOWN;
    }
    async callViewRenderFactory(view, method = 'render', data = {}, mountRoot = null, initMode = InitModes.CREATE, cache = false, renderLevel = 0, navigationGeneration = this.navigationGeneration) {
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
            return this.createRenderPageViewError(view, renderLevel, `View "${ctrl.path}" returned nothing from ${method}().`);
        }
        const resultType = this.getRenderResultType(result);
        if (resultType === OOTEnum.WRAPPER) {
            return this.createRenderPageViewSuccess(view, result, null, view);
        }
        if (resultType === OOTEnum.VIEW) {
            const superView = result;
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
                    return this.createRenderPageViewSuccess(view, superView, superView, reusedChain[reusedChain.length - 1] ?? superView, [view, ...reusedChain]);
                }
            }
            // ── Hydrate: gán viewId của layout TRƯỚC khi render nó ──────────
            // Page gọi extendView(layoutPath, {}) → layout tự sinh viewId ngẫu
            // nhiên, KHÔNG khớp viewId server đã render. Phải gán đúng id ở đây
            // (trước render → trước khi Wrapper layout capture ctx.viewId), bằng
            // cách đọc lại từ DOM view marker <!--s:v:{id}-s--> server để lại.
            if (initMode === InitModes.HYDRATE) {
                const discovered = this.discoverChainViewId(mountRoot, new Set([ctrl.viewId]), superView.__ctrl__.path, ctrl.viewId);
                if (discovered) {
                    superView.__ctrl__.viewId = discovered;
                }
            }
            const superResult = await this.renderPageView(superView, {}, mountRoot, initMode, cache, renderLevel + 1, navigationGeneration);
            if (superResult.type !== 'success') {
                return { ...superResult, view };
            }
            return this.createRenderPageViewSuccess(view, superView, superResult.view, superResult.finalView ?? superView, [view, ...superResult.chain]);
        }
        return this.createRenderPageViewError(view, renderLevel, `View "${ctrl.path}" returned invalid content (type: ${resultType}) from ${method}().`);
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
    discoverChainViewId(mountRoot, excludeIds, viewPath, parentViewId) {
        if (viewPath) {
            const instances = this.ssrViewData[viewPath]?.instances;
            if (instances && typeof instances === 'object') {
                for (const [instanceId, instance] of Object.entries(instances)) {
                    const id = instance?.viewId ?? instanceId;
                    if (id && !excludeIds.has(id)
                        && (!parentViewId || instance?.parent?.id === parentViewId)) {
                        return id;
                    }
                }
            }
            const records = document.querySelectorAll('script[data-ref="view-data"][data-view-id]');
            for (const record of records) {
                const id = record.getAttribute('data-view-id');
                if (record.getAttribute('data-view-name') === viewPath
                    && id && !excludeIds.has(id))
                    return id;
            }
        }
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
    async renderPageView(view, data, mountRoot = null, initMode = InitModes.CREATE, cache = false, renderLevel = 0, navigationGeneration = this.navigationGeneration) {
        try {
            if (!this.isNavigationCurrent(navigationGeneration)) {
                return this.createRenderPageViewCancelled(view);
            }
            const ctrl = view.__ctrl__;
            if (hasData(data)) {
                ctrl.updateData(data);
            }
            const config = ctrl.getConfig();
            const hasAsyncData = config.hasAwaitData || config.hasFetchData;
            // ── Case 1: Không có async data → render ngay ──
            if (!hasAsyncData) {
                return this.callViewRenderFactory(view, 'render', data, mountRoot, initMode, cache, renderLevel, navigationGeneration);
            }
            // ── Hydrate: SSR đã fetch + nhúng data rồi (qua __data__/ssrData) —
            // KHÔNG fetch lại, KHÔNG hiện skeleton. Nhưng prerender() không chỉ
            // là skeleton: với view @extends + @block, compiler gom phần block/
            // section TĨNH (không phụ thuộc data await) VÀO PRERENDER, render()
            // chỉ khai báo lại đúng (các) block phụ thuộc data (xem
            // examples/sao/await.sao đã compile: prerender() có
            // block-content(placeholder)+block-footer+section('sidebar'), còn
            // render() chỉ có block-content — bỏ qua prerender() sẽ làm mất
            // hẳn block-footer/sidebar khi hydrate).
            // → Vẫn phải gọi prerender() để đăng ký các block/section tĩnh đó,
            // rồi gọi NGAY render() (data đã có sẵn, không await fetch) — nó
            // ghi đè contentRenderFactory của block phụ thuộc data (placeholder
            // → nội dung thật) tại chỗ. Không có gì được mount ở bước nào cả
            // (hydrate mode chỉ claim), nên không có flash trung gian.
            if (initMode === InitModes.HYDRATE) {
                if (config.hasPrerender) {
                    const prerenderResult = await this.callViewRenderFactory(view, 'prerender', data, mountRoot, initMode, cache, renderLevel, navigationGeneration);
                    if (prerenderResult.type === 'cancelled')
                        return prerenderResult;
                    if (prerenderResult.type === 'error') {
                        logger.error(`Error prerendering view "${ctrl.path}" during hydrate:`, prerenderResult.message);
                        // Tiếp tục render() — thà thiếu block tĩnh còn hơn vỡ cả trang.
                    }
                }
                return this.callViewRenderFactory(view, 'render', data, mountRoot, initMode, cache, renderLevel, navigationGeneration);
            }
            // ── Resolve fetch URL từ ViewController config hoặc fallback Router ──
            const App = app();
            const Http = App.Http;
            const fetchConfig = config.fetch;
            const fetchUrl = (config.hasAwaitData && fetchConfig?.url) ? fetchConfig?.url : App.Router.getFullUrl();
            // ── Case 2: Có async + có prerender → prerender skeleton trước, fetch sau ──
            if (config.hasPrerender) {
                const renderGeneration = navigationGeneration;
                const prerenderResult = await this.callViewRenderFactory(view, 'prerender', data, mountRoot, initMode, cache, renderLevel, navigationGeneration);
                if (prerenderResult.type === 'cancelled')
                    return prerenderResult;
                if (prerenderResult.type === 'error') {
                    logger.error(`Error prerendering view "${ctrl.path}":`, prerenderResult.message);
                    // Fallback: render trực tiếp không qua prerender
                    return this.callViewRenderFactory(view, 'render', data, mountRoot, initMode, cache, renderLevel, navigationGeneration);
                }
                // Fire-and-forget: fetch data → re-render → swap skeleton → main
                Http.get(fetchUrl).then(async (response) => {
                    // Route mới hoặc manager teardown đã bắt đầu: tuyệt đối không
                    // render/mount kết quả cũ trở lại root DOM.
                    if (renderGeneration !== this.navigationGeneration
                        || ctrl.lifecycleState === 'destroyed')
                        return;
                    const asyncData = this.extractAsyncData(response);
                    if (hasData(asyncData)) {
                        ctrl.updateData(asyncData);
                    }
                    // Render main content (kết quả sẽ nằm trong ctrl.mainElement)
                    const finalResult = await this.callViewRenderFactory(view, 'render', asyncData, mountRoot, initMode, cache, renderLevel, navigationGeneration);
                    if (renderGeneration !== this.navigationGeneration
                        || ctrl.lifecycleState === 'destroyed')
                        return;
                    if (finalResult.type === 'error') {
                        logger.error(`Error rendering view "${ctrl.path}" after async data fetch:`, finalResult.message);
                        return;
                    }
                    if (finalResult.superView) {
                        // ── @extends page: render() re-registered real block content
                        // via this.block(...), but never called this.wrapper() — so
                        // ctrl.mainElement/preloadElement (what the standalone swap
                        // below acts on) were never set. The already-mounted layout's
                        // outlet still shows the placeholder from the prerender-time
                        // this.block(...) call; push the new content into it the same
                        // way the initial mount does (mountViewBlocks clears the old
                        // content first, so the placeholder is removed as part of this).
                        this.blockManager.mountViewBlocks(ctrl.viewId);
                        this.sectionManager.mountViewSections(ctrl.viewId);
                        commitView(ctrl);
                        this.blockManager.startAll();
                        this.sectionManager.startAll();
                        logger.info(`[ViewManager] prerender → main swap done for "${ctrl.path}" (block content)`);
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
                }).catch((err) => {
                    if (!this.isNavigationCurrent(renderGeneration))
                        return;
                    // Fetch hỏng khi skeleton đang hiển thị: không có boundary thì
                    // trước giờ chỉ log → skeleton treo vĩnh viễn. Đưa vào boundary
                    // để view tự hiện trạng thái lỗi.
                    const handled = ctrl.handleError(err, { phase: 'async', path: ctrl.path }).handled;
                    if (!handled)
                        logger.error(`Error fetching async data for view "${ctrl.path}":`, err);
                });
                // Return prerender result ngay — mountView sẽ mount skeleton
                return prerenderResult;
            }
            // ── Case 3: Có async + không prerender → await fetch rồi render ──
            let asyncData = {};
            try {
                const response = await Http.get(fetchUrl);
                asyncData = this.extractAsyncData(response);
            }
            catch (err) {
                if (!this.isNavigationCurrent(navigationGeneration)) {
                    return this.createRenderPageViewCancelled(view);
                }
                const handled = ctrl.handleError(err, { phase: 'async', path: ctrl.path }).handled;
                if (!handled)
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
    async mountView(name, data, route, navigationType = 'push') {
        // Request URI = path + query (KHÔNG hash) — Router cung cấp qua $uri
        const targetUrl = route?.$uri ?? route?.$urlPath ?? name;
        // ── Phase 0: TTL sweep + duplicate guard ──
        this.pageCache.sweep();
        if (this.currentPageView
            && this.currentPageView.__ctrl__.urlPath === targetUrl) {
            return null; // đã đứng đúng trang này
        }
        // Mọi async work của navigation trước trở thành stale từ thời điểm này.
        const navigationGeneration = ++this.navigationGeneration;
        // Head tags (title/meta) từ trang trước không được rò rỉ sang trang mới —
        // mountViewSections() của layout/page mới sẽ set lại đúng phần chúng khai báo.
        this.sectionManager.resetPageHead();
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
            this.deactivatePage(oldPageView, oldLayoutView);
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
            if (restored)
                return restored;
        }
        // ── Phase 2: Load + render chain trong khi page cũ vẫn active. ──
        // Chỉ khi render thành công mới pause/destroy page cũ; fetch/render lỗi
        // không được làm màn hình hiện tại biến mất.
        const view = await this.view(name, data ?? {}, false);
        if (!view) {
            const message = `Failed to load view "${name}".`;
            if (oldPageView && oldPageDeactivated) {
                this.restoreDeactivatedPage(oldPageView, oldLayoutView);
            }
            if (oldPageView)
                logger.error(message);
            else
                this.showError(message);
            return null;
        }
        view.__ctrl__.urlPath = targetUrl;
        const renderResult = await this.renderPageView(view, data ?? {}, this.rootElement, InitModes.CREATE, false, 0, navigationGeneration);
        if (renderResult.type === 'cancelled') {
            view.__ctrl__.destroy();
            if (oldPageView && oldPageDeactivated) {
                this.restoreDeactivatedPage(oldPageView, oldLayoutView);
            }
            return null;
        }
        if (renderResult.type === 'error') {
            view.__ctrl__.destroy();
            if (oldPageView && oldPageDeactivated) {
                this.restoreDeactivatedPage(oldPageView, oldLayoutView);
            }
            if (oldPageView)
                logger.error(renderResult.message);
            else
                this.showError(renderResult.message);
            return null;
        }
        // ── Phase 3: commit transition ──
        // Page/Layout mới đã resolve xong; bây giờ mới rời chain cũ và mount chain mới.
        if (oldPageView && !oldPageDeactivated) {
            this.deactivatePage(oldPageView, oldLayoutView);
        }
        this.currentPageView = null;
        // Phase mount nằm NGOÀI try/catch của renderPageView: lỗi phát sinh khi
        // gắn tree vào DOM (vd @include con throw) trước đây thoát hẳn ra ngoài
        // → unhandled rejection + trang mount dở. Error boundary đã xử lý phần
        // lớn (Component/Reactive); đây là lưới cuối khi không boundary nào nhận.
        try {
            this.activateRenderedChain(renderResult, InitModes.CREATE, oldLayoutChain);
        }
        catch (err) {
            logger.error(`Error mounting view "${name}":`, err);
            this.showError(`Error mounting view "${name}".`, err instanceof Error ? err.message : err);
            return null;
        }
        return renderResult;
    }
    /** Commit the successfully mounted/hydrated chain as the only active route state. */
    commitActiveChain(pageView, layoutChain) {
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
    activateRenderedChain(renderResult, initMode, oldLayoutChain = []) {
        const pageView = renderResult.view;
        const layoutChain = renderResult.chain.slice(1).reverse();
        if (initMode === InitModes.HYDRATE) {
            this.activateHydratedChain(pageView, layoutChain);
        }
        else {
            this.activateCreatedChain(pageView, layoutChain, oldLayoutChain);
        }
        this.commitActiveChain(pageView, layoutChain);
    }
    /** CSR strategy: insert new DOM, while preserving/reusing a compatible Layout. */
    activateCreatedChain(pageView, layoutChain, oldLayoutChain) {
        const pageCtrl = pageView.__ctrl__;
        if (layoutChain.length === 0) {
            if (oldLayoutChain.length > 0) {
                this.deactivateLayoutChain(oldLayoutChain);
                this.currentLayoutView = null;
                this.currentLayoutChain = [];
                this.currentLayoutPath = null;
            }
            pageCtrl.mount(this.rootElement);
            commitView(pageCtrl);
            activateView(pageCtrl);
            this.sectionManager.mountViewSections(pageCtrl.viewId);
            this.sectionManager.startAll();
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
        }
        else {
            // Root layout vẫn dùng chung; chỉ dọn phần chain không còn reuse.
            for (let i = oldLayoutChain.length - 1; i >= common; i--) {
                this.destroyLayoutView(oldLayoutChain[i]);
            }
        }
        const resumed = common === 0 && this.resumeLayoutChainFromCache(layoutChain);
        const newLayouts = [];
        if (!resumed) {
            let start = common;
            if (common === 0) {
                layoutChain[0].__ctrl__.mount(this.rootElement);
                newLayouts.push(layoutChain[0]);
                start = 1;
            }
            for (let i = start; i < layoutChain.length; i++) {
                const layout = layoutChain[i];
                this.blockManager.mountViewBlocks(layout.__ctrl__.viewId);
                this.sectionManager.mountViewSections(layout.__ctrl__.viewId);
                layout.__ctrl__.mount();
                newLayouts.push(layout);
            }
        }
        this.blockManager.mountViewBlocks(pageCtrl.viewId);
        this.sectionManager.mountViewSections(pageCtrl.viewId);
        pageCtrl.mount();
        for (const layout of newLayouts)
            commitView(layout.__ctrl__);
        commitView(pageCtrl);
        for (const layout of newLayouts)
            activateView(layout.__ctrl__);
        this.blockManager.startAll();
        this.sectionManager.startAll();
        activateView(pageCtrl);
    }
    /** Hydration strategy: claim Blade DOM without insert/clear mutations. */
    activateHydratedChain(pageView, layoutChain) {
        const pageCtrl = pageView.__ctrl__;
        if (layoutChain.length === 0) {
            commitView(pageCtrl, true);
            claimHydratedView(pageCtrl, this.rootElement);
            pageCtrl.mount();
            pageCtrl.initMode = InitModes.CREATE;
            activateView(pageCtrl);
            this.sectionManager.hydrateViewSections(pageCtrl.viewId);
            this.sectionManager.startAll();
            return;
        }
        for (const layout of layoutChain)
            commitView(layout.__ctrl__, true);
        commitView(pageCtrl, true);
        const rootLayoutCtrl = layoutChain[0].__ctrl__;
        claimHydratedView(rootLayoutCtrl, this.rootElement);
        rootLayoutCtrl.mount();
        for (let i = 1; i < layoutChain.length; i++) {
            const ctrl = layoutChain[i].__ctrl__;
            this.blockManager.hydrateViewBlocks(ctrl.viewId);
            this.sectionManager.hydrateViewSections(ctrl.viewId);
            ctrl.mount();
        }
        this.blockManager.hydrateViewBlocks(pageCtrl.viewId);
        this.sectionManager.hydrateViewSections(pageCtrl.viewId);
        pageCtrl.mount();
        for (const layout of layoutChain)
            layout.__ctrl__.initMode = InitModes.CREATE;
        pageCtrl.initMode = InitModes.CREATE;
        for (const layout of layoutChain)
            activateView(layout.__ctrl__);
        this.blockManager.startAll();
        this.sectionManager.startAll();
        activateView(pageCtrl);
    }
    /**
     * Destroy layout cũ (đổi layout hoặc về standalone).
     * Page cũ đã rời ở Phase 1 (deactivatePage) — không destroy tại đây.
     */
    destroyLayoutView(layoutView) {
        const layoutPath = layoutView.__ctrl__.path;
        layoutView.__ctrl__.destroy();
        // Layout cached theo path trong store (extendView dùng cache=true) —
        // instance đã destroy không được phép trả về từ cache nữa
        if (layoutPath && this.store.has(layoutPath)) {
            this.store.remove?.(layoutPath);
        }
    }
    destroyLayoutChain(layoutChain) {
        for (let i = layoutChain.length - 1; i >= 0; i--) {
            this.destroyLayoutView(layoutChain[i]);
        }
    }
    /**
     * Cache key = `${viewName}::${requestUri}` — URI gồm path + query,
     * KHÔNG gồm hash (strip defensive tại đây).
     */
    cacheKey(viewName, uri) {
        return `${viewName}::${(uri ?? '').split('#')[0]}`;
    }
    /** Cache key cho layout — namespace riêng, không đụng key page (name::uri) */
    layoutCacheKey(layoutPath) {
        return `__layout__::${layoutPath}`;
    }
    layoutChainIdentity(layoutChain) {
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
    deactivateLayout(layoutView) {
        this.deactivateLayoutChain([layoutView]);
    }
    deactivateLayoutChain(layoutChain) {
        const rootCtrl = layoutChain[0]?.__ctrl__;
        if (!rootCtrl)
            return;
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
    resumeLayoutChainFromCache(layoutChain) {
        if (layoutChain.length === 0
            || layoutChain.some(layout => layout.__ctrl__.lifecycleState !== 'paused'))
            return false;
        const entry = this.pageCache.take(this.layoutCacheKey(this.layoutChainIdentity(layoutChain)));
        if (entry) {
            this.rootElement.getElement().appendChild(entry.fragment);
            for (const layout of layoutChain)
                layout.__ctrl__.resume();
        }
        else {
            return false;
        }
        for (const layout of layoutChain)
            this.reregisterLayoutOutlets(layout.__ctrl__);
        return true;
    }
    /** Đăng ký lại outlets của layout vừa resume vào BlockManager registry */
    reregisterLayoutOutlets(layoutCtrl) {
        const elements = layoutCtrl.elements;
        if (!elements)
            return;
        for (const [id, el] of elements) {
            if (el instanceof BlockOutlet && !el.__destroyed__) {
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
    deactivatePage(pageView, layoutView, layoutChain = this.currentLayoutChain) {
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
        }
        else {
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
    restoreDeactivatedPage(pageView, layoutView) {
        const ctrl = pageView.__ctrl__;
        if (!ctrl.urlPath)
            return false;
        const entry = this.pageCache.take(this.cacheKey(ctrl.path, ctrl.urlPath));
        if (!entry)
            return false;
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
    restoreFromCache(entry, oldLayoutView, navigationType) {
        const pageView = entry.views[entry.views.length - 1];
        if (entry.layoutPath) {
            // ── Page thuộc layout ────────────────────────────────────────
            // 1. Layout đang mount trùng path? → dùng luôn
            let layoutChain = this.layoutChainIdentity(this.currentLayoutChain) === entry.layoutPath
                ? [...this.currentLayoutChain]
                : [];
            let layoutView = layoutChain[0] ?? null;
            // 2. Không trùng → thử resurrect layout từ layout cache
            if (!layoutView && entry.outletContents) {
                const layoutEntry = this.pageCache.take(this.layoutCacheKey(entry.layoutPath));
                if (layoutEntry) {
                    if (this.currentLayoutChain.length > 0) {
                        this.deactivateLayoutChain(this.currentLayoutChain);
                    }
                    layoutChain = [...layoutEntry.views];
                    const lv = layoutChain[0];
                    this.rootElement.getElement().appendChild(layoutEntry.fragment);
                    for (const layout of layoutChain)
                        layout.__ctrl__.resume();
                    for (const layout of layoutChain)
                        this.reregisterLayoutOutlets(layout.__ctrl__);
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
            for (const v of entry.views) {
                this.sectionManager.mountViewSections(v.__ctrl__.viewId);
            }
            this.currentPageView = pageView;
            this.currentLayoutView = layoutView;
            this.currentLayoutChain = layoutChain;
            this.currentLayoutPath = layoutView.__ctrl__.path;
            this.currentViewType = 'layout';
            this.viewStack = [...layoutChain, pageView];
        }
        else {
            // ── Standalone ───────────────────────────────────────────────
            if (this.currentLayoutChain.length > 0) {
                this.deactivateLayoutChain(this.currentLayoutChain);
                this.currentLayoutView = null;
                this.currentLayoutChain = [];
                this.currentLayoutPath = null;
            }
            const container = this.rootElement.getElement();
            container.appendChild(entry.fragment);
            for (const v of entry.views) {
                v.__ctrl__.resume();
            }
            for (const v of entry.views) {
                this.sectionManager.mountViewSections(v.__ctrl__.viewId);
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
                }
                else {
                    window.scrollTo(0, 0);
                }
            }
        }
        catch { /* jsdom không hỗ trợ — bỏ qua */ }
        return {
            type: 'restored',
            view: pageView,
            finalView: this.currentLayoutView ?? pageView,
            superView: this.currentLayoutView,
        };
    }
    // ─── Unmount ────────────────────────────────────────────────
    unmountAll() {
        // Stop block content (unsubscribe) trước, rồi destroy chain trong → ngoài.
        // ctrl.destroy() tự fire đủ hook: stopping/stopped → unmounting/unmounted → destroyed.
        this.blockManager.stopAll();
        this.sectionManager.stopAll();
        if (this.currentPageView) {
            this.currentPageView.__ctrl__.destroy();
        }
        for (let i = this.currentLayoutChain.length - 1; i >= 0; i--) {
            this.currentLayoutChain[i].__ctrl__.destroy();
        }
        this.blockManager.clearAllOutlets();
        this.blockManager.destroy();
        this.sectionManager.destroy();
        this.currentPageView = null;
        this.currentLayoutView = null;
        this.currentLayoutChain = [];
        this.currentLayoutPath = null;
        this.currentViewType = null;
        this.viewStack = [];
    }
    /**
     * Apply an atomic context update received from a JSON response before the
     * Router retries navigation with the newly materialized route table.
     */
    applyViewContext(state) {
        var _a;
        const revision = typeof state?.revision === 'string' ? state.revision : null;
        if (!revision || revision === this.contextRevision)
            return false;
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
            const appConfigs = (_a = window).APP_CONFIGS ?? (_a.APP_CONFIGS = {});
            appConfigs.view ?? (appConfigs.view = {});
            appConfigs.view.revision = revision;
            appConfigs.view.contextViews = this.contextViews;
            appConfigs.view.systemData = { ...this.systemData };
        }
        return true;
    }
    getContextRevision() {
        return this.contextRevision;
    }
    extractAsyncData(response) {
        const payload = response?.data ?? {};
        if (payload && typeof payload === 'object'
            && Object.prototype.hasOwnProperty.call(payload, 'data')
            && (Object.prototype.hasOwnProperty.call(payload, 'viewContext')
                || Object.prototype.hasOwnProperty.call(payload, 'view'))) {
            return payload.data ?? {};
        }
        return payload;
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
        const navigationGeneration = ++this.navigationGeneration;
        const targetUrl = route?.$uri ?? route?.$urlPath ?? name;
        // Tách __SSR_VIEW_ID__ khỏi data TRƯỚC khi tạo view — đây là key nội bộ
        // hydration, không phải view data. Tạo factory với viewData PHẲNG đã sạch
        // → ctrl.data không lẫn __SSR_VIEW_ID__, và (data flat) factory đọc đúng.
        const { __SSR_VIEW_ID__: ssrViewId, ...viewData } = data;
        const view = await this.view(name, viewData, false);
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
        const renderResult = await this.renderPageView(view, viewData, this.rootElement, InitModes.HYDRATE, false, 0, navigationGeneration);
        if (renderResult.type === 'cancelled') {
            view.__ctrl__.destroy();
            return null;
        }
        if (renderResult.type === 'error') {
            view.__ctrl__.destroy();
            this.showError(renderResult.message);
            return null;
        }
        // Lưới cuối như mountView — hydrate claim lỗi không được làm chết cả app.
        try {
            this.activateRenderedChain(renderResult, InitModes.HYDRATE);
        }
        catch (err) {
            logger.error(`Error hydrating view "${name}":`, err);
            this.showError(`Error hydrating view "${name}".`, err instanceof Error ? err.message : err);
            return null;
        }
        return renderResult;
    }
    // ─── Getters ────────────────────────────────────────────────
    getCurrentLayout() {
        return this.currentLayoutView;
    }
    getCurrentView() {
        return this.currentPageView;
    }
    /** Layout chain đang mount, ngoài → trong (devtools/debug). */
    getLayoutChain() {
        return [...this.currentLayoutChain];
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