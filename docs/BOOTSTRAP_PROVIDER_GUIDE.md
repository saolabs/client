# Bootstrap & Service Provider Guide — SaoView v1.1

Hệ thống khởi tạo ứng dụng SaoView: DI container + dependency-aware provider pattern (giống Laravel).

---

## Mục lục

1. [File map](#1-file-map)
2. [Luồng khởi tạo hoàn chỉnh](#2-luồng-khởi-tạo-hoàn-chỉnh)
3. [Chi tiết nội bộ](#3-chi-tiết-nội-bộ)
4. [ServiceProvider base class](#4-serviceprovider-base-class)
5. [Default providers](#5-default-providers)
6. [Tất cả cách thêm logic vào App](#6-tất-cả-cách-thêm-logic-vào-app)
7. [Chọn cách nào?](#7-chọn-cách-nào)
8. [PROVIDER_NAMES & System protection](#8-provider_names-constants)
9. [Quy tắc thiết kế provider](#9-quy-tắc-thiết-kế-provider)
10. [Lỗi thường gặp](#10-lỗi-thường-gặp)

---

## 1. File map

```
src/one/
├── app/
│   └── Application.ts              ← DI Container (set/get/singleton/make/register/boot)
├── hellpers/
│   └── app.ts                      ← app() factory → singleton Application
├── contracts/
│   ├── ApplicationInterface.ts     ← App interface & DI types
│   └── ServiceProviderInterface.ts ← ServiceProvider interface
├── bootstrap/
│   ├── app.ts                      ← Entry: App.init() + App.start()
│   └── providers/
│       ├── index.ts                ← Barrel export (tất cả public API)
│       ├── ServiceProvider.ts      ← Abstract base class (giống Laravel)
│       ├── provider-order.ts       ← resolveProviderOrder() + PROVIDER_NAMES
│       ├── default-providers.ts    ← buildDefaultProviders(config)
│       ├── CoreServiceProvider.ts  ← Marker, Store, Storage, Event, Http
│       ├── ViewServiceProvider.ts  ← ViewManager
│       ├── RouteServiceProvider.ts ← Router
│       ├── HelperServiceProvider.ts← HelperService
│       └── ApiServiceProvider.ts   ← ApiClient
├── services/
│   ├── EventService.ts             ← Singleton via .instance()
│   ├── StoreService.ts             ← Singleton via .instance()
│   ├── HttpService.ts              ← Singleton via .instance()
│   ├── HelperService.ts
│   └── MarkerService.ts
├── view/
│   └── ViewManager.ts              ← init({ container, registry })
├── routers/
│   └── Router.ts                   ← init(config) + start()
└── hellpers/
    └── ApiClient.ts                ← init(config)

index.ts                            ← Public: App, app, Application
```

---

## 2. Luồng khởi tạo hoàn chỉnh

```
import { App } from 'saoview'
       │
       │  ① Module load
       ▼
  bootstrap/app.ts
  ├─ App = app()          → singleton Application
  ├─ set('isInitialized', false)
  ├─ set('isStarted', false)
  ├─ setMethod('init', ...)
  └─ setMethod('start', ...)
       │
       │  ② User gọi App.start(config) hoặc App.init(config)
       ▼
  App.init(config)
       │
       │  ③ Build providers
       ▼
  buildDefaultProviders(config)
  ├─ Set static config: ViewServiceProvider.config, RouteServiceProvider.config, ApiServiceProvider.config
  ├─ [CoreServiceProvider, ViewServiceProvider, RouteServiceProvider, HelperServiceProvider, ApiServiceProvider]
  │  .map(Cls => new Cls())           ← tạo instance từ class
  ├─ + servicesFromMap(config.services)    ← auto-wrap { Name: Class }
  │   └─ ⛔ SYSTEM_SERVICE_KEYS (Marker, Store, Storage, Event, Http, View, Router, Helper, API) bị chặn
  ├─ + config.providers                    ← class hoặc instance
  │   └─ ⛔ SYSTEM_PROVIDER_NAMES (core, view, router, helper, api) bị chặn
  └─ System providers KHÔNG THỂ bị override — chỉ thêm custom providers mới
       │
       │  ④ Resolve dependency order
       ▼
  resolveProviderOrder(allProviders)
  ├─ Validate duplicate name
  ├─ DFS topological sort theo dependsOn
  ├─ Validate missing dependency
  └─ Validate circular dependency
       │  → [core, view, router, api, helper, ...custom]
       │
       │  ⑤ Register phase (tuần tự)
       ▼
  for each provider:
    App.register(provider)    ← gọi provider.register()
    ├─ core:   → set Marker, Store, Storage, Event, Http
    ├─ view:   → set ViewManager
    ├─ router: → set Router
    ├─ api:    → set ApiClient
    └─ helper: → set HelperService
       │
       │  ⑦ Boot phase (tuần tự, 1 lần duy nhất)
       ▼
  App.boot()
  for each provider:
    provider.boot()
    ├─ view:   → ViewManager.init(ViewServiceProvider.config)
    ├─ router: → Router.init(RouteServiceProvider.config)
    └─ api:    → ApiClient.init(ApiServiceProvider.config)
       │
       │  ⑦ Đánh dấu
       ▼
  App.isInitialized = true
       │
       │  ⑧ Start (nếu gọi App.start)
       ▼
  Router.start()
  ├─ Lắng nghe popstate / hashchange
  ├─ Resolve route hiện tại
  └─ ViewManager.mountView(name) → render view đầu tiên
       │
  App.isStarted = true
```

---

## 3. Application API Reference

### 3.1 Lấy Application instance

```ts
// src/one/hellpers/app.ts — singleton duy nhất
import { app } from 'saoview';

app()              // → Application instance
app('View')        // → app.make('View')   — resolve service
app('key', value)  // → app.instance(...)  — đăng ký instance
app.has('View')    // → kiểm tra đã đăng ký chưa
app.flush()        // → reset container
```

> `app()` và `App` (trong bootstrap) đều trỏ về cùng 1 Application instance.

---

### 3.2 Đăng ký service (Registration)

#### `set(name, value, isOne?)`

Đăng ký dynamic property — tạo getter/setter trên instance + sync vào DI container.

```ts
// isOne=false (mặc định) → có thể ghi đè
App.set('isInitialized', false);
App.isInitialized = true;        // ✅ OK

// isOne=true → locked, không ghi đè được
App.set<Router>('Router', router, true);
App.Router = otherRouter;        // ⛔ bị bỏ qua (isOverridable === false)
```

**Providers dùng set()** để đăng ký services (View, Router, API...).  
Sau `set()`, service có thể truy cập qua **cả 3 cách**: `App.View`, `App.get('View')`, `App.make('View')`.

#### `singleton(key, value?)`

Đăng ký singleton — tạo 1 lần, reuse mãi.

```ts
app.singleton('cache', CacheService);              // class → lazy init
app.singleton('config', (app) => loadConfig());    // factory → lazy init
app.singleton('store', existingStoreInstance);      // instance sẵn → lưu ngay
app.singleton(CacheService);                       // class là key, tự tạo instance
```

#### `instance(key, value)`

Đăng ký instance đã tạo sẵn (shortcut cho singleton khi đã có object).

```ts
app.instance('config', { debug: true, api_url: '/api' });
app.instance('MarkerRegistry', new MarkerRegistryService());
```

#### `bind(key, factory)` / `transient(key, factory)`

Đăng ký factory — mỗi lần `make()` tạo instance **mới** (không cache).

```ts
app.bind('request', (app) => new Request(app.make('config')));
// Mỗi lần gọi app.make('request') → instance mới
```

#### `alias(alias, key)`

Tạo tên tắt trỏ về service gốc.

```ts
app.singleton('email.service', EmailService);
app.alias('mailer', 'email.service');
app.make('mailer') === app.make('email.service')  // true
```

#### `setMethod(name, fn, isOne?)`

Đăng ký dynamic method trên Application instance. Hàm được bind context `this = app`.

```ts
App.setMethod('init', function (config) {
    // this === App
    this.set('isInitialized', true);
}, true);  // isOne=true → không thể override

App.init({ view: { container: '#app' } });
```

---

### 3.3 Truy xuất service (Resolution)

#### `get(name)` — tìm theo tên (string)

```ts
App.get<Router>('Router')       // từ __store (set bởi provider)
App.get<any>('config')          // fallback → DI container (singleton/instance)
```

Thứ tự tìm:
1. `__store` (đăng ký qua `set()`)
2. `singletons` / `bindings` / `aliases` (đăng ký qua `singleton()` / `instance()` / `bind()`)
3. Không tìm thấy → `undefined`

#### `make(key)` / `resolve(key, defaultValue?)`

```ts
app.make<Router>('Router')                    // resolve service
app.resolve<Router>('Router', fallbackRouter) // có default value
```

Thứ tự tìm:
1. Alias → resolve key gốc
2. Singleton đã tạo → reuse
3. Binding factory → gọi factory
4. Key là class → auto-instantiate + cache
5. `defaultValue` → trả về
6. Throw `[Application] Cannot resolve: ...`

#### Dot-access — `App.View`, `App.Router`

Services đăng ký qua `set()` tạo getter/setter → truy cập trực tiếp như property:

```ts
App.View                    // ✅ ViewManager instance
App.Router.start()          // ✅ gọi method
App.isInitialized           // ✅ boolean flag
```

> **Tương đương**: `App.View` === `App.get('View')` === `App.make('View')`

---

### 3.4 Unified Storage — `set/get` ↔ `singleton/make`

Hai cơ chế lưu trữ đã được **hợp nhất** — đăng ký ở đâu, truy xuất ở đâu cũng được:

```
┌──────────────────────────────────────────────────┐
│                   Application                     │
│                                                   │
│  set('View', vm)  ──→  __store['View'] = vm       │
│                    ──→  singletons['View'] = vm    │  ← sync
│                    ──→  Object.defineProperty       │  ← App.View
│                                                   │
│  instance('x', v) ──→  singletons['x'] = v        │
│                                                   │
│  get('View')      ──→  __store → singletons        │  ← fallback
│  make('View')     ──→  singletons → bindings       │
│  App.View         ──→  __store (getter)             │
│                                                   │
│  has('View')      ──→  check cả __store + DI       │
│  flush()          ──→  clear cả __store + DI       │
└──────────────────────────────────────────────────┘
```

| Đăng ký bằng | `App.X` | `get('X')` | `make('X')` | `has('X')` |
|:--|:--:|:--:|:--:|:--:|
| `set('X', v)` | ✅ | ✅ | ✅ | ✅ |
| `instance('X', v)` | ❌ | ✅ | ✅ | ✅ |
| `singleton('X', F)` | ❌ | ✅ | ✅ | ✅ |
| `bind('X', F)` | ❌ | ✅ | ✅ | ✅ |

> `set()` là cách duy nhất tạo dot-access (`App.X`). Providers nên dùng `set()` cho core services.

---

### 3.5 Kiểm tra & Lifecycle

```ts
app.has('View')        // true nếu đã đăng ký (bất kỳ cách nào)
app.bound('View')      // alias cho has()
App.isBooted           // true sau khi boot() chạy xong
```

#### `register(provider)` — đăng ký provider (gọi register ngay)

```ts
app.register({
    register() { app().set('DB', new Database()); },
    boot()     { app().get('DB').connect(); }
});
// provider.register() được gọi NGAY khi register()
// provider.boot() được gọi khi app.boot()
```

#### `boot()` — boot tất cả providers (1 lần)

```ts
app.boot();  // Gọi boot() tuần tự cho mỗi provider, chỉ chạy 1 lần
```

#### `flush()` / `destroy()` — reset container

```ts
app.flush();    // Xóa: bindings + singletons + aliases + __store + providers
app.destroy();  // Giống flush()
```

---

### 3.6 Debug & Introspection

```ts
app.getBindings()     // Map<ServiceKey, Factory> — xem factory bindings
app.getSingletons()   // Map<ServiceKey, any>     — xem singleton instances
```

---

### 3.7 Bảng tóm tắt toàn bộ API

| Method | Mục đích | Category |
|:--|:--|:--|
| `set(name, value, isOne?)` | Đăng ký property + sync DI | Registration |
| `setMethod(name, fn, isOne?)` | Đăng ký dynamic method | Registration |
| `singleton(key, value?)` | Đăng ký singleton (lazy/eager) | Registration |
| `instance(key, value)` | Đăng ký instance sẵn | Registration |
| `bind(key, factory)` | Đăng ký transient factory | Registration |
| `alias(alias, key)` | Tạo tên tắt | Registration |
| `get(name)` | Lấy service (string key) | Resolution |
| `make(key)` | Resolve service | Resolution |
| `resolve(key, default?)` | Resolve + fallback | Resolution |
| `App.X` | Dot-access (qua set) | Resolution |
| `has(key)` / `bound(key)` | Kiểm tra đã đăng ký | Query |
| `isBooted` | Trạng thái boot | Query |
| `register(provider)` | Đăng ký provider | Lifecycle |
| `boot()` | Boot providers | Lifecycle |
| `flush()` / `destroy()` | Reset container | Lifecycle |
| `getBindings()` | Xem bindings | Debug |
| `getSingletons()` | Xem singletons | Debug |

---

## 4. ServiceProvider base class

API giống Laravel — dùng `this.app`, override trực tiếp `register()` / `boot()`:

```ts
// src/one/bootstrap/providers/ServiceProvider.ts
abstract class ServiceProvider implements NamedServiceProvider {
    abstract readonly name: string;
    readonly dependsOn?: string[];
    protected app: ApplicationInterface;

    constructor(app?: ApplicationInterface) {
        this.app = app ?? app();  // nhận từ param hoặc lấy qua helper app()
    }

    register(): void {}  // ← override
    boot(): void {}      // ← override
}
```

### So sánh với Laravel

```php
// Laravel PHP
class AuthServiceProvider extends ServiceProvider {
    public function register() {
        $this->app->bind('auth', fn() => new AuthManager());
    }
    public function boot() {
        $this->app->make('auth')->loadUser();
    }
}
```

```ts
// SaoView TypeScript
class AuthServiceProvider extends ServiceProvider {
    readonly name = 'auth';
    readonly dependsOn = ['core', 'api'];

    register() {
        this.app.set('Auth', new AuthManager(this.app));
    }

    boot() {
        this.app.get<AuthManager>('Auth').loadUser();
    }
}
```

| Laravel | SaoView |
|:--|:--|
| `extends ServiceProvider` | `extends ServiceProvider` |
| `$this->app` | `this.app` |
| `register()` | `register()` |
| `boot()` | `boot()` |
| `config/app.php` | `config.providers` |
| Thứ tự load tự động | `dependsOn` + topo-sort |

---

## 5. Default providers

```
core ─────────────────┬──────── api
  │                   │
  ▼                   │
 view ────────┐       │
  │           │       │
  ▼           │       │
router ───────┼───────┘
  │           │
  ▼           ▼
       helper
```

| Provider | Class | dependsOn | register() | boot() |
|:--|:--|:--|:--|:--|
| `core` | `CoreServiceProvider` | — | Marker, Store, Storage, Event, Http | — |
| `view` | `ViewServiceProvider` | core | ViewManager | ViewManager.init() |
| `router` | `RouteServiceProvider` | view | Router | Router.init() |
| `api` | `ApiServiceProvider` | core | ApiClient | ApiClient.init() |
| `helper` | `HelperServiceProvider` | core, router, view | HelperService | — |

Resolve order: **core → view → router → api → helper**

---

## 6. Tất cả cách thêm logic vào App

### Cách 1 — `services: { Name: Class }` (đơn giản nhất)

Auto-wrap thành provider, `dependsOn: ['core']`, `new Class(app)`.

```ts
App.start({
    view: { container: '#app', registry },
    services: {
        Auth: AuthService,
        Toast: ToastService,
    }
});

// Sử dụng:
app<AuthService>('Auth').login(credentials);
```

### Cách 2 — `providers: [inline object]`

Full control khi cần boot logic hoặc custom dependencies.

```ts
App.start({
    providers: [{
        name: 'auth',
        dependsOn: ['core', 'api'],
        register() {
            app().set('Auth', new AuthService(app()));
        },
        boot() {
            app().get('Auth').restoreSession();
        }
    }]
});
```

### Cách 3 — `extends ServiceProvider` (giống Laravel, reusable)

```ts
// providers/AuthServiceProvider.ts
import { ServiceProvider, PROVIDER_NAMES } from 'saoview';

export class AuthServiceProvider extends ServiceProvider {
    readonly name = 'auth';
    readonly dependsOn = [PROVIDER_NAMES.CORE, PROVIDER_NAMES.API];

    register() {
        this.app.set('Auth', new AuthService(this.app));
    }

    boot() {
        this.app.get('Auth').restoreSession();
    }
}

// app.ts — liệt kê class thay vì instance
App.start({
    providers: [AuthServiceProvider]
});
```

### Cách 4 — ⛔ System providers KHÔNG THỂ override

> **Kể từ phiên bản hiện tại**, system providers (`core`, `view`, `router`, `helper`, `api`) và system services (`Marker`, `Store`, `Storage`, `Event`, `Http`, `View`, `Router`, `Helper`, `API`) **không thể bị ghi đè** qua `config.providers` hoặc `config.services`.

Nếu cố gắng override, sẽ nhận warning và bị bỏ qua:

```ts
// ⛔ Không hoạt động — bị chặn bởi SYSTEM_PROVIDER_NAMES
class CustomApiProvider extends ServiceProvider {
    readonly name = PROVIDER_NAMES.API;    // cùng tên system → bị chặn
    readonly dependsOn = [PROVIDER_NAMES.CORE];
    register() { /* ... */ }
}

App.start({
    providers: [CustomApiProvider]
});
// Console: [Bootstrap] Cannot override system provider "api". Ignored.
```

```ts
// ⛔ Không hoạt động — bị chặn bởi SYSTEM_SERVICE_KEYS
App.start({
    services: { View: CustomViewService }
});
// Console: [Bootstrap] Cannot override system service "View" via config.services. Ignored.
```

**Thay vào đó**, dùng tên khác và wrap logic bổ sung:

```ts
// ✅ Đúng cách: tạo provider với tên riêng, bọc thêm logic
class EnhancedApiProvider extends ServiceProvider {
    readonly name = 'enhanced-api';         // tên MỚI, không trùng system
    readonly dependsOn = [PROVIDER_NAMES.API];

    boot() {
        const api = this.app.get<APIClientInterface>('API');
        const token = document.querySelector('meta[name="csrf-token"]')?.content;
        api.setCsrfToken(token);
    }
}
```

### Cách 5 — `app(key, value)` trực tiếp

Đăng ký service đơn lẻ sau khi init, không cần dependency order.

```ts
app('analytics', new AnalyticsService());
app<AnalyticsService>('analytics').track('pageview');
```

### Kết hợp tất cả

```ts
App.start({
    // Config cho default providers
    view: { container: '#app', registry: viewRegistry },
    router: { mode: 'history', routes },
    api: { endpoint: '/api' },

    // Service đơn giản
    services: {
        Toast: ToastService,
        Logger: LoggerService,
    },

    // Provider đầy đủ (liệt kê class hoặc instance)
    providers: [
        AuthServiceProvider,
        NotificationProvider,
    ]
});

// Sau init — đăng ký thêm
app('utils', new UtilService());
```

---

## 7. Chọn cách nào?

```
Cần dependency order?
├─ Không → app(key, value)                        Cách 5
└─ Có
   └─ Cần boot logic?
      ├─ Không → services: { K: V }               Cách 1
      └─ Có
         └─ Reusable across projects?
            ├─ Không → providers: [{ ... }]        Cách 2
            └─ Có → providers: [MyProvider]       Cách 3
```

> ⛔ **System providers** (`core`, `view`, `router`, `helper`, `api`) và **system services** (`Marker`, `Store`, `Storage`, `Event`, `Http`, `View`, `Router`, `Helper`, `API`) **không thể bị override**. Chỉ có thể thêm providers/services với tên mới.

| Cách | Độ phức tạp | Dependency order | Boot logic | Reusable |
|:--|:--|:--|:--|:--|
| `services: {}` | Thấp | `core` only | Không | Không |
| `providers: [{}]` | Trung bình | Custom | Có | Không |
| `providers: [Class]` | Cao | Custom | Có | Có |
| `app(k, v)` | Rất thấp | Không | Không | Không |

---

## 8. PROVIDER_NAMES constants

Dùng constant tránh typo, có IDE autocomplete:

```ts
import { PROVIDER_NAMES } from 'saoview';

PROVIDER_NAMES.CORE    // 'core'
PROVIDER_NAMES.VIEW    // 'view'
PROVIDER_NAMES.ROUTER  // 'router'
PROVIDER_NAMES.HELPER  // 'helper'
PROVIDER_NAMES.API     // 'api'
```

### System protection constants

Trong `default-providers.ts`, có 2 bộ bảo vệ ngăn override system services/providers:

```ts
// Tên system providers — không cho phép override
const SYSTEM_PROVIDER_NAMES = new Set(Object.values(PROVIDER_NAMES));
// → Set {'core', 'view', 'router', 'helper', 'api'}

// Tên system services — không cho phép ghi đè qua config.services
const SYSTEM_SERVICE_KEYS = new Set([
    'Marker', 'Store', 'Storage', 'Event', 'Http',
    'View', 'Router', 'Helper', 'API'
]);
```

| Bảo vệ | Áp dụng lên | Khi vi phạm |
|:--|:--|:--|
| `SYSTEM_PROVIDER_NAMES` | `config.providers` — lọc provider có `name` trùng system | Warn + bỏ qua |
| `SYSTEM_SERVICE_KEYS` | `config.services` — lọc service có key trùng system | Warn + bỏ qua |

---

## 9. Quy tắc thiết kế provider

1. **`name` duy nhất** — mỗi provider 1 tên.
2. **`register()` = pure bind** — chỉ `this.app.set()`, không side effects.
3. **`boot()` = init logic** — gọi `.init()`, subscribe events, fetch data.
4. **`dependsOn` chính xác** — khai báo đầy đủ bằng `PROVIDER_NAMES`.
5. **Tránh circular** — nếu A↔B, tách phần chung ra provider riêng hoặc dùng EventService.
6. **Config qua static property** — `ViewServiceProvider.config = {...}` thay vì constructor param.

---

## 10. Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|:--|:--|:--|
| `Missing provider dependency: "xyz"` | Typo trong dependsOn hoặc provider chưa đăng ký | Kiểm tra tên, thêm vào config.providers |
| `Circular dependency at "xyz"` | A→B→C→A | Tách dependency, dời logic sang boot, dùng event |
| `Duplicate provider name: "core"` | 2 provider cùng tên trong resolver | Kiểm tra config.providers không trùng tên nhau |
| `Cannot override system provider "X"` | Custom provider dùng tên system (core/view/router/helper/api) | Đổi tên provider, dùng tên mới thay vì override |
| `Cannot override system service "X"` | config.services dùng key system (View/Router/Store...) | Đổi tên service key, dùng tên mới |
| `App already initialized` | Gọi init() lần 2 | Idempotent — chỉ warn, không lỗi |
| Service undefined khi boot | dependsOn thiếu, service chưa register | Thêm provider cần thiết vào dependsOn |
