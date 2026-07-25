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
 * viewId của layout chain được đọc từ APP_CONFIGS.view.ssrData khi server có
 * cung cấp; DOM marker chỉ là fallback tương thích cho output cũ.
 * Trả null nếu không phải trang server-rendered → CSR boot bình thường.
 */
export declare function readSSRBoot(): SSRBootInfo | null;
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
export declare function readBootConfig(): Record<string, any> | null;
/**
 * Merge nông 2 tầng config boot (base) với config app truyền (override).
 * Per top-level key (view/router/api): nếu cả hai là object thì merge nông,
 * ngược lại override thắng. Dùng để config app truyền có ưu tiên hơn boot.
 */
export declare function mergeBootConfig(base: Record<string, any>, override: Record<string, any>): Record<string, any>;
//# sourceMappingURL=ssr.d.ts.map