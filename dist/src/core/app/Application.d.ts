/**
 * Application — DI Container + App Lifecycle.
 *
 * Tương tự Laravel Service Container:
 *   - bind / singleton / instance  → đăng ký service
 *   - make / resolve               → lấy service
 *   - alias                        → tên tắt
 *   - register / boot              → service providers
 *
 * Khác với core Application (hardcode services), bản này hoàn toàn DI-driven:
 * mọi service (Router, ViewManager, Store...) đều được đăng ký qua providers.
 *
 * @example
 * const app = new Application();
 *
 * // Đăng ký trực tiếp
 * app.singleton('markerRegistry', MarkerRegistry);
 * app.instance('config', { debug: true });
 *
 * // Đăng ký qua provider
 * app.register({
 *     register(app) { app.singleton('router', () => new Router(app)); },
 *     boot(app) { app.make('router').start(); }
 * });
 *
 * app.boot();
 * const router = app.make('router');
 */
import type { ApplicationInterface, ServiceKey, ServiceFactory, ServiceBinding } from '../contracts/ApplicationInterface';
import type { ServiceProviderInterface } from '../contracts/ServiceProviderInterface';
import type { ViewManagerInterface, RouterInterface } from '../contracts/utils';
import type { HelperInterface } from '../contracts/HelperInterface';
import type { EventServiceInterface } from '../contracts/EventServiceInterface';
import type { HttpServiceInterface } from '../contracts/HttpServiceInterface';
import type { StoreServiceInterface } from '../contracts/StoreServiceInterface';
import type { StorageServiceInterface } from '../contracts/StorageServiceInterface';
import type { LoggerServiceInterface } from '../contracts/LoggerServiceInterface';
import { APIClientInterface } from '../contracts/ApiInterface';
import { OneObjectType } from '../types/utils';
export declare class Application implements ApplicationInterface {
    readonly oneType: OneObjectType;
    isInitialized: boolean;
    isStarted: boolean;
    View: ViewManagerInterface;
    Router: RouterInterface;
    Helper: HelperInterface;
    Events: EventServiceInterface;
    Http: HttpServiceInterface;
    API: APIClientInterface;
    Store: StoreServiceInterface;
    Storage: StorageServiceInterface;
    Logger: LoggerServiceInterface;
    /** Factory bindings — mỗi lần make() gọi factory tạo instance mới */
    private bindings;
    /** Singleton instances — tạo một lần, reuse */
    private singletons;
    /** Aliases — tên tắt trỏ về key gốc */
    private aliases;
    /** Service providers đã đăng ký */
    private providers;
    /** Đã boot chưa */
    private booted;
    private ownProperties;
    __store: Map<string, {
        isOverridable: boolean;
        value: any;
    }>;
    [key: string]: any;
    constructor();
    /**
     * Đăng ký transient service.
     * Mỗi lần make() trả về instance mới (không cache).
     *
     * @example
     * app.transient('request', (app) => new Request(app.make('config')));
     * app.transient(Database, Database); // class shorthand
     */
    transient<T>(key: ServiceKey<T>, value: ServiceBinding<T>): this;
    bind<T>(key: ServiceKey<T>, value: ServiceBinding<T>): this;
    /**
     * Đăng ký singleton — tạo một lần, reuse mãi mãi.
     *
     * @example
     * app.singleton('store', StoreService);           // class
     * app.singleton('config', (app) => loadConfig()); // factory
     * app.singleton(StoreService);                    // class, tự tạo
     * app.singleton('store', existingInstance);        // instance sẵn
     */
    singleton<T>(key: ServiceKey<T>, value?: ServiceBinding<T> | T): this;
    /**
     * Đăng ký instance đã tạo sẵn.
     * Shortcut cho singleton khi đã có instance.
     *
     * @example
     * app.instance('config', { debug: true, api_url: '/api' });
     */
    instance<T>(key: ServiceKey<T>, value: T): this;
    /**
     * Tạo tên tắt cho service.
     *
     * @example
     * app.singleton('email.service', EmailService);
     * app.alias('mailer', 'email.service');
     * app.make('mailer') === app.make('email.service') // true
     */
    alias(alias: string | symbol, key: ServiceKey): this;
    /**
     * Lấy service instance. Shortcut cho resolve().
     *
     * @example
     * const router = app.make<Router>('router');
     */
    make<T>(key: ServiceKey<T>, defaultValue?: T): T;
    /**
     * Resolve service instance.
     *
     * Thứ tự tìm:
     *   1. Alias → resolve key gốc
     *   2. Singleton đã tạo → reuse
     *   3. Binding (factory) → gọi factory
     *   4. Key là class → auto-instantiate + cache
     *   5. defaultValue → trả về
     *   6. Throw error
     */
    resolve<T>(key: ServiceKey<T>, defaultValue?: T): T;
    /** Kiểm tra service đã đăng ký chưa */
    has(key: ServiceKey): boolean;
    /** Alias cho has() */
    bound(key: ServiceKey): boolean;
    /**
     * Đăng ký service provider.
     * register() được gọi ngay, boot() gọi khi app.boot().
     *
     * @example
     * app.register({
     *     register(app) { app.singleton('db', Database); },
     *     boot(app) { app.make('db').connect(); }
     * });
     */
    register(provider: ServiceProviderInterface): this;
    /**
     * Boot tất cả providers.
     * Gọi boot() của mỗi provider theo thứ tự đăng ký.
     * Chỉ chạy một lần.
     */
    boot(): void;
    /** Đã boot chưa */
    get isBooted(): boolean;
    /** Xóa toàn bộ bindings, singletons, aliases, __store. Reset container. */
    flush(): void;
    /** Destroy app — flush + cleanup */
    destroy(): void;
    getBindings(): Map<ServiceKey, ServiceFactory<any>>;
    getSingletons(): Map<ServiceKey, any>;
    set<T = any>(name: string, value: T, isOne?: boolean): void;
    get<T = any>(name: string): T;
    setMethod(name: string, method: Function, isOne?: boolean): void;
}
//# sourceMappingURL=Application.d.ts.map