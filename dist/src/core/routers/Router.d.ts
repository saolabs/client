/**
 * Router — SPA Router cho OneView v3.
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
    /** @deprecated Use component */
    view?: string;
    /** Named route identifier */
    name?: string;
    /** Route metadata (auth, roles, etc.) */
    meta?: Record<string, any>;
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
    readonly $params: Record<string, string>;
    readonly $query: Record<string, string>;
    readonly $fragment: string;
    constructor(route: Route, urlPath: string, params?: Record<string, string>, query?: Record<string, string>, fragment?: string);
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
    /** Bound handlers for cleanup */
    private _handlePopState;
    private _handleAutoNavigation;
    constructor(app?: any);
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
     * Add multiple routes at once.
     */
    addRoutes(routes: RouteDefinition[]): this;
    /**
     * Configure router from a config object.
     */
    configure(config: RouterConfig): this;
    beforeEach(guard: NavigationGuard): this;
    afterEach(hook: AfterNavigationHook): this;
    /**
     * Navigate to a URL path.
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
    /**
     * Full destroy — cleanup everything.
     */
    destroy(): void;
    getFullUrl(): string;
    /**
     * Core route handler — match route, run guards, mount view.
     */
    private handleRoute;
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