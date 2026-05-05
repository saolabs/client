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
import { OneObjectType, OOTEnum } from '../types/utils';

// ─── Application ────────────────────────────────────────────────

export class Application implements ApplicationInterface {
    readonly oneType: OneObjectType = OOTEnum.APPLICATION;
    // Service properties — set during bootstrap via App.set()
    declare isInitialized: boolean;
    declare isStarted: boolean;
    declare View: ViewManagerInterface;
    declare Router: RouterInterface;
    declare Helper: HelperInterface;
    declare Events: EventServiceInterface;
    declare Http: HttpServiceInterface;
    declare API: APIClientInterface;
    declare Store: StoreServiceInterface;
    declare Storage: StorageServiceInterface;
    declare Logger: LoggerServiceInterface;

    /** Factory bindings — mỗi lần make() gọi factory tạo instance mới */
    private bindings = new Map<ServiceKey, ServiceFactory<any>>();

    /** Singleton instances — tạo một lần, reuse */
    private singletons = new Map<ServiceKey, any>();

    /** Aliases — tên tắt trỏ về key gốc */
    private aliases = new Map<string | symbol, ServiceKey>();

    /** Service providers đã đăng ký */
    private providers: ServiceProviderInterface[] = [];

    /** Đã boot chưa */
    private booted = false;

    private ownProperties: string[] = [
        'bindings',
        'singletons',
        'aliases',
        'providers',
        'booted',
        'ownProperties',
        'transient',
        'bind',
        'singleton',
        'instance',
        'alias',
        'make',
        'resolve',
        'has',
        'bound',
        'register',
        'boot',
        'isBooted',
        'flush',
        'destroy',
        'getBindings',
        'getSingletons',
        '__store',
    ]; // Để track dynamic properties nếu cần

    __store: Map<any, { isOverridable: boolean, value: any }> = new Map(); // Store cho dynamic properties nếu cần

    [key: string]: any; // Cho phép dynamic properties nếu cần

    constructor() { }

    // ─── Transient (factory — instance mới mỗi lần) ───────────

    /**
     * Đăng ký transient service.
     * Mỗi lần make() trả về instance mới (không cache).
     *
     * @example
     * app.transient('request', (app) => new Request(app.make('config')));
     * app.transient(Database, Database); // class shorthand
     */
    transient<T>(key: ServiceKey<T>, value: ServiceBinding<T>): this {
        this.bindings.set(key, (app) => {
            if (typeof value === 'function' && value.prototype) {
                return new (value as new (...args: any[]) => T)();
            }
            return (value as ServiceFactory<T>)(app);
        });
        return this;
    }

    bind<T>(key: ServiceKey<T>, value: ServiceBinding<T>): this {
        return this.transient(key, value);
    }

    // ─── Singleton (instance duy nhất) ──────────────────────────

    /**
     * Đăng ký singleton — tạo một lần, reuse mãi mãi.
     *
     * @example
     * app.singleton('store', StoreService);           // class
     * app.singleton('config', (app) => loadConfig()); // factory
     * app.singleton(StoreService);                    // class, tự tạo
     * app.singleton('store', existingInstance);        // instance sẵn
     */
    singleton<T>(key: ServiceKey<T>, value?: ServiceBinding<T> | T): this {
        // singleton(MyClass) — không có value, key là class
        if (value === undefined) {
            if (typeof key === 'function') {
                this.singletons.set(key, new (key as new (...args: any[]) => T)());
                return this;
            }
            throw new Error(`[Application] Singleton requires a value for key: ${String(key)}`);
        }

        // value là instance sẵn (object, không phải function)
        if (value !== null && typeof value === 'object') {
            this.singletons.set(key, value);
            return this;
        }

        // value là class hoặc factory — lazy init
        this.bindings.set(key, (app) => {
            if (!this.singletons.has(key)) {
                const isClass = typeof value === 'function' && (value as any).prototype;
                const instance = isClass
                    ? new (value as new (...args: any[]) => T)()
                    : (value as ServiceFactory<T>)(app);
                this.singletons.set(key, instance);
            }
            return this.singletons.get(key);
        });
        return this;
    }

    // ─── Instance (đăng ký instance sẵn) ────────────────────────

    /**
     * Đăng ký instance đã tạo sẵn.
     * Shortcut cho singleton khi đã có instance.
     *
     * @example
     * app.instance('config', { debug: true, api_url: '/api' });
     */
    instance<T>(key: ServiceKey<T>, value: T): this {
        this.singletons.set(key, value);
        return this;
    }

    // ─── Alias ──────────────────────────────────────────────────

    /**
     * Tạo tên tắt cho service.
     *
     * @example
     * app.singleton('email.service', EmailService);
     * app.alias('mailer', 'email.service');
     * app.make('mailer') === app.make('email.service') // true
     */
    alias(alias: string | symbol, key: ServiceKey): this {
        this.aliases.set(alias, key);
        return this;
    }

    // ─── Resolve ────────────────────────────────────────────────

