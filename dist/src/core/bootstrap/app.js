import { app } from "../helpers/app";
import { buildDefaultProviders, resolveProviderOrder } from "./providers";
import { readSSRBoot, readBootConfig, mergeBootConfig } from "./ssr";
import { bootBundles, loadBundles } from "./bundle";
const App = app();
// ⚠️ Flags PHẢI dùng isOne=false để có thể cập nhật sau init/start
App.set('isInitialized', false);
App.set('isStarted', false);
/**
 * Hàng đợi `App.push(fn)` — cửa cho mã KHÔNG đi qua bundler (snippet trong
 * layout, plugin bên thứ ba, thư viện nạp bất đồng bộ).
 *
 * Mẫu `dataLayer.push`: trước khi file này chạy, `window.App` là một MẢNG và
 * `.push(fn)` chỉ xếp hàng. Ở đây ta rút hàng đợi rồi thay bằng App thật, và
 * gắn `App.push` = chạy NGAY. Nhờ vậy CÙNG MỘT dòng gọi
 *
 *     (window.App = window.App || []).push(fn)
 *
 * hoạt động ở cả ba mốc: trước khi app.js tải, trong lúc parse, và sau khi app
 * đã boot. Tác giả plugin không phải biết mình chạy lúc nào.
 *
 * ⚠️ Hệ quả: `window.App` là MẢNG cho tới lúc boot. Đọc App phải đọc TRONG
 * callback, đừng đọc ở tầng module.
 */
function drainPushQueue() {
    if (typeof window === 'undefined')
        return;
    const w = window;
    const pending = Array.isArray(w.App) ? w.App : [];
    App.push = (fn) => {
        if (typeof fn !== 'function')
            return;
        try {
            fn(App);
        }
        catch (err) {
            console.error('[App.push] callback ném lỗi:', err);
        }
    };
    w.App = App;
    for (const fn of pending)
        App.push(fn);
}
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
App.setMethod('start', async function (config) {
    if (App.isStarted) {
        console.warn('[Bootstrap] App already started.');
        return;
    }
    let bundles = null;
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
        // Bundle nạp rời (theme…): server phát danh sách URL trong
        // APP_CONFIGS.bundles. Phải await TRƯỚC init để view/service/provider
        // của chúng có mặt lúc provider boot và lúc render route đầu.
        bundles = await loadBundles(cfg.bundles);
        cfg.view = {
            ...(cfg.view || {}),
            // Bundle nạp sau ĐÈ registry của app — đúng ngữ nghĩa overlay theme.
            registry: { ...(cfg.view?.registry || {}), ...bundles.views },
        };
        cfg.services = { ...(cfg.services || {}), ...bundles.services };
        cfg.helpers = { ...(cfg.helpers || {}), ...bundles.helpers };
        cfg.providers = [...(cfg.providers || []), ...bundles.providers];
        App.init(cfg);
        bootBundles(bundles, App);
    }
    // Sau init (View/Router/Helper đã có), TRƯỚC khi render: chỗ duy nhất mà
    // mã ngoài cắm vào được mà chắc chắn kịp.
    drainPushQueue();
    App.get('Router').start();
    App.isStarted = true;
}, true);
export default App;
//# sourceMappingURL=app.js.map