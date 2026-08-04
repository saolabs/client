/**
 * Router — SPA Router cho SaoView v3.
 *
 * Port từ core/Router nhưng nhẹ hơn (~400 dòng thay vì 960),
 * tích hợp trực tiếp với ViewManager mới.
 *
 * Features:
 *   - History API / Hash mode
 *   - Laravel-style route patterns: {param}, {param?}
 *   - Navigation guards (beforeEach, afterEach)
 *   - Named routes + URL generation
 *   - Auto navigation (link interception)
 *   - Route caching (pattern match + ActiveRoute)
 *   - Browser back/forward handling
 */
import type { ViewManagerInterface } from "../contracts/ViewManagerInterface";
export interface RouteDefinition {
    /** URL pattern: '/users/{id}', '/posts/{page?}' */
    path: string;
    /** View name: 'web.home', 'layouts.main' */
    component?: string;
    /** Worker-stable alias retained by the server route registry. */
    logicalComponent?: string;
    /** @deprecated Use component */
    view?: string;
    /** Named route identifier */
    name?: string;
    /** Route metadata (auth, roles, etc.) */
    meta?: Record<string, any>;
    /**
     * Route con — path nối vào path cha, `meta` kế thừa từ cha (con ghi đè khi
     * trùng key). Chỉ là tầng CẤU HÌNH: bảng route vẫn phẳng sau khi flatten.
     *
     * Việc giữ nguyên view cha khi chuyển giữa các con là do chuỗi layout lo
     * (`@extends` + `@useBlock`) — view con khai báo cha bằng `@extends`, và
     * `ViewManager` tái dùng đúng instance layout đang active thay vì render
     * lại. Xem docs/GAPS_AND_ROADMAP.md §2.17.
     */
    children?: RouteDefinition[];
}
export interface Route {
    path: string;
    component?: string;
    /** @deprecated */
    view?: string;
    name?: string;
    params?: Record<string, string>;
    query?: Record<string, string>;
    meta?: Record<string, any>;
}
export interface RouteMatch {
    route: Route;
    params: Record<string, string>;
}
export interface RouterConfig {
    mode?: 'history' | 'hash';
    base?: string;
    defaultRoute?: string;
    routes?: RouteDefinition[];
    allRoutes?: RouteDefinition[];
    beforeEach?: NavigationGuard;
    afterEach?: AfterNavigationHook;
}
export type NavigationGuard = (to: Route, from: ActiveRoute | null, urlPath: string) => boolean | Promise<boolean>;
export type AfterNavigationHook = (to: Route, from: ActiveRoute | null) => void;
export declare class ActiveRoute {
    readonly $route: Route;
    readonly $urlPath: string;
    /** Request URI = path + query string (KHÔNG gồm hash) — dùng làm cache key */
    readonly $uri: string;
    readonly $params: Record<string, string>;
    readonly $query: Record<string, string>;
    readonly $fragment: string;
    constructor(route: Route, urlPath: string, params?: Record<string, string>, query?: Record<string, string>, fragment?: string, uri?: string);
    setQuery(query: Record<string, string>): void;
    getPath(): string;
    getParams(): Record<string, string>;
    getParam(name: string): string | null;
    getQuery(): Record<string, string>;
    param(name: string): string | null;
    query(name: string): string | null;
}
export declare class Router {
    /** Global active route (static access) */
    static activeRoute: ActiveRoute | null;
    /** ViewManager integration */
    private viewManager;
    /** App reference */
    private App;
    /** Route table */
    private routes;
    /** Named routes config */
    private routeConfigs;
    /** Current active route (instance) */
    private currentRoute;
    /** Router mode */
    private mode;
    /** Base path prefix */
    private base;
    /** Default route (fallback) */
    private defaultRoute;
    /** Current URI for duplicate detection */
    private currentUri;
    /** Navigation guards */
    private _beforeEach;
    private _afterEach;
    /** Caches */
    private routeCache;
    /** State */
    private isStarted;
    private isNavigating;
    private navigationSequence;
    private activeNavigationUrl;
    /** Bound handlers for cleanup */
    private _handlePopState;
    private _handleAutoNavigation;
    private _handleViewContextChange;
    constructor(app?: any);
    /**
     * init — nạp config và wire các dependency.
     * Gọi bởi RouteServiceProvider.boot() sau khi tất cả providers đã boot.
     *
     * Thực hiện:
     *   1. configure() — load routes, mode, guards từ config
     *   2. Wire ViewManager — lấy từ App.View nếu chưa set thủ công
     */
    init(config: RouterConfig): this;
    setApp(app: any): this;
    setViewManager(vm: ViewManagerInterface): this;
    setMode(mode: 'history' | 'hash'): this;
    setBase(base: string): this;
    setDefaultRoute(route: string): this;
    /**
     * Add a single route.
     */
    addRoute(path: string, component: string, options?: any): this;
    /**
     * Add named route config.
     */
    addRouteConfig(config: RouteDefinition): this;
    /**
     * Nối path con vào path cha. Con bắt đầu bằng '/' là ĐƯỜNG TUYỆT ĐỐI —
     * bỏ qua prefix cha (lối thoát cho route lệch khỏi cây, như Vue Router).
     * Con rỗng ('') = index route, trùng đúng path cha.
     */
    private static joinRoutePath;
    /**
     * Trải cây route thành bảng phẳng — bảng phẳng là thứ `matchRoute()` duyệt,
     * và nó khớp THEO THỨ TỰ (first match wins), nên thứ tự emit ở đây chính là
     * độ ưu tiên: giữ nguyên thứ tự khai báo để `/users/profile` đứng trước
     * `/users/{id}` đúng như người viết mong đợi.
     *
     * Cha có `children` mà KHÔNG có `component` = nhóm thuần tuý (gom prefix +
     * meta dùng chung), không sinh route nào cho chính nó.
     *
     * Index child (`path: ''`) sinh ra đúng path của cha → khi đó bỏ route
     * riêng của cha, vì khai báo con là chỉ định cụ thể hơn cho URL đó.
     */
    private flattenRouteTree;
    /**
     * Add multiple routes at once. Chấp nhận cây lồng qua `children` — mọi
     * đường vào (`configure`, `replaceRoutes`) đều đi qua đây nên chỉ cần
     * flatten một chỗ.
     */
    addRoutes(routes: RouteDefinition[]): this;
    /** Atomically replace the materialized route table for a new context revision. */
    replaceRoutes(routes: RouteDefinition[]): this;
    /**
     * Configure router from a config object.
     */
    configure(config: RouterConfig): this;
    beforeEach(guard: NavigationGuard): this;
    afterEach(hook: AfterNavigationHook): this;
    /**
     * Navigate to a URL path.
     * History chỉ được cập nhật SAU khi guard cho phép (trong handleRoute) —
     * guard chặn thì URL không đổi, tránh desync URL ↔ view.
     */
    navigate(path: string): void;
    /** Alias for navigate */
    push(path: string): void;
    /**
     * Navigate to a named route with params.
     */
    navigateTo(routeName: string, params?: Record<string, any>): void;
    /**
     * Replace current history entry without adding to stack.
     */
    replace(path: string): void;
    /**
     * Go back in history.
     */
    back(): void;
    /**
     * Go forward in history.
     */
    forward(): void;
    /**
     * Generate URL for a named route.
     */
    getURL(name: string, params?: Record<string, any>): string | null;
    /**
     * Generate URL with parameters (Laravel route() style).
     *
     * - Required params {name}: must be provided
     * - Optional params {name?}: removed from URL if not provided
     * - Extra params: appended as query string
     *
     * @example
     * generateUrl('/cate/{slug}', { slug: 'demo', page: 2 })
     * // → '/cate/demo?page=2'
     */
    generateUrl(pattern: string, params?: Record<string, any>): string;
    /**
     * Match a path against registered routes.
     */
    match(path: string): RouteMatch | null;
    getCurrentRoute(): ActiveRoute | null;
    /**
     * Start the router — attach event listeners and handle initial route.
     */
    start(skipInitial?: boolean): void;
    /**
     * Stop the router — remove event listeners.
     */
    stop(): void;
    private handleViewContextChange;
    /**
     * Full destroy — cleanup everything.
     */
    destroy(): void;
    getFullUrl(): string;
    /** Kiểu navigation nội bộ — quyết định thao tác history + nav type xuống ViewManager */
    private pendingNavigation;
    /**
     * Tách một URL string thành pathname / query string / fragment.
     * PHẢI tách query + hash TRƯỚC khi match route — pattern chỉ match pathname.
     */
    private splitLocation;
    /**
     * Điểm vào duy nhất cho mọi navigation (navigate/replace/popstate/initial).
     * Đang navigate dở → ghi nhận request MỚI NHẤT, xử lý sau khi xong
     * (không drop im lặng như trước).
     */
    private requestNavigation;
    /**
     * Core route handler — prepare/guard/render trước, chỉ commit history +
     * active route sau khi ViewManager đã mount/hydrate thành công.
     */
    private handleRoute;
    /** Pop đã đổi address bar; render fail thì đưa URL về chain còn active. */
    private restoreUrlAfterFailedPop;
    private applyScroll;
    /** Live region dùng lại giữa các lần điều hướng — tạo lười, chỉ 1 node. */
    private liveRegion;
    /**
     * A11y sau khi điều hướng xong (SPA không tự làm được như full page load):
     *   1. Đưa focus về container view — không làm thì bàn phím vẫn ở link cũ
     *      của trang TRƯỚC, Tab tiếp tục từ vị trí không còn tồn tại.
     *   2. Đọc tên trang mới qua live region — screen reader không hề biết
     *      nội dung đã đổi vì document không reload.
     *
     * `preventScroll` để không phá `applyScroll()` vừa chạy. Bỏ qua `initial`:
     * lần paint đầu/hydrate không được cướp focus khỏi thứ user đang thao tác.
     */
    private announceNavigation;
    /**
     * Handle browser back/forward.
     */
    private handlePopState;
    /**
     * Auto-navigation: intercept clicks on <a>, [data-nav-link], [data-navigate].
     */
    private handleAutoNavigation;
    private matchRoute;
    /**
     * Extract params from a Laravel-style route pattern.
     * Supports: {param}, {param?}, * (wildcard)
     */
    private extractParams;
    private normalizePath;
    private parseQuery;
    private setActiveRouteForPath;
    static getActiveRoute(): ActiveRoute | null;
    static getCurrentPath(): string;
    static getCurrentQuery(): Record<string, string>;
    static getCurrentHash(): string;
}
export declare function useRoute(): ActiveRoute | null;
export declare function useParams(): Record<string, string>;
export declare function useQuery(): Record<string, string>;
export default Router;
//# sourceMappingURL=Router.d.ts.map