/**
 * SSR boot detection — đọc thông tin server nhúng để hydrate route đầu tiên.
 * Tham chiếu: RUNTIME_CONTRACT.md §6 (Hydration boot).
 */

/** Thông tin boot server nhúng cho trang server-rendered. */
export interface SSRBootInfo {
    /** Registry path của page entry (vd 'web.modules.home'). */
    view: string;
    /** viewId server đã dùng prefix markers/classes của page. */
    viewId: string;
    /** CSS selector container chứa SSR HTML (mặc định '#app-root'). */
    container?: string;
}

/**
 * Đọc SSR boot info từ DOM:
 *
 *   <script type="application/json" data-ref="saola-ssr">
 *     { "container": "#app-root", "view": "web.modules.home", "viewId": "v_abc" }
 *   </script>
 *
 * viewId của layout chain KHÔNG cần ở đây — client tự discover từ DOM view marker.
 * Trả null nếu không phải trang server-rendered → CSR boot bình thường.
 */
export function readSSRBoot(): SSRBootInfo | null {
    if (typeof document === 'undefined') return null;
    const el = document.querySelector('script[type="application/json"][data-ref="saola-ssr"]');
    if (!el || !el.textContent) return null;
    try {
        const info = JSON.parse(el.textContent);
        if (info && typeof info.view === 'string' && typeof info.viewId === 'string') {
            return {
                view: info.view,
                viewId: info.viewId,
                container: typeof info.container === 'string' ? info.container : undefined,
            };
        }
    } catch (e) {
        console.warn('[Bootstrap] SSR boot JSON không hợp lệ:', e);
    }
    return null;
}

/**
 * Đọc boot config server nhúng qua `window.APP_CONFIGS` (contract server hiện tại)
 * và map về shape config của client (`{ view, router, api }`).
 *
 * Server (`_system/page/end.blade.php`) đã emit:
 *   window.APP_CONFIGS = {
 *     container: '#app-root',
 *     router: { mode, base, allRoutes: [{name,path,params,component}], ... },
 *     ...
 *   }
 * `allRoutes` đã đúng shape `Router.addRoutes` cần ({path, component}).
 *
 * Trả null nếu không có APP_CONFIGS (→ app tự truyền config cho App.start).
 */
export function readBootConfig(): Record<string, any> | null {
    if (typeof window === 'undefined') return null;
    const cfg = (window as any).APP_CONFIGS;
    if (!cfg || typeof cfg !== 'object') return null;

    const out: Record<string, any> = {};

    // view.systemData (server: __layout__/__base__/__page__/...) PHẢI tới được
    // ViewManager: compiled factory destructure `__layout__` từ systemData để
    // resolve superView (`${__layout__+"base"}`). Thiếu → 'undefinedbase' →
    // "View not found in registry" + page render() trả rỗng.
    const view: Record<string, any> = {};
    if (typeof cfg.container === 'string') {
        view.container = cfg.container;
    }
    if (cfg.view?.systemData && typeof cfg.view.systemData === 'object') {
        view.systemData = cfg.view.systemData;
    }
    if (Object.keys(view).length > 0) {
        out.view = view;
    }

    const routes = cfg.router?.allRoutes ?? cfg.router?.routes;
    if (Array.isArray(routes)) {
        out.router = {
            mode: cfg.router?.mode ?? 'history',
            base: cfg.router?.base,
            routes,
        };
    }

    return Object.keys(out).length > 0 ? out : null;
}

/**
 * Merge nông 2 tầng config boot (base) với config app truyền (override).
 * Per top-level key (view/router/api): nếu cả hai là object thì merge nông,
 * ngược lại override thắng. Dùng để config app truyền có ưu tiên hơn boot.
 */
export function mergeBootConfig(
    base: Record<string, any>,
    override: Record<string, any>
): Record<string, any> {
    const out: Record<string, any> = { ...base };
    for (const key of Object.keys(override)) {
        const b = out[key];
        const o = override[key];
        if (b && o && typeof b === 'object' && typeof o === 'object'
            && !Array.isArray(b) && !Array.isArray(o)) {
            out[key] = { ...b, ...o };
        } else {
            out[key] = o;
        }
    }
    return out;
}
