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

// ─── Types ──────────────────────────────────────────────────────

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

// ─── ActiveRoute ────────────────────────────────────────────────

export class ActiveRoute {
    public readonly $route: Route;
    public readonly $urlPath: string;
    public readonly $params: Record<string, string>;
    public readonly $query: Record<string, string>;
    public readonly $fragment: string;

    constructor(
        route: Route,
        urlPath: string,
        params: Record<string, string> = {},
        query: Record<string, string> = {},
        fragment: string = ''
    ) {
        this.$route = route;
        this.$urlPath = urlPath;
        this.$params = params;
        this.$query = query;
        this.$fragment = fragment;

        // Dynamic param access: activeRoute.id → activeRoute.$params.id
        for (const key of Object.keys(params)) {
            Object.defineProperty(this, key, {
                get: () => this.$params[key],
                enumerable: true,
                configurable: false,
            });
        }
        for (const key of Object.keys(query)) {
            if (!(key in this)) {
                Object.defineProperty(this, key, {
                    get: () => this.$query[key],
                    enumerable: true,
                    configurable: true,
                });
            }
        }
    }

    setQuery(query: Record<string, string>): void {
        if (typeof query !== 'object' || query === null) return;
        for (const key in query) {
            this.$query[key] = query[key];
            if (!(key in this)) {
                Object.defineProperty(this, key, {
                    get: () => this.$query[key],
                    enumerable: true,
                    configurable: true,
                });
            }
        }
    }

    getPath(): string { return this.$urlPath; }
    getParams(): Record<string, string> { return this.$params; }
    getParam(name: string): string | null { return this.$params[name] ?? null; }
    getQuery(): Record<string, string> { return this.$query; }
    param(name: string): string | null { return this.$params[name] ?? null; }
    query(name: string): string | null { return this.$query[name] ?? null; }
}

// ─── Router ─────────────────────────────────────────────────────

export class Router {
    /** Global active route (static access) */
    public static activeRoute: ActiveRoute | null = null;

    /** ViewManager integration */
    private viewManager: ViewManagerInterface | null = null;

    /** App reference */
    private App: any = null;

    /** Route table */
    private routes: Array<{ path: string; component: string; options: any }> = [];

    /** Named routes config */
    private routeConfigs: Record<string, RouteDefinition> = {};

    /** Current active route (instance) */
    private currentRoute: ActiveRoute | null = null;

    /** Router mode */
    private mode: 'history' | 'hash' = 'history';

    /** Base path prefix */
    private base: string = '';

    /** Default route (fallback) */
    private defaultRoute: string = '/';

    /** Current URI for duplicate detection */
    private currentUri: string = '';

    /** Navigation guards */
    private _beforeEach: NavigationGuard | null = null;
    private _afterEach: AfterNavigationHook | null = null;

    /** Caches */
    private routeCache: Map<string, RouteMatch | null> = new Map();

    /** State */
    private isStarted = false;
    private isNavigating = false;

    /** Bound handlers for cleanup */
    private _handlePopState: () => void;
    private _handleAutoNavigation: (e: MouseEvent) => void;

    constructor(app?: any) {
        this.App = app || null;
        this.currentUri = typeof window !== 'undefined'
            ? window.location.pathname + window.location.search
            : '/';

        this._handlePopState = this.handlePopState.bind(this);
        this._handleAutoNavigation = this.handleAutoNavigation.bind(this);
    }

    // ─── Configuration ──────────────────────────────────────────

    init(config: RouterConfig): this {

        return this;
    }

    setApp(app: any): this {
        this.App = app;
        return this;
    }

    setViewManager(vm: ViewManagerInterface): this {
        this.viewManager = vm;
        return this;
    }

    setMode(mode: 'history' | 'hash'): this {
        this.mode = mode;
        return this;
    }

    setBase(base: string): this {
        this.base = base;
        return this;
    }

    setDefaultRoute(route: string): this {
        this.defaultRoute = route;
        return this;
    }

    // ─── Route Registration ─────────────────────────────────────

    /**
     * Add a single route.
     */
    addRoute(path: string, component: string, options: any = {}): this {
        this.routes.push({ path, component, options });
        this.routeCache.clear();
        return this;
    }

    /**
     * Add named route config.
     */
    addRouteConfig(config: RouteDefinition): this {
        if (config.name) {
            this.routeConfigs[config.name] = config;
        }
        return this;
    }

    /**
     * Add multiple routes at once.
     */
    addRoutes(routes: RouteDefinition[]): this {
        for (const route of routes) {
            const component = route.component || route.view || '';
            this.addRoute(route.path, component, route.meta || {});
            if (route.name) {
                this.addRouteConfig(route);
            }
        }
        return this;
    }