    /**
     * Lấy service instance. Shortcut cho resolve().
     *
     * @example
     * const router = app.make<Router>('router');
     */
    make<T>(key: ServiceKey<T>, defaultValue?: T): T {
        return this.resolve(key, defaultValue);
    }

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
    resolve<T>(key: ServiceKey<T>, defaultValue?: T): T {
        // 1. Resolve alias
        let resolved: ServiceKey<T> = key;
        if ((typeof key === 'string' || typeof key === 'symbol') && this.aliases.has(key)) {
            resolved = this.aliases.get(key)! as ServiceKey<T>;
        }

        // 2. Singleton đã có
        if (this.singletons.has(resolved)) {
            return this.singletons.get(resolved);
        }

        // 3. Binding factory
        const factory = this.bindings.get(resolved);
        if (factory) {
            return factory(this);
        }

        // 4. Auto-instantiate class
        if (typeof resolved === 'function') {
            if (resolved.prototype) {
                const inst = new (resolved as new (...args: any[]) => T)();
                this.singletons.set(resolved, inst);
                return inst;
            }
            return (resolved as Function)(this);
        }

        // 5. Default value
        if (defaultValue !== undefined) {
            return defaultValue;
        }

        // 6. Not found
        throw new Error(`[Application] Cannot resolve: ${String(key)}`);
    }

    // ─── Query ──────────────────────────────────────────────────

    /** Kiểm tra service đã đăng ký chưa */
    has(key: ServiceKey): boolean {
        const aliased = (typeof key === 'string' || typeof key === 'symbol') && this.aliases.has(key);
        return this.bindings.has(key) || this.singletons.has(key) || aliased
            || (typeof key === 'string' && this.__store.has(key));
    }

    /** Alias cho has() */
    bound(key: ServiceKey): boolean {
        return this.has(key);
    }

    // ─── Service Providers ──────────────────────────────────────

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
    register(provider: ServiceProviderInterface): this {
        this.providers.push(provider);
        if (typeof (provider as any).initApplication === 'function') {
            (provider as any).initApplication();
        }
        provider.register();
        return this;
    }

    /**
     * Boot tất cả providers.
     * Gọi boot() của mỗi provider theo thứ tự đăng ký.
     * Chỉ chạy một lần.
     */
    boot(): void {
        if (this.booted) return;

        for (const provider of this.providers) {
            if (typeof provider.boot === 'function') {
                provider.boot();
            }
        }

        this.booted = true;
    }

    /** Đã boot chưa */
    get isBooted(): boolean {
        return this.booted;
    }

    // ─── Cleanup ────────────────────────────────────────────────

    /** Xóa toàn bộ bindings, singletons, aliases, __store. Reset container. */
    flush(): void {
        this.bindings.clear();
        this.singletons.clear();
        this.aliases.clear();
        this.__store.clear();
        this.providers = [];
        this.booted = false;
    }

    /** Destroy app — flush + cleanup */
    destroy(): void {
        this.flush();
    }

    // ─── Introspection (debug) ──────────────────────────────────

    getBindings(): Map<ServiceKey, ServiceFactory<any>> {
        return this.bindings;
    }

    getSingletons(): Map<ServiceKey, any> {
        return this.singletons;
    }


    set<T = any>(name: any, value: T, isOne: boolean = false): void {
        if (this.__store.has(name) && this.__store.get(name)?.isOverridable === false) {
            return; // Không cho ghi đè lên thuộc tính không thể override
        }
        const isString = typeof name === 'string';
        if (isString && this.ownProperties.includes(name)) {
            return; // Không cho ghi đè lên thuộc tính có sẵn
        }
        this.__store.set(name, { value, isOverridable: !isOne });
        this.singletons.set(name, value); // Sync → DI container
        if (isString) {
            Object.defineProperty(this, name, {
                get: () => this.__store.get(name)?.value,
                set: (newValue) => {
                    if (this.__store.has(name) && this.__store.get(name)?.isOverridable === false) {
                        return; // Không cho ghi đè nếu isOverridable là false
                    }
                    this.__store.set(name, { value: newValue, isOverridable: !isOne });
                    this.singletons.set(name, newValue); // Sync → DI container
                },
                configurable: isOne ? false : true,
                enumerable: false,
            });
        }
    }

    get<T = any>(name: any): T {
        const isString = typeof name === 'string';
        if (isString && this.ownProperties.includes(name)) {
            return (this as any)[name]; // Trả về thuộc tính có sẵn
        }
        // Check __store first (registered via set())
        if (this.__store.has(name)) {
            return this.__store.get(name)?.value;
        }
        // Fall back to DI container (registered via singleton/instance/bind)
        if (this.singletons.has(name) || this.bindings.has(name) || this.aliases.has(name)) {
            return this.resolve(name);
        }
        return undefined as T;
    }

    setMethod(name: string, method: Function, isOne: boolean = false): void {
        if (this.ownProperties.includes(name)) {
            return; // Không cho ghi đè lên thuộc tính có sẵn
        }
        if (this.__store.has(name) && this.__store.get(name)?.isOverridable === false) {
            return; // Không cho ghi đè lên thuộc tính không thể override
        }
        this.__store.set(name, { value: method, isOverridable: !isOne });
        (this as any)[name] = (...args: any[]) => {
            const fn = this.get(name);
            if (typeof fn === 'function') {
                if (typeof fn.bind === 'function') {
                    return fn.bind(this)(...args);
                }
                return fn.apply(this, args);
            }
            throw new Error(`[Application] Method ${name} is not a function`);
        };
        if (isOne) {
            Object.defineProperty(this, name, {
                configurable: false,
                writable: false,
            });
        }
    }

    // ─── Singleton App Instance ─────────────────────────────────────
}