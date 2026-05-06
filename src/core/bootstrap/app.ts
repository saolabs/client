import { ApplicationInterface } from "../contracts/ApplicationInterface";
import { app } from "../helpers/app";
import { Router } from "../routers";
import { buildDefaultProviders, resolveProviderOrder } from "./providers";

const App: ApplicationInterface = app<ApplicationInterface>();

// ⚠️ Flags PHẢI dùng isOne=false để có thể cập nhật sau init/start
App.set<boolean>('isInitialized', false);
App.set<boolean>('isStarted', false);

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
App.setMethod('init', function (config: Record<string, any> = {}) {
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
 * @example
 * App.start(); // init với config mặc định
 * App.start({ view: { container: '#app' } }); // init với config tùy chỉnh
 */
App.setMethod('start', function (config?: Record<string, any>) {
    if (App.isStarted) {
        console.warn('[Bootstrap] App already started.');
        return;
    }
    if (!App.isInitialized) {
        App.init(config || {});
    }

    App.get<Router>('Router').start();
    App.isStarted = true;
}, true);

export default App;