"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("../helpers/app");
const providers_1 = require("./providers");
const App = (0, app_1.app)();
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
    const providers = (0, providers_1.resolveProviderOrder)((0, providers_1.buildDefaultProviders)(config));
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
App.setMethod('start', function (config) {
    if (App.isStarted) {
        console.warn('[Bootstrap] App already started.');
        return;
    }
    if (!App.isInitialized) {
        App.init(config || {});
    }
    App.get('Router').start();
    App.isStarted = true;
}, true);
exports.default = App;
