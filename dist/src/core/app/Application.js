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
import { OOTEnum } from '../types/utils';
// ─── Application ────────────────────────────────────────────────
export class Application {
    constructor() {
        this.oneType = OOTEnum.APPLICATION;
        /** Factory bindings — mỗi lần make() gọi factory tạo instance mới */
        this.bindings = new Map();
        /** Singleton instances — tạo một lần, reuse */
        this.singletons = new Map();
        /** Aliases — tên tắt trỏ về key gốc */
        this.aliases = new Map();
        /** Service providers đã đăng ký */
        this.providers = [];
        /** Đã boot chưa */
        this.booted = false;
        this.ownProperties = [
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
        this.__store = new Map(); // Store cho dynamic properties nếu cần
    }
    // ─── Transient (factory — instance mới mỗi lần) ───────────
    /**
     * Đăng ký transient service.
     * Mỗi lần make() trả về instance mới (không cache).
     *
     * @example
     * app.transient('request', (app) => new Request(app.make('config')));
     * app.transient(Database, Database); // class shorthand
     */
    transient(key, value) {
        this.bindings.set(key, (app) => {
            if (typeof value === 'function' && value.prototype) {
                return new value();
            }
            return value(app);
        });
        return this;
    }
    bind(key, value) {
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
    singleton(key, value) {
        // singleton(MyClass) — không có value, key là class
        if (value === undefined) {
            if (typeof key === 'function') {
                this.singletons.set(key, new key());
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
                const isClass = typeof value === 'function' && value.prototype;
                const instance = isClass
                    ? new value()
                    : value(app);
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
    instance(key, value) {
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
    alias(alias, key) {
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
    make(key, defaultValue) {
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
    resolve(key, defaultValue) {
        // 1. Resolve alias
        let resolved = key;
        if ((typeof key === 'string' || typeof key === 'symbol') && this.aliases.has(key)) {
            resolved = this.aliases.get(key);
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
                const inst = new resolved();
                this.singletons.set(resolved, inst);
                return inst;
            }
            return resolved(this);
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
    has(key) {
        const aliased = (typeof key === 'string' || typeof key === 'symbol') && this.aliases.has(key);
        return this.bindings.has(key) || this.singletons.has(key) || aliased
            || (typeof key === 'string' && this.__store.has(key));
    }
    /** Alias cho has() */
    bound(key) {
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
    register(provider) {
        this.providers.push(provider);
        if (typeof provider.initApplication === 'function') {
            provider.initApplication();
        }
        provider.register();
        return this;
    }
    /**
     * Boot tất cả providers.
     * Gọi boot() của mỗi provider theo thứ tự đăng ký.
     * Chỉ chạy một lần.
     */
    boot() {
        if (this.booted)
            return;
        for (const provider of this.providers) {
            if (typeof provider.boot === 'function') {
                provider.boot();
            }
        }
        this.booted = true;
    }
    /** Đã boot chưa */
    get isBooted() {
        return this.booted;
    }
    // ─── Cleanup ────────────────────────────────────────────────
    /** Xóa toàn bộ bindings, singletons, aliases, __store. Reset container. */
    flush() {
        this.bindings.clear();
        this.singletons.clear();
        this.aliases.clear();
        this.__store.clear();
        this.providers = [];
        this.booted = false;
    }
    /** Destroy app — flush + cleanup */
    destroy() {
        this.flush();
    }
    // ─── Introspection (debug) ──────────────────────────────────
    getBindings() {
        return this.bindings;
    }
    getSingletons() {
        return this.singletons;
    }
    set(name, value, isOne = false) {
        if (this.ownProperties.includes(name)) {
            return; // Không cho ghi đè lên thuộc tính có sẵn
        }
        if (this.__store.has(name) && this.__store.get(name)?.isOverridable === false) {
            return; // Không cho ghi đè lên thuộc tính không thể override
        }
        this.__store.set(name, { value, isOverridable: !isOne });
        this.singletons.set(name, value); // Sync → DI container
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
    get(name) {
        if (this.ownProperties.includes(name)) {
            return this[name]; // Trả về thuộc tính có sẵn
        }
        // Check __store first (registered via set())
        if (this.__store.has(name)) {
            return this.__store.get(name)?.value;
        }
        // Fall back to DI container (registered via singleton/instance/bind)
        if (this.singletons.has(name) || this.bindings.has(name) || this.aliases.has(name)) {
            return this.resolve(name);
        }
        return undefined;
    }
    setMethod(name, method, isOne = false) {
        if (this.ownProperties.includes(name)) {
            return; // Không cho ghi đè lên thuộc tính có sẵn
        }
        if (this.__store.has(name) && this.__store.get(name)?.isOverridable === false) {
            return; // Không cho ghi đè lên thuộc tính không thể override
        }
        this.__store.set(name, { value: method, isOverridable: !isOne });
        this[name] = (...args) => {
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
}
//# sourceMappingURL=Application.js.map