import { app } from "../helpers/app";
import { buildDefaultProviders, resolveProviderOrder } from "./providers";
import { readSSRBoot, readBootConfig, mergeBootConfig } from "./ssr";
const App = app();
// ⚠️ Flags PHẢI dùng isOne=false để có thể cập nhật sau init/start
App.set('isInitialized', false);
App.set('isStarted', false);
/**
 * Khởi tạo app — đăng ký + boot tất cả providers theo dependency order.
 *
 * @example
 * App.init({
 *     view: { container: '#app', registry: {...} },
 *     router: { mode: 'history', routes: [...] },
 *     api: { endpoint: '/api' },
 *     providers: [{ name: 'analytics', dependsOn: ['core'], register(app) {...} }]
 * });
 */
App.setMethod('init', function (config = {}) {
    if (App.isInitialized) {
        console.warn('[Bootstrap] App already initialized.');
        return;
    }
    const providers = resolveProviderOrder(buildDefaultProviders(config));
    for (const provider of providers) {
        App.register(provider);
    }
    App.boot();
    App.isInitialized = true;
}, true);
/**
 * Start app — init nếu chưa, rồi start Router.
 *
 * Nếu phát hiện SSR boot (script saola-ssr), inject vào config.view.ssr để
 * ViewManager + Router hydrate route đầu tiên thay vì mount mới.
 *
 * @example
 * App.start(); // init với config mặc định
 * App.start({ view: { container: '#app' } }); // init với config tùy chỉnh
 */
App.setMethod('start', function (config) {
    if (App.isStarted) {
        console.warn('[Bootstrap] App already started.');
        return;
    }
    if (!App.isInitialized) {
        // Config app truyền có ưu tiên hơn boot config (window.APP_CONFIGS:
        // routes + container từ server). Thiếu APP_CONFIGS → chỉ dùng config app.
        const boot = readBootConfig() || {};
        const cfg = mergeBootConfig(boot, config || {});
        // SSR boot (script saola-ssr) → ssr + container cho hydrate route đầu.
        const ssr = readSSRBoot();
        if (ssr) {
            cfg.view = {
                ...(cfg.view || {}),
                ssr: { view: ssr.view, viewId: ssr.viewId },
                container: (cfg.view && cfg.view.container) || ssr.container,
            };
        }
        App.init(cfg);
    }
    App.get('Router').start();
    App.isStarted = true;
}, true);
export default App;
//# sourceMappingURL=app.js.map