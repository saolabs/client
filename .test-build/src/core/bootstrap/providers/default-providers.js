"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDefaultProviders = buildDefaultProviders;
const app_1 = require("../../helpers/app");
const provider_order_1 = require("./provider-order");
const ApiServiceProvider_1 = require("./ApiServiceProvider");
const CoreServiceProvider_1 = require("./CoreServiceProvider");
const HelperServiceProvider_1 = require("./HelperServiceProvider");
const RouteServiceProvider_1 = require("./RouteServiceProvider");
const ViewServiceProvider_1 = require("./ViewServiceProvider");
/** Tên system providers — không cho phép override */
const SYSTEM_PROVIDER_NAMES = new Set(Object.values(provider_order_1.PROVIDER_NAMES));
/** Tên system services — không cho phép ghi đè qua config.services */
const SYSTEM_SERVICE_KEYS = new Set(['Marker', 'Store', 'Storage', 'Event', 'Http', 'View', 'Router', 'Helper', 'API']);
/**
 * Chuyển `config.services` dạng { name: Class } thành NamedServiceProvider[].
 *
 * @example
 * services: { Auth: AuthService, Toast: ToastService }
 * → 2 providers, mỗi cái dependsOn ['core'], register = app.set(name, new Class(app))
 */
function servicesFromMap(map) {
    const appInstance = (0, app_1.app)();
    return Object.entries(map)
        .filter(([name]) => {
        if (SYSTEM_SERVICE_KEYS.has(name)) {
            console.warn(`[Bootstrap] Cannot override system service "${name}" via config.services. Ignored.`);
            return false;
        }
        return true;
    })
        .map(([name, ServiceClass]) => ({
        name,
        dependsOn: [provider_order_1.PROVIDER_NAMES.CORE],
        register() {
            appInstance.set(name, new ServiceClass(appInstance));
        }
    }));
}
/**
 * Tạo danh sách providers mặc định.
 *
 * Hỗ trợ:
 * - Config cho service mặc định: `config.view`, `config.router`, `config.api`
 * - Liệt kê provider class: `config.providers = [AuthServiceProvider, NotificationProvider]`
 * - Liệt kê provider instance: `config.providers = [new AuthServiceProvider()]`
 * - Đăng ký service đơn giản: `config.services = { Auth: AuthService, Toast: ToastService }`
 *
 * System providers (core, view, router, helper, api) luôn chạy trước và không thể bị ghi đè.
 */
function buildDefaultProviders(config = {}) {
    // Set static config cho default providers trước khi tạo instance
    ViewServiceProvider_1.ViewServiceProvider.config = config.view || {};
    RouteServiceProvider_1.RouteServiceProvider.config = config.router || {};
    ApiServiceProvider_1.ApiServiceProvider.config = config.api || {};
    const App = (0, app_1.app)();
    const defaults = [
        CoreServiceProvider_1.CoreServiceProvider,
        ViewServiceProvider_1.ViewServiceProvider,
        RouteServiceProvider_1.RouteServiceProvider,
        HelperServiceProvider_1.HelperServiceProvider,
        ApiServiceProvider_1.ApiServiceProvider,
    ].map(Cls => new Cls(App));
    // config.services: { Name: Class } → auto-wrap providers
    const serviceProviders = config.services
        ? servicesFromMap(config.services)
        : [];
    // config.providers: (ProviderClass | NamedServiceProvider)[] → instantiate classes
    const customProviders = Array.isArray(config.providers)
        ? config.providers
            .map((p) => typeof p === 'function' ? new p(App) : p)
            .filter(p => {
            if (SYSTEM_PROVIDER_NAMES.has(p.name)) {
                console.warn(`[Bootstrap] Cannot override system provider "${p.name}". Ignored.`);
                return false;
            }
            return true;
        })
        : [];
    return [...defaults, ...serviceProviders, ...customProviders];
}
