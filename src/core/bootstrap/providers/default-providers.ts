import { ApplicationInterface } from "../../contracts/ApplicationInterface";
import { app } from "../../helpers/app";
import { NamedServiceProvider, PROVIDER_NAMES } from "./provider-order";
import { ApiServiceProvider } from "./ApiServiceProvider";
import { CoreServiceProvider } from "./CoreServiceProvider";
import { HelperServiceProvider } from "./HelperServiceProvider";
import { RouteServiceProvider } from "./RouteServiceProvider";
import { ServiceProvider } from "./ServiceProvider";
import { ViewServiceProvider } from "./ViewServiceProvider";
import { ServiceProviderInterface } from "../../contracts/ServiceProviderInterface";
import { OOTEnum } from "../../types/utils";

/** Provider class type — constructor nhận optional app */
type ProviderClass = new (app?: ApplicationInterface) => ServiceProvider;

/** Tên system providers — không cho phép override */
const SYSTEM_PROVIDER_NAMES = new Set(Object.values(PROVIDER_NAMES));

/** Tên system services — không cho phép ghi đè qua config.services */
const SYSTEM_SERVICE_KEYS = new Set(['Marker', 'Store', 'Storage', 'Event', 'Http', 'View', 'Router', 'Helper', 'API']);

/**
 * Chuyển `config.services` dạng { name: Class } thành NamedServiceProvider[].
 *
 * @example
 * services: { Auth: AuthService, Toast: ToastService }
 * → 2 providers, mỗi cái dependsOn ['core'], register = app.set(name, new Class(app))
 */
function servicesFromMap(map: Record<string, any>): ServiceProviderInterface[] {
    const appInstance = app<ApplicationInterface>();
    return Object.entries(map)
        .filter(([name]) => {
            if (SYSTEM_SERVICE_KEYS.has(name)) {
                console.warn(`[Bootstrap] Cannot override system service "${name}" via config.services. Ignored.`);
                return false;
            }
            return true;
        })
        .map(([name, value]) => ({
            name,
            dependsOn: [PROVIDER_NAMES.CORE],
            register() {
                // Bundle nạp rời (theme) hay gửi INSTANCE hoặc object thuần chứ
                // không phải class — `new` vô điều kiện sẽ ném "is not a
                // constructor". Chỉ dựng khi thật sự là class.
                const isClass = typeof value === 'function' && value.prototype;
                appInstance.set(name, isClass ? new value(appInstance) : value);
            }
        }));
}

/**
 * `config.helpers` = { tên: fn } → MỘT provider gộp, phụ thuộc `helper`.
 *
 * Không gán tay sau `init()`: `App.Helper` chỉ tồn tại sau khi
 * HelperServiceProvider register, nên phải để resolveProviderOrder xếp chỗ.
 * Gán tay thì provider nào đọc helper trong boot() của mình sẽ nhận undefined.
 */
function helpersFromMap(map: Record<string, any>): ServiceProviderInterface[] {
    const appInstance = app<ApplicationInterface>();
    if (!map || Object.keys(map).length === 0) return [];

    return [{
        name: 'bundle.helpers',
        dependsOn: [PROVIDER_NAMES.HELPER],
        register() {
            const helper = appInstance.get<Record<string, any>>('Helper');
            if (!helper) {
                console.warn('[Bootstrap] Helper chưa sẵn sàng, bỏ qua config.helpers.');
                return;
            }
            Object.assign(helper, map);
        }
    }];
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
export function buildDefaultProviders(config: Record<string, any> = {}): NamedServiceProvider[] {
    // Set static config cho default providers trước khi tạo instance
    ViewServiceProvider.config = config.view || {};
    RouteServiceProvider.config = config.router || {};
    ApiServiceProvider.config = config.api || {};
    const App = app<ApplicationInterface>();
    const defaults: NamedServiceProvider[] = [
        CoreServiceProvider,
        ViewServiceProvider,
        RouteServiceProvider,
        HelperServiceProvider,
        ApiServiceProvider,
    ].map(Cls => new Cls(App));

    // config.services: { Name: Class } → auto-wrap providers
    const serviceProviders = config.services
        ? servicesFromMap(config.services)
        : [];

    // config.helpers: { tên: fn } → một provider phụ thuộc `helper`
    const helperProviders = config.helpers
        ? helpersFromMap(config.helpers)
        : [];

    // config.providers: (ProviderClass | NamedServiceProvider)[] → instantiate classes
    const customProviders: NamedServiceProvider[] = Array.isArray(config.providers)
        ? config.providers
            .map((p: ProviderClass | NamedServiceProvider) =>
                typeof p === 'function' ? new p(App) : p
            )
            .filter(p => {
                if (SYSTEM_PROVIDER_NAMES.has(p.name as any)) {
                    console.warn(`[Bootstrap] Cannot override system provider "${p.name}". Ignored.`);
                    return false;
                }
                return true;
            })
        : [];

    return [...defaults, ...serviceProviders, ...helperProviders, ...customProviders];
}
