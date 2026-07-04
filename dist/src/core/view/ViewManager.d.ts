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
    /**
     * SSR boot info — view entry (page) + viewId server đã render. Set ở init()
     * từ config.ssr (đọc từ DOM lúc boot). Router consume 1 lần cho route đầu
     * tiên → hydrateView; các route sau là CSR (SPA takeover).
     */
    private ssrBoot;
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
    /**
     * Kiểm tra một view có đang mount (active) không.
     * Dùng để guard duplicate mount hoặc kiểm tra trạng thái từ bên ngoài.
     */
    isViewMounted(path: string): boolean;
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
    private createRenderPageViewSuccess;
    private getRenderResultType;
    callViewRenderFactory(view: ViewInterface, method?: 'render' | 'prerender', data?: Record<string, any>, mountRoot?: HtmlInterface | null, initMode?: InitMode, cache?: boolean, renderLevel?: number): Promise<RenderPageViewResult>;
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
    private discoverChainViewId;
    renderPageView(view: ViewInterface, data: Record<string, any>, mountRoot?: HtmlInterface | null, initMode?: InitMode, cache?: boolean, renderLevel?: number): Promise<RenderPageViewResult>;
    /**
     * Mount view khi navigate — luồng chuẩn (ROUTE_RENDER_FLOW.md):
     *   sweep TTL → duplicate guard → pause+cache trang cũ →
     *   pop? restore từ PageCache : mount mới (render → mount DOM → commitData → start)
     *
     * LƯU Ý Phase 2: mới hoàn thiện nhánh standalone (không layout).
     * Nhánh layout (extends) thuộc Phase 3.
     */
    mountView(name: string, data?: Record<string, any>, route?: ActiveRouteInterface, navigationType?: RouterNavigationType): Promise<any>;
    /** Destroy toàn bộ chain page + layout cũ (đổi layout hoặc về standalone) */
    private destroyLayoutChain;
    /** bfcache-style cache cho trang đã ghé (ROUTE_RENDER_FLOW.md §8) */
    pageCache: PageCacheService;
    /**
     * Navigate đi khỏi trang standalone: pause + detach DOM → PageCache.
     * View khai báo cache:false (hoặc ttl 0) → destroy luôn.
     */
    private deactivateStandalonePage;
    /** Back/forward hit cache: gắn lại DOM + resume — không render, không gọi API */
    private restoreFromCache;
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