    /**
     * Configure router from a config object.
     */
    configure(config: RouterConfig): this {
        if (config.mode) this.mode = config.mode;
        if (config.base) this.base = config.base;
        if (config.defaultRoute) this.defaultRoute = config.defaultRoute;
        if (config.routes) this.addRoutes(config.routes);
        if (config.allRoutes) this.addRoutes(config.allRoutes);
        if (config.beforeEach) this._beforeEach = config.beforeEach;
        if (config.afterEach) this._afterEach = config.afterEach;
        return this;
    }

    // ─── Guards ─────────────────────────────────────────────────

    beforeEach(guard: NavigationGuard): this {
        this._beforeEach = guard;
        return this;
    }

    afterEach(hook: AfterNavigationHook): this {
        this._afterEach = hook;
        return this;
    }

    // ─── Navigation ─────────────────────────────────────────────

    /**
     * Navigate to a URL path.
     */
    navigate(path: string): void {
        if (this.mode === 'history') {
            window.history.pushState({}, '', path);
        } else {
            window.location.hash = path;
        }
        this.handleRoute(path);
        this.currentUri = path;
    }

    /** Alias for navigate */
    push(path: string): void {
        this.navigate(path);
    }

    /**
     * Navigate to a named route with params.
     */
    navigateTo(routeName: string, params: Record<string, any> = {}): void {
        const url = this.getURL(routeName, params);
        if (url) {
            this.navigate(url);
        } else {
            console.error(`[Router] Named route "${routeName}" not found`);
        }
    }

    /**
     * Replace current history entry without adding to stack.
     */
    replace(path: string): void {
        if (this.mode === 'history') {
            window.history.replaceState({}, '', path);
        } else {
            window.location.hash = path;
        }
        this.handleRoute(path);
        this.currentUri = path;
    }

    /**
     * Go back in history.
     */
    back(): void {
        window.history.back();
    }

    /**
     * Go forward in history.
     */
    forward(): void {
        window.history.forward();
    }

    // ─── URL Generation ─────────────────────────────────────────

