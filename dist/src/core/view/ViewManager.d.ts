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
import { PageCacheService } from "../services/PageCache";
import { StoreService } from "../services/StoreService";
import { InitMode } from "../contracts/common";
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
    /** Mounted layouts ordered outermost → innermost. */
    private currentLayoutChain;
    private currentPageView;
    private currentViewType;
    /**
     * SSR boot info — view entry (page) + viewId server đã render. Set ở init()
     * từ config.ssr (đọc từ DOM lúc boot). Router consume 1 lần cho route đầu
     * tiên → hydrateView; các route sau là CSR (SPA takeover).
     */
    private ssrBoot;
    /** Exact Page/Layout instance relationships exported by Blade for hydration. */
    private ssrViewData;
    /** Current layout view info — reused if same layout */
    private currentLayout;
    private cachedLayouts;
    /** All views in the current mount chain (outermost → innermost) */
    private viewStack;
    /** Whether the manager has been initialized */
    private _isInitialized;
    /** Render counter for debugging */
    private renderCount;
    /** Invalidates fire-and-forget render work when a newer navigation begins. */
    private navigationGeneration;
    store: StoreService;
    blockManager: BlockManagerService;
    constructor(app?: ApplicationInterface);
    /**
     * Kiểm tra một view có đang mount (active) không.
     * Dùng để guard duplicate mount hoặc kiểm tra trạng thái từ bên ngoài.
     */
    isViewMounted(path: string): boolean;
    /** Invalidate async render/fetch work owned by the current navigation. */
    cancelNavigation(): void;
    /**
     * Destroy ViewManager hoàn toàn — dọn sạch mọi view, DOM, state.
     * Gọi khi teardown app (hot reload, test cleanup, unmount root).
     */
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
        ssr?: SSRBootInfo | null;
        systemData?: Record<string, any>;
        ssrData?: Record<string, any>;
    }): void;
    showError(message: string, details?: any): void;
    hasView(name: string): boolean;
    exists(name: string): boolean;
    /**
     * generateViewId — tạo unique ID cho mỗi view instance.
     *
     * Compiled output gọi:
     *   const __VIEW_ID__ = __data__.__SSR_VIEW_ID__ || App.View.generateViewId();
     *
     * Dùng trong constructor của compiled View class để gán viewId
     * (tránh hai instance cùng view path dùng chung ID gây clobber registry).
     */
    generateViewId(): string;
    view(name: string, data: Record<string, any>, cache: boolean): any;
    private createRenderPageViewError;
    private createRenderPageViewCancelled;
    private isNavigationCurrent;
    private createRenderPageViewSuccess;
    private getRenderResultType;
    callViewRenderFactory(view: ViewInterface, method?: 'render' | 'prerender', data?: Record<string, any>, mountRoot?: HtmlInterface | null, initMode?: InitMode, cache?: boolean, renderLevel?: number, navigationGeneration?: number): Promise<RenderPageViewResult>;
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
    private discoverChainViewId;
    renderPageView(view: ViewInterface, data: Record<string, any>, mountRoot?: HtmlInterface | null, initMode?: InitMode, cache?: boolean, renderLevel?: number, navigationGeneration?: number): Promise<RenderPageViewResult>;
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
    mountView(name: string, data?: Record<string, any>, route?: ActiveRouteInterface, navigationType?: RouterNavigationType): Promise<any>;
    /** Commit the successfully mounted/hydrated chain as the only active route state. */
    private commitActiveChain;
    /**
     * Common post-render transaction. Rendering decides the Page/Layout chain;
     * this step applies the DOM strategy, activates it, then publishes one
     * coherent active-chain state.
     */
    private activateRenderedChain;
    /** CSR strategy: insert new DOM, while preserving/reusing a compatible Layout. */
    private activateCreatedChain;
    /** Hydration strategy: claim Blade DOM without insert/clear mutations. */
    private activateHydratedChain;
    /**
     * Destroy layout cũ (đổi layout hoặc về standalone).
     * Page cũ đã rời ở Phase 1 (deactivatePage) — không destroy tại đây.
     */
    private destroyLayoutView;
    private destroyLayoutChain;
    /** bfcache-style cache cho trang đã ghé (ROUTE_RENDER_FLOW.md §8) */
    pageCache: PageCacheService;
    /**
     * Cache key = `${viewName}::${requestUri}` — URI gồm path + query,
     * KHÔNG gồm hash (strip defensive tại đây).
     */
    private cacheKey;
    /** Cache key cho layout — namespace riêng, không đụng key page (name::uri) */
    private layoutCacheKey;
    private layoutChainIdentity;
    /**
     * Rời một layout (đổi layout / về standalone): pause + detach toàn vùng DOM
     * → PageCache (key `__layout__::{path}`). KHÁC destroy ở 2 điểm:
     *   1. Instance GIỮ NGUYÊN trong store — extendView của page sau trả lại
     *      đúng instance này (đang paused) → resumeLayoutFromCache nhận ra.
     *   2. Outlets gỡ khỏi BlockManager registry (không destroy) — tránh
     *      mountAll đụng outlet trùng tên của layout đang nằm trong cache.
     * Layout khai cache:false (hoặc ttl 0) → destroy như cũ.
     */
    private deactivateLayout;
    private deactivateLayoutChain;
    /**
     * Layout lấy từ store đang PAUSED (đã vào cache trước đó) → reattach
     * fragment + resume thay vì mount lại. Trả false nếu layout không paused
     * (layout mới tạo → caller mount bình thường).
     */
    private resumeLayoutChainFromCache;
    /** Đăng ký lại outlets của layout vừa resume vào BlockManager registry */
    private reregisterLayoutOutlets;
    /**
     * Navigate rời một page: pause + detach DOM → PageCache.
     *   - Standalone: detach toàn vùng wrapper (markers + content).
     *   - Page thuộc layout: detach block content THEO OUTLET — layout giữ nguyên,
     *     không hook nào fire trên layout.
     * View khai cache:false (hoặc ttl 0) → destroy luôn.
     */
    private deactivatePage;
    /** Roll back an early Layout-page detach when prepare/render did not commit. */
    private restoreDeactivatedPage;
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
    private restoreFromCache;
    unmountAll(): void;
    unmountView(path: string): void;
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
    hydrateView(name: string, data: Record<string, any> & {
        __SSR_VIEW_ID__: string;
    }, route?: ActiveRouteInterface): Promise<any>;
    getCurrentLayout(): ViewInterface | null;
    getCurrentView(): ViewInterface | null;
    /** Còn SSR boot chưa consume? (route đầu tiên nên hydrate thay vì mount) */
    hasSSRBoot(): boolean;
    /**
     * Lấy viewId SSR cho một view name nếu nó là entry server đã render, rồi
     * CONSUME (xoá) — đảm bảo chỉ route ĐẦU TIÊN hydrate; navigate sau là CSR.
     * Trả null nếu không có SSR boot hoặc view không khớp entry.
     */
    consumeSSRViewId(viewName: string): string | null;
    getViewStack(): ViewInterface[];
    isInitialized(): boolean;
}
export {};
//# sourceMappingURL=ViewManager.d.ts.map