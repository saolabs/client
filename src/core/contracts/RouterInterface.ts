import type { ViewManagerInterface } from "./ViewManagerInterface";

// ─── Router Interface ────────────────────────────────────────────

export type RouterNavigationType = 'push' | 'pop';
export type RouterMode = 'history' | 'hash';

export interface RouteInterface {
    name: string;
    path: string;
    query?: Record<string, any>;
    params?: Record<string, any>;
    [key: string]: any;
}

export interface ActiveRouteInterface {
    route: RouteInterface;
    $query: Record<string, any>;
    $params: Record<string, any>;
    $urlPath: string;
    $fragment: string;
    new(route: RouteInterface, urlPath: string, fragment: string): ActiveRouteInterface;
    setQuery(query: Record<string, any>): void;
    getParam(key: string, defaultValue?: any): any;
    getQuery(key: string, defaultValue?: any): any;
    getParams(): Record<string, any>;
    query(name: string): any;
    param(name: string): any;
    [key: string]: any;
}

export interface RouterInterface {
    /** Set DI container */
    setApp(app: any): this;
    /** Set ViewManager for view mounting */
    setViewManager(vm: ViewManagerInterface): this;
    /** Router mode: history or hash */
    setMode(mode: RouterMode): this;
    /** Add a route */
    addRoute(path: string, component: string, options?: any): this;
    /** Add multiple routes */
    addRoutes(routes: any[]): this;
    /** Navigate to a path */
    navigate(path: string): void;
    /** Navigate to a named route */
    navigateTo(routeName: string, params?: Record<string, any>): void;
    /** Replace current route */
    replace(path: string): void;
    /** Generate URL for a named route */
    getURL(name: string, params?: Record<string, any>): string | null;
    /** Get current route */
    getCurrentRoute(): ActiveRouteInterface | null;
    /** Navigation guards */
    beforeEach(guard: (to: ActiveRouteInterface, from: ActiveRouteInterface, urlPath: string) => boolean | Promise<boolean>): this;
    afterEach(hook: (to: ActiveRouteInterface, from: ActiveRouteInterface) => void): this;
    /** Start listening to URL changes */
    start(skipInitial?: boolean): void;
    /** Stop listening */
    stop(): void;
    /** Full destroy */
    destroy(): void;

    getFullUrl(): string;
}