    /**
     * Generate URL for a named route.
     */
    getURL(name: string, params: Record<string, any> = {}): string | null {
        const config = this.routeConfigs[name];
        if (!config) return null;

        let url = this.generateUrl(config.path, params);
        if (!(url.startsWith('/') || url.startsWith('http'))) {
            url = this.base + url;
        }
        return url;
    }

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
    generateUrl(pattern: string, params: Record<string, any> = {}): string {
        let url = pattern;
        const usedKeys = new Set<string>();

        // Required params: {name}
        const requiredParams = [...pattern.matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
            .filter(m => !m[0].endsWith('?}'))
            .map(m => m[1]);

        // Optional params: {name?}
        const optionalParams = [...pattern.matchAll(/\{([a-zA-Z0-9_]+)\?\}/g)]
            .map(m => m[1]);

        for (const name of requiredParams) {
            if (params[name] == null) {
                console.error(`[Router] Missing required param: ${name} in ${pattern}`);
                return url;
            }
            url = url.replace(`{${name}}`, encodeURIComponent(String(params[name])));
            usedKeys.add(name);
        }

        for (const name of optionalParams) {
            if (params[name] != null && params[name] !== '') {
                url = url.replace(`{${name}?}`, encodeURIComponent(String(params[name])));
                usedKeys.add(name);
            } else {
                url = url.replace(`/{${name}?}`, '');
                url = url.replace(`{${name}?}`, '');
            }
        }

        url = this.normalizePath(url);

        // Extra params → query string
        const queryParts: string[] = [];
        for (const [key, value] of Object.entries(params)) {
            if (!usedKeys.has(key) && value != null) {
                queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
            }
        }
        if (queryParts.length > 0) {
            url += '?' + queryParts.join('&');
        }

        return url;
    }

    // ─── Route Matching ─────────────────────────────────────────

    /**
     * Match a path against registered routes.
     */
    match(path: string): RouteMatch | null {
        return this.matchRoute(path);
    }

    getCurrentRoute(): ActiveRoute | null {
        return this.currentRoute;
    }

    // ─── Lifecycle ──────────────────────────────────────────────

    /**
     * Start the router — attach event listeners and handle initial route.
     */
    start(skipInitial: boolean = false): void {
        if (this.isStarted) {
            console.warn('[Router] Already started');
            return;
        }

        const initialPath = this.mode === 'history'
            ? (window.location.pathname + window.location.search)
            : (window.location.hash.substring(1) || this.defaultRoute);

        // Set initial active route (without mounting view)
        this.setActiveRouteForPath(initialPath);

        // Attach listeners
        if (this.mode === 'history') {
            window.addEventListener('popstate', this._handlePopState);
        } else {
            window.addEventListener('hashchange', this._handlePopState);
        }
        document.addEventListener('click', this._handleAutoNavigation);

        // Handle initial route
        if (!skipInitial) {
            this.handleRoute(initialPath);
        }

        this.isStarted = true;
    }

    /**
     * Stop the router — remove event listeners.
     */
    stop(): void {
        window.removeEventListener('popstate', this._handlePopState);
        window.removeEventListener('hashchange', this._handlePopState);
        document.removeEventListener('click', this._handleAutoNavigation);
        this.isStarted = false;
    }

    /**
     * Full destroy — cleanup everything.
     */
    destroy(): void {
        this.stop();
        this.routes = [];
        this.routeConfigs = {};
        this.routeCache.clear();
        this._beforeEach = null;
        this._afterEach = null;
        this.currentRoute = null;
        Router.activeRoute = null;
    }

    // ─── Helper ────────────────────────────────
    getFullUrl(): string {
        if (typeof window === 'undefined') return '';
        return window.location.href;
    }
    // ─── Internal: Route Handling ────────────────────────────────

    /**
     * Core route handler — match route, run guards, mount view.
     */
    private async handleRoute(path: string): Promise<void> {
        if (this.isNavigating) return;
        this.isNavigating = true;

        try {
            const normalizedPath = this.normalizePath(path);
            const query = this.parseQuery(window.location.search);
            const fragment = window.location.hash.substring(1);

            const match = this.matchRoute(normalizedPath);
            if (!match) {
                console.warn(`[Router] No route matched: ${path}`);
                return;
            }

            const { route, params } = match;
            const from = this.currentRoute;

            // Create ActiveRoute
            const activeRoute = new ActiveRoute(route, normalizedPath, params, query, fragment);

            // Before guard
            if (this._beforeEach) {
                const allow = await this._beforeEach(route, from, normalizedPath);
                if (allow === false) return;
            }

            // Update global state
            Router.activeRoute = activeRoute;
            this.currentRoute = activeRoute;

            // Mount view via ViewManager
            const viewComponent = route.component || route.view;
            if (viewComponent) {
                if (this.viewManager) {
                    await this.viewManager.mountView(viewComponent, params, activeRoute);
                } else if (this.App?.View) {
                    // Fallback: App.View is the ViewManager (registered on app)
                    await this.App.View.mountView(viewComponent, params, activeRoute);
                }
            }

            // After hook
            if (this._afterEach) {
                this._afterEach({ ...route, path: normalizedPath }, from);
            }
        } catch (error) {
            console.error('[Router] Navigation error:', error);
        } finally {
            this.isNavigating = false;
        }
    }

    /**
     * Handle browser back/forward.
     */
    private handlePopState(): void {
        const path = this.mode === 'history'
            ? window.location.pathname + window.location.search
            : window.location.hash.slice(1) || this.defaultRoute;
        this.handleRoute(path);
    }

    /**
     * Auto-navigation: intercept clicks on <a>, [data-nav-link], [data-navigate].
     */
    private handleAutoNavigation(e: MouseEvent): void {
        const target = e.target as HTMLElement;

        // 1. [data-nav-link] — highest priority
        const navLinkEl = target.closest('[data-nav-link]') as HTMLElement;
        if (navLinkEl) {
            if (navLinkEl.hasAttribute('data-nav-disabled')) return;
            const navPath = navLinkEl.getAttribute('data-nav-link');
            if (navPath && navPath.trim() !== '' && navPath !== this.currentUri) {
                e.preventDefault();
                this.navigate(navPath);
                return;
            }
        }

        // 2. [data-navigate]
        const navigateEl = target.closest('[data-navigate]') as HTMLElement;
        if (navigateEl) {
            if (navigateEl.hasAttribute('data-nav-disabled')) return;
            const navPath = navigateEl.getAttribute('data-navigate');
            if (navPath && navPath.trim() !== '' && navPath !== this.currentUri) {
                e.preventDefault();
                this.navigate(navPath);
                return;
            }
        }

        // 3. Standard <a> tags
        const link = target.closest('a[href]') as HTMLAnchorElement;
        if (!link) return;

        // Skip: target="_blank", disabled, special protocols
        if (link.target === '_blank') return;
        if (link.dataset.nav === 'disabled' || link.dataset.nav === 'false') return;
        const href = link.href;
        if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;

        // Check if same-origin
        try {
            const linkUrl = new URL(href);
            const currentUrl = new URL(window.location.href);
            if (linkUrl.host !== currentUrl.host) return; // External

            const path = linkUrl.pathname + linkUrl.search;
            if (path === this.currentUri) return; // Same page
            e.preventDefault();
            this.navigate(path);
        } catch {
            // Relative URL
            if (href && !href.startsWith('http') && !href.startsWith('//')) {
                if (href === this.currentUri) return;
                e.preventDefault();
                this.navigate(href);
            }
        }
    }

    // ─── Internal: Pattern Matching ─────────────────────────────

    private matchRoute(path: string): RouteMatch | null {
        const normalizedPath = this.normalizePath(path);

        if (this.routeCache.has(normalizedPath)) {
            return this.routeCache.get(normalizedPath)!;
        }

        for (const routeDef of this.routes) {
            const params = this.extractParams(routeDef.path, normalizedPath);
            if (params !== null) {
                const route: Route = {
                    path: routeDef.path,
                    component: routeDef.component,
                    view: routeDef.component,
                    params,
                    ...routeDef.options,
                };
                const match: RouteMatch = { route, params };
                this.routeCache.set(normalizedPath, match);
                return match;
            }
        }

        this.routeCache.set(normalizedPath, null);
        return null;
    }

    /**
     * Extract params from a Laravel-style route pattern.
     * Supports: {param}, {param?}, * (wildcard)
     */
    private extractParams(pattern: string, path: string): Record<string, string> | null {
        if (pattern.includes('*') || pattern === '{any}') {
            return { wildcard: path };
        }

        const normalizedPattern = this.normalizePath(pattern);
        const normalizedPath = this.normalizePath(path);

        const segments = normalizedPattern.split('/');
        let regexParts: string[] = [];
        const paramNames: string[] = [];

        for (const seg of segments) {
            if (!seg) continue;

            // Optional param: {name?}
            const optMatch = seg.match(/^\{([a-zA-Z0-9_]+)\?\}$/);
            if (optMatch) {
                paramNames.push(optMatch[1]);
                regexParts.push('(?:\\/([^\\/]+))?');
                continue;
            }

            // Required param: {name}
            const reqMatch = seg.match(/^\{([a-zA-Z0-9_]+)\}$/);
            if (reqMatch) {
                paramNames.push(reqMatch[1]);
                regexParts.push('\\/([^\\/]+)');
                continue;
            }

            // Static segment
            const escaped = seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regexParts.push('\\/' + escaped);
        }

        const regex = new RegExp(`^${regexParts.join('')}$`);
        const match = normalizedPath.match(regex);
        if (!match) return null;

        const params: Record<string, string> = {};
        paramNames.forEach((name, i) => {
            const value = match[i + 1];
            if (value !== undefined && value !== '') {
                params[name] = value;
            }
        });

        return params;
    }

    // ─── Internal: Helpers ──────────────────────────────────────

    private normalizePath(path: string): string {
        let normalized = path.startsWith('/') ? path : `/${path}`;
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized || '/';
    }

    private parseQuery(search: string): Record<string, string> {
        const query: Record<string, string> = {};
        const params = new URLSearchParams(search);
        params.forEach((value, key) => { query[key] = value; });
        return query;
    }

    private setActiveRouteForPath(path: string): void {
        const normalizedPath = this.normalizePath(path);
        const match = this.matchRoute(normalizedPath);
        if (match) {
            const query = this.parseQuery(window.location.search);
            const fragment = window.location.hash.substring(1);
            const activeRoute = new ActiveRoute(match.route, normalizedPath, match.params, query, fragment);
            Router.activeRoute = activeRoute;
            this.currentRoute = activeRoute;
        }
    }

    // ─── Static Helpers ─────────────────────────────────────────

    static getActiveRoute(): ActiveRoute | null {
        return Router.activeRoute;
    }

    static getCurrentPath(): string {
        return typeof window !== 'undefined' ? window.location.pathname : '/';
    }

    static getCurrentQuery(): Record<string, string> {
        if (typeof window === 'undefined') return {};
        const query: Record<string, string> = {};
        const params = new URLSearchParams(window.location.search);
        params.forEach((value, key) => { query[key] = value; });
        return query;
    }

    static getCurrentHash(): string {
        return typeof window !== 'undefined' ? window.location.hash.substring(1) : '';
    }
}

// ─── Composables ────────────────────────────────────────────────

export function useRoute(): ActiveRoute | null {
    return Router.getActiveRoute();
}

export function useParams(): Record<string, string> {
    return useRoute()?.$params || {};
}

export function useQuery(): Record<string, string> {
    return Router.getCurrentQuery();
}

export default Router;
