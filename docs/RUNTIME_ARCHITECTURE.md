# SaoView Runtime Architecture

> Tài liệu kỹ thuật mô tả kiến trúc runtime của SaoView — từ bootstrap, routing, mount view, đến start reactivity.

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Bootstrap — Khởi tạo ứng dụng](#2-bootstrap--khởi-tạo-ứng-dụng)
3. [Router — Điều hướng SPA](#3-router--điều-hướng-spa)
4. [ViewManager — Orchestrator](#4-viewmanager--orchestrator)
5. [View & ViewController — Đơn vị hiển thị](#5-view--viewcontroller--đơn-vị-hiển-thị)
6. [Element Tree — Cây phần tử](#6-element-tree--cây-phần-tử)
7. [Reactive System — Hệ thống phản ứng](#7-reactive-system--hệ-thống-phản-ứng)
8. [Layout & Block System](#8-layout--block-system)
9. [Lifecycle — Vòng đời hoàn chỉnh](#9-lifecycle--vòng-đời-hoàn-chỉnh)
10. [Compiled Output — Đầu ra từ compiler](#10-compiled-output--đầu-ra-từ-compiler)
11. [Sơ đồ class quan hệ](#11-sơ-đồ-class-quan-hệ)

---

## 1. Tổng quan kiến trúc

SaoView là SPA framework xây dựng element tree trực tiếp (không dùng Virtual DOM). Mỗi view được compile từ file `.one` (Blade-like template) thành TypeScript/JavaScript class, khi runtime sẽ tạo cây DOM elements có reactive updates.

### Luồng chính

```
┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  Bootstrap   │ ──▶│   Router    │ ──▶│ ViewManager  │ ──▶│ View/Ctrl    │
│  App.init()  │    │  start()    │    │ mountView()  │    │ render()     │
└──────────────┘    └─────────────┘    └──────────────┘    └──────┬───────┘
                                                                  │
                    ┌─────────────┐    ┌──────────────┐           │
                    │  onMounted  │ ◀──│   start()    │ ◀─────────┘
                    │  lifecycle  │    │  subscribe   │    Element Tree
                    └─────────────┘    └──────────────┘    (Html, Reactive,
                                                            Output, etc.)
```

### Nguyên tắc thiết kế

| Nguyên tắc | Mô tả |
|------------|--------|
| **Direct DOM** | Không Virtual DOM — tạo HTMLElement trực tiếp bằng `document.createElement()` |
| **Targeted Updates** | Chỉ reactive regions bị ảnh hưởng mới re-render, không diff toàn bộ DOM |
| **Comment Markers** | Dùng `<!--marker-start-->...<!--marker-end-->` để đánh dấu vùng reactive |
| **Lazy Factories** | Render dùng factory functions `() => [...]`, chỉ gọi khi cần |
| **Batched Updates** | State changes được batch qua `requestAnimationFrame` |

---

## 2. Bootstrap — Khởi tạo ứng dụng

**File:** `src/one/bootstrap/app.ts`

Bootstrap là entry point, khởi tạo DI container và đăng ký tất cả services.

### Luồng khởi tạo

```
App.init(config)
  │
  ├─ App.set('Marker', MarkerService)     // DOM marker tracking
  ├─ App.set('View', new ViewManager)     // View lifecycle orchestrator  
  ├─ App.set('Router', new Router)        // SPA router
  ├─ App.set('Helper', new HelperService) // Utility helpers
  ├─ App.set('Store', StoreService)       // Global state store
  ├─ App.set('Storage', StoreService)     // Persistent storage
  ├─ App.set('Event', EventService)       // Event bus (pub/sub)
  ├─ App.set('Http', HttpService)         // HTTP client
  └─ App.set('API', AppAPI)               // API helper
```

### Các bước config

```typescript
// 1. Init core services
App.init(config);

// 2. Init ViewManager — set container + view registry
App.initView({
    container: '#app',                    // hoặc HTMLElement hoặc CSS selector
    registry: {
        'web.home': Home,                 // Factory function
        'web.about': () => import('./views/web/about.js'),  // Lazy import
        'layouts.main': LayoutMain,
    }
});

// 3. Init Router — set routes + guards
App.initRouter({
    mode: 'history',                      // 'history' | 'hash'
    base: '',
    routes: [
        { path: '/', component: 'web.home', name: 'home' },
        { path: '/about', component: 'web.about', name: 'about' },
        { path: '/users/{id}', component: 'web.user-detail', name: 'user.show' },
        { path: '/posts/{page?}', component: 'web.posts', name: 'posts' },
    ],
    beforeEach: (to, from, path) => { /* guard logic */ return true; },
    afterEach: (to, from) => { /* analytics, etc. */ },
});
```

### DI Container (Application)

`Application` là DI container giống Laravel Service Container:

```typescript
App.singleton('myService', () => new MyService());   // Tạo 1 lần, reuse
App.transient('request', () => new Request());        // Tạo mới mỗi lần
App.instance('config', configObj);                    // Instance trực tiếp
App.make<MyService>('myService');                     // Resolve
```

---

## 3. Router — Điều hướng SPA

**File:** `src/one/routers/Router.ts`

### Kiến trúc Router

```
Router
├── routes[]                    // Route table: path → component
├── routeConfigs{}              // Named routes lookup
├── currentRoute: ActiveRoute   // Current active route
├── routeCache: Map             // Cached pattern matches
├── _beforeEach                 // Navigation guard
├── _afterEach                  // Post-navigation hook
├── mode: 'history' | 'hash'   // Navigation mode
└── viewManager                 // Reference to ViewManager
```

### 3.1. Router.start() — Khởi động

```
Router.start()
  │
  ├─ 1. Lấy initial path từ URL hiện tại
  │     history mode: window.location.pathname + search
  │     hash mode:    window.location.hash.substring(1)
  │
  ├─ 2. setActiveRouteForPath(initialPath)
  │     └─ matchRoute() → tạo ActiveRoute (không mount view)
  │
  ├─ 3. Đăng ký event listeners
  │     ├─ 'popstate'  → handlePopState()     (browser back/forward)
  │     └─ 'click'     → handleAutoNavigation() (link interception)
  │
  └─ 4. handleRoute(initialPath)              (mount view đầu tiên)
```

### 3.2. Route Matching — Laravel-style patterns

| Pattern | Ví dụ URL | Params |
|---------|-----------|--------|
| `/users/{id}` | `/users/42` | `{ id: '42' }` |
| `/posts/{page?}` | `/posts` | `{}` |
| `/posts/{page?}` | `/posts/3` | `{ page: '3' }` |
| `/cate/{slug}` | `/cate/demo?page=2` | `{ slug: 'demo' }` + query `{ page: '2' }` |
| `*` hoặc `{any}` | bất kỳ | `{ wildcard: path }` |

```typescript
// Internal: chuyển pattern thành regex
'/users/{id}'     → /\/users\/([^\/]+)$/
'/posts/{page?}'  → /\/posts(?:\/([^\/]+))?$/
```

### 3.3. ActiveRoute — Route state object

```typescript
const route = new ActiveRoute(routeDef, '/users/42', { id: '42' }, { tab: 'info' }, 'section1');

route.$urlPath   // '/users/42'
route.$params    // { id: '42' }
route.$query     // { tab: 'info' }
route.$fragment  // 'section1'
route.id         // '42'  — dynamic property truy cập trực tiếp qua tên param
route.tab        // 'info' — dynamic property từ query
```

### 3.4. handleRoute() — Xử lý navigation

```
handleRoute(path)
  │
  ├─ normalizePath(path)          // '/users/42/' → '/users/42'
  ├─ parseQuery(search)           // '?tab=info' → { tab: 'info' }
  │
  ├─ matchRoute(normalizedPath)
  │   └─ Tìm trong routes[] → extractParams() → RouteMatch { route, params }
  │
  ├─ new ActiveRoute(route, path, params, query, fragment)
  │
  ├─ _beforeEach(route, from, path)?
  │   └─ return false → cancel navigation, return true → continue
  │
  ├─ Router.activeRoute = activeRoute     // Global static access
  │
  ├─ viewManager.mountView(component, params, activeRoute)
  │   └─ ← Đây là nơi view lifecycle bắt đầu (xem Section 4)
  │
  └─ _afterEach(route, from)              // Post-navigation hook
```

### 3.5. Auto Navigation — Tự động bắt links

Router tự động intercept 3 loại click:

```
1. [data-nav-link="/about"]    ← Ưu tiên cao nhất
   <div data-nav-link="/about">Click me</div>

2. [data-navigate="/about"]    ← Ưu tiên thứ 2
   <button data-navigate="/about">Go</button>

3. <a href="/about">           ← Link thường (same-origin)
   Tự động intercept, push vào history

Skip: target="_blank", data-nav="disabled", mailto:, tel:, external links
```

### 3.6. URL Generation — Tạo URL từ named route

```typescript
// Giống Laravel route() helper
router.getURL('user.show', { id: 42 });
// → '/users/42'

router.generateUrl('/cate/{slug}', { slug: 'demo', page: 2 });
// → '/cate/demo?page=2'   (extra params → query string)
```

---

## 4. ViewManager — Orchestrator

**File:** `src/one/view/ViewManager.ts`

ViewManager là orchestrator trung tâm, quản lý toàn bộ view lifecycle.

### Kiến trúc

```
ViewManager
├── container: HTMLElement          // Root DOM container (#app)
├── rootElement: Html               // Html wrapper cho container
├── viewRegistry: Record<name, factory>  // View module registry
├── activeViews: Map<path, ViewInfo>     // Mounted views
├── currentPageView: ViewInterface       // Current page
├── currentLayoutView: ViewInterface     // Current layout
├── cachedLayouts: Map                   // Layout cache
├── viewStack: ViewInterface[]           // All views in chain
├── store: StoreService                  // View-level store
└── blockManager: BlockManagerService    // Layout block slots
```

### 4.1. init() — Khởi tạo

```
ViewManager.init({ container: '#app', registry: {...} })
  │
  ├─ Resolve container
  │   ├─ String selector → document.querySelector('#app')
  │   ├─ HTMLElement → dùng trực tiếp
  │   └─ Fallback → document.body
  │
  ├─ Wrap container thành Html element (rootElement)
  │   └─ new Html({ tagName: 'div', element: containerElement, initMode: 'hydrate' })
  │
  └─ setViewRegistry(registry)
      └─ Merge vào viewRegistry
```

### 4.2. view() — Load/Create View instance

```
viewManager.view(name, data, cache)
  │
  ├─ cache=true && store.has(name)?
  │   ├─ YES → lấy cached view → updateData(data) → return
  │   └─ NO  → tiếp tục
  │
  ├─ factory = viewRegistry[name]
  │   └─ Không tìm thấy → logger.error → return null
  │
  ├─ view = factory({ data }, { App, View: this, ...systemData })
  │   │                ↑ __data__        ↑ systemData
  │   │
  │   └─ Bên trong factory:
  │       ├─ new XxxView(App, systemData)
  │       │   └─ new ViewController(this, path, viewType)
  │       ├─ view.$__setup__(__data__, systemData)
  │       │   └─ ctrl.setup(config)  ← lưu renderFactory, metadata
  │       └─ return view
  │
  └─ cache=true → store.set(name, view)
```

### 4.3. mountView() — Mount view khi navigate

```
mountView(name, data, activeRoute, navigationType)
  │
  ├─ view = this.view(name, data, cache=true)
  │
  ├─ view.__ctrl__.urlPath = route.$urlPath
  │
  └─ Loop: renderView chain (nếu có layout)
      │
      ├─ result = rendxerView(view, data)
      │   └─ ctrl.render()                  ← gọi renderFactory
      │       └─ return element tree HOẶC superView
      │
      ├─ if result instanceof View → view extends layout
      │   └─ tiếp tục loop với layout view
      │
      └─ Khi không còn superView → mount xong
```

---

## 5. View & ViewController — Đơn vị hiển thị

### 5.1. View — User-facing class

**File:** `src/one/view/View.ts`

View là class mà user/compiler tương tác trực tiếp. Nó chứa:
- Properties do user định nghĩa (state, computed)
- Methods do user định nghĩa (event handlers, business logic)
- Lifecycle hooks
- `__ctrl__` — ViewController ẩn (non-enumerable)

```typescript
class CounterView extends View {
    constructor(App, systemData) {
        super('counter', 'view', CounterViewController);
        // → new ViewController(this, 'counter', 'view')
        // → __ctrl__ gắn vào this (non-enumerable)
    }

    $__setup__(__data__, systemData) {
        // Compiler-generated: declare state, methods, renderFactory
        const [count, setCount] = this.__ctrl__.states.__.useState(0, 'count');
        this.count = count;
        this.setCount = setCount;
        this.increment = () => setCount(this.count + 1);

        this.__ctrl__.setup({
            render: function() { /* build element tree */ },
            // ...
        });
    }
}
```

### 5.2. ViewController — Internal brain

**File:** `src/one/view/ViewController.ts`

ViewController quản lý mọi thứ internal cho View:

```
ViewController
│
├── Identity
│   ├── viewId: string          // Unique ID (e.g. 'view-abc123')
│   ├── path: string            // 'web.home', 'counter'
│   └── viewType: ViewType      // 'view' | 'layout' | 'component'
│
├── Core References
│   ├── view: ViewInterface     // The View instance
│   ├── states: ViewState       // Reactive state manager
│   └── __App: Application      // DI container
│
├── View Hierarchy
│   ├── parent / children       // Nested view tree
│   ├── superView               // Layout controller
│   ├── superViewPath           // 'layouts.main'
│   ├── isSuperView             // true nếu là layout
│   └── originView              // Page view gốc (cho layout)
│
├── Data & Config
│   ├── data                    // Input data (route params, props)
│   ├── config / runtimeConfig  // Compiled metadata
│   └── renderFactory           // () => element tree
│
├── DOM & Rendering
│   ├── rootElement             // Container Html element
│   ├── _rootTree               // Root element tree (Wrapper/Fragment)
│   ├── elements: Map           // Tất cả elements theo id
│   └── initMode                // 'create' | 'hydrate'
│
├── Reactive System
│   ├── pendingReactiveUpdates  // Set<Reactive> — batched
│   ├── hasScheduledUpdate      // RAF scheduled?
│   └── eventAbortController    // Centralized cleanup
│
├── Loop
│   └── loopContext: LoopContext // Stack cho @foreach/@for/@while
│
└── Layout
    ├── sections: Map           // @section definitions
    └── blocks: Map             // @block slots
```

### 5.3. Lifecycle Methods

```typescript
// ─── Setup Phase ─────────────────────────
ctrl.setup(config)            // Lưu config, renderFactory, superView path
ctrl.setRootElement(htmlEl)   // Set container
ctrl.setParentElement(parent) // Set parent cho non-root views

// ─── Render Phase ────────────────────────
ctrl.render()                 // Gọi renderFactory → build element tree
ctrl.prerender()              // Optional pre-render (cho SSR/loading states)
ctrl.hydrateRender()          // Render ở hydrate mode

// ─── Data Phase ──────────────────────────
ctrl.commitData()             // Set initial state values
ctrl.updateData(newData)      // Update khi navigate cùng view, khác params

// ─── Activation Phase ────────────────────
ctrl.start()                  // Subscribe reactive, fire onMounted
ctrl.stop()                   // Unsubscribe reactive, fire onDeactivated

// ─── Cleanup Phase ───────────────────────
ctrl.destroy()                // Abort events, destroy tree, fire onDestroy
```

---

## 6. Element Tree — Cây phần tử

SaoView build cây phần tử trực tiếp — mỗi node tương ứng 1 DOM element hoặc 1 vùng reactive.

### 6.1. Các loại Element

| Class | saoType | DOM Output | Mô tả |
|-------|---------|-----------|--------|
| **Wrapper** | `'Wrapper'` | `<!--wrapper-start-->...<!--wrapper-end-->` | Root container cho view, wrap nhiều siblings |
| **Fragment** | `'Fragment'` | `<!--fragment-start-->...<!--fragment-end-->` | Nhóm nhiều nodes không cần wrapper tag |
| **Html** | `'Html'` | `<div>...</div>` | DOM element thực — div, span, button, etc. |
| **TextElement** | `'TextElement'` | `Text node` | Text node thuần |
| **Output** | `'Output'` | `<!--o:id-s-->text<!--o:id-e-->` | Reactive text output `{{ $var }}` |
| **Reactive** | `'Reactive'` | `<!--reactive-start-->...<!--reactive-end-->` | Vùng reactive: @if, @foreach, @switch |
| **Component** | `'Component'` | `<!--component-start-->...<!--component-end-->` | Child view (@include) |
| **Block** | `'Block'` | `<!--block-start-->...<!--block-end-->` | Layout block slot (@block) |
| **BlockOutlet** | `'BlockOutlet'` | `<!--block-outlet-start-->...<!--block-outlet-end-->` | Layout outlet (@useBlock) |
| **YieldElement** | `'Yield'` | N/A | @yield directive |

### 6.2. Element Tree Hierarchy

```
Wrapper (view root)
├── Html <div class="page">
│   ├── Html <h1>
│   │   └── TextElement "Welcome"
│   ├── Output {{ $userName }}               ← reactive text
│   │   └── Text "John"
│   └── Reactive @if($isLoggedIn)            ← reactive region
│       ├── Html <div class="profile">
│       │   └── Output {{ $email }}
│       └── (empty khi condition false)
├── Reactive @foreach($items)                ← list rendering
│   └── (mỗi iteration → Html + children)
└── Component @include('partials.footer')    ← child view
    └── (separate ViewController)
```

### 6.3. Element API (ViewController methods)

Compiler output gọi các methods này để build tree:

```typescript
// ─── Container ──────────────────────────
this.wrapper((parentElement) => [...])
// Tạo Wrapper root, nhận factory trả về children

this.fragment(id, parentElement, (parentElement) => [...])
// Fragment — nhóm children không cần tag

// ─── DOM Elements ───────────────────────
this.html(id, tagName, parentElement, config, (parentElement) => [...])
// config: { attrs, classes, styles, events, hydrate, selector }

this.text('Hello World')
// Tạo Text node thuần

// ─── Reactive Output ────────────────────
this.output(id, parentElement, isEscapeHTML, stateKeys, () => expression)
// {{ $var }} → output(id, parent, true, ['var'], () => var)
// {!! $var !!} → output(id, parent, false, ['var'], () => var)

// ─── Reactive Regions ───────────────────
this.reactive(id, type, parentReactive, parentElement, stateKeys, childrenFactory)
// type: 'if' | 'foreach' | 'switch' | 'for' | 'while'
// childrenFactory: () => [...children]

// ─── Components ─────────────────────────
this.include(id, path, parentElement, stateKeys, (parentElement) => ({ ...data }))
this.includeIf(id, path, parent, stateKeys, dataFactory)
this.includeWhen(id, condition, path, parent, stateKeys, dataFactory)

// ─── Layout ─────────────────────────────
this.block(id, name, contentRenderFactory)        // @block('content')
this.blockOutlet(id, name, parentElement)          // @useBlock('content')
this.yield(id, name, defaultValue, parentElement)  // @yield('title')
this.section(name, config, renderFactory)          // @section('title')

// ─── Loops ──────────────────────────────
this.__foreach(list, (item, key, index, loop) => [...])
this.__forelse(list, callback, emptyCallback)
// loop: LoopContext { index, iteration, count, first, last, odd, even, depth, parent }
```

### 6.4. Html Element — Config structure

```typescript
this.html('my-div', 'div', parentElement, {
    // Static attributes
    attrs: {
        'data-id': { type: 'value', value: '123' },
        'disabled': { type: 'reactive', stateKeys: ['isDisabled'], factory: () => isDisabled },
    },
    
    // CSS classes
    classes: {
        'active': { type: 'static', value: true },
        'hidden': { type: 'reactive', stateKeys: ['isHidden'], factory: () => isHidden },
    },
    
    // Inline styles
    styles: {
        'color': { type: 'value', value: 'red' },
        'opacity': { type: 'reactive', stateKeys: ['opacity'], factory: () => opacity },
    },
    
    // Events
    events: {
        'click': [handler1, { handler: 'methodName', params: ['@EVENT'] }],
        'input': [(e) => setValue(e.target.value)],
    },
    
    // Hydration
    hydrate: true,         // Tìm element trong DOM thay vì tạo mới
    selector: '#my-div',   // CSS selector cho hydration
}, (parentElement) => [
    // Children factory
]);
```

---

## 7. Reactive System — Hệ thống phản ứng

### 7.1. ViewState & StateManager

**File:** `src/one/view/ViewState.ts`

```
ViewState (proxy)
├── __: StateManager       // Internal manager
├── [key]: getter/setter   // Dynamic reactive properties
└── on/off/unsubscribe     // Subscription helpers

StateManager
├── states: Record<key, StateItem>
│   StateItem = { value, setValue, key }
├── listeners: Map<key, callback[]>         // Single-key listeners
├── multiKeyListeners: MultiKeyListener[]   // Multi-key listeners
├── pendingChanges: Set<key>                // Batch queue
├── setters: Record<key, fn>               // Exposed setters
└── canUpdateStateByKey: boolean            // Lock flag
```

### 7.2. useState — Tạo reactive state

```typescript
// Trong compiled $__setup__:
const [count, setCount] = this.__ctrl__.states.__.useState(0, 'count');

// Bên trong StateManager:
useState(0, 'count')
  │
  ├─ Tạo StateItem: { value: 0, setValue: fn, key: 'count' }
  ├─ Lưu vào states['count']
  ├─ Tạo setter function:
  │   setValue = (newValue) => {
  │       states['count'].value = newValue;
  │       commitStateChange('count', oldValue);  ← trigger batch
  │   }
  ├─ Define getter/setter trên ViewState proxy:
  │   viewState.count      → states['count'].value      (getter)
  │   viewState.count = 5  → setValue(5)                 (setter)
  │
  └─ return [0, setValue, 'count']
```

### 7.3. Reactive Update Flow

```
User Action (click, input, etc.)
  │
  ▼
setCount(newValue)
  │
  ▼
StateManager.commitStateChange('count', oldValue)
  │
  ├─ pendingChanges.add('count')
  └─ scheduleFlush()  ← requestAnimationFrame
      │
      ▼ (next frame)
  flushPendingChanges()
  │
  ├─ Notify single-key listeners: listeners.get('count') → [callback1, callback2]
  │   └─ callback = Reactive.scheduleUpdate() hoặc Output.update()
  │
  ├─ Notify multi-key listeners: multiKeyListeners.filter(has 'count')
  │   └─ callback = combined update
  │
  └─ pendingChanges.clear()
      │
      ▼
  ViewController.scheduleUpdate(reactive)
  │
  ├─ pendingReactiveUpdates.add(reactive)
  └─ requestAnimationFrame → flushReactiveUpdates()
      │
      ▼
  flushReactiveUpdates()
  │
  └─ for each reactive in updates:
      reactive.render()  ← re-render vùng DOM giữa markers
```

### 7.4. State Subscription

```typescript
// Single key
const unsub = stateManager.subscribe('count', (newVal, oldVal) => {
    console.log(`count: ${oldVal} → ${newVal}`);
});

// Multiple keys — callback gọi khi BẤT KỲ key nào thay đổi
const unsub = stateManager.subscribe(['count', 'name'], (changes) => {
    // Gọi 1 lần dù cả 2 keys thay đổi trong cùng batch
});

// Nested state access
stateManager.getStateByKey('user.name');          // dot-path access
stateManager.updateStateAddressKey('user.name', 'John');  // dot-path update (clone + set)
```

### 7.5. State Lock Mechanism

```
$__setup__()
  │
  ├─ useState(0, 'count')  ← tạo state
  ├─ update$count(initialValue)  ← set initial từ data
  │     ↑ canUpdateStateByKey = true
  │
  ├─ lockUpdateRealState()  ← LOCK
  │     ↑ canUpdateStateByKey = false
  │     Sau đây update$count() không hoạt động nữa
  │
  └─ Chỉ setCount() (từ user action) mới thay đổi state
```

---

## 8. Layout & Block System

### 8.1. Layout Flow

Khi view extends layout:

```
Page View ($__setup__)
  │
  ├─ this.__ctrl__.setup({ superView: 'layouts.main', ... })
  │
  └─ render()
      ├─ this.block('content', renderFactory)  ← đăng ký block content
      ├─ this.section('title', config, () => 'Page Title')
      └─ return superView  ← yêu cầu render layout
          │
          └─ Layout View.render()
              ├─ this.html(...)  ← layout structure
              │   ├─ this.blockOutlet('content', parent)  ← slot cho block
              │   ├─ this.yield('title', 'Default Title')
              │   └─ this.html(...)  ← more structure
              └─ return Wrapper
```

### 8.2. BlockManager — Kết nối Block ↔ Outlet

```
BlockManager (singleton)
├── blocks: Map<key, Block>              // Tất cả blocks đăng ký
├── blockOutlets: Map<key, BlockOutlet>  // Tất cả outlets
├── activeBlocks: Map<name, Block>       // Block đang active
└── listeners: Map<name, callback[]>     // Theo dõi thay đổi

Lifecycle:
1. Page view render() → block('content', factory) → BlockManager.add(block)
2. Layout view render() → blockOutlet('content', parent) → outlet created
3. ViewManager → BlockManager.mountAll()
   └─ Mỗi activeBlock tìm outlet tương ứng → mount content
4. Navigate → BlockManager.active(name, newViewId) → swap content
```

---

## 9. Lifecycle — Vòng đời hoàn chỉnh

### 9.1. Full Page Load (First Visit)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. BOOTSTRAP                                                     │
│    App.init() → App.initView() → App.initRouter()               │
├─────────────────────────────────────────────────────────────────┤
│ 2. ROUTER START                                                  │
│    Router.start()                                                │
│    ├─ setActiveRouteForPath(URL)                                 │
│    ├─ addEventListener('popstate', 'click')                      │
│    └─ handleRoute(URL)                                           │
├─────────────────────────────────────────────────────────────────┤
│ 3. ROUTE MATCHING                                                │
│    matchRoute(path) → RouteMatch { route, params }               │
│    new ActiveRoute(route, path, params, query, fragment)         │
│    _beforeEach(to, from, path)?                                  │
├─────────────────────────────────────────────────────────────────┤
│ 4. VIEW CREATION                                                 │
│    ViewManager.mountView(component, params, activeRoute)         │
│    ├─ factory() → new XxxView(App, systemData)                   │
│    │   └─ new ViewController(this, path, viewType)               │
│    └─ view.$__setup__(__data__, systemData)                      │
│        ├─ useState() × N  → tạo reactive states                 │
│        ├─ setUserDefinedConfig() → gắn methods lên view         │
│        └─ ctrl.setup({ render, prerender, data, ... })           │
├─────────────────────────────────────────────────────────────────┤
│ 5. ELEMENT TREE BUILD                                            │
│    ctrl.render()                                                 │
│    └─ renderFactory()                                            │
│        ├─ this.wrapper(factory)                                  │
│        ├─ this.html(id, tag, parent, config, children)           │
│        ├─ this.reactive(id, type, ..., stateKeys, factory)       │
│        ├─ this.output(id, parent, escape, stateKeys, factory)    │
│        ├─ this.include(id, path, parent, stateKeys, dataFactory) │
│        └─ return rootTree (Wrapper)                              │
│                                                                   │
│    Lúc này: DOM elements ĐÃ tạo, CHƯA subscribe reactive        │
├─────────────────────────────────────────────────────────────────┤
│ 6. DATA COMMIT                                                   │
│    ctrl.commitData()                                             │
│    └─ updateRealState({ count: initialValue })                   │
│    └─ lockUpdateRealState()  ← lock direct state updates         │
├─────────────────────────────────────────────────────────────────┤
│ 7. DOM MOUNT                                                     │
│    Container.appendChild(...) — tree vào DOM thực                │
├─────────────────────────────────────────────────────────────────┤
│ 8. REACTIVE START                                                │
│    ctrl.start()                                                  │
│    └─ _rootTree.start() ← đệ quy                                │
│        ├─ Wrapper.start() → children.forEach(c.start())          │
│        ├─ Html.start()                                           │
│        │   ├─ Attach event listeners                             │
│        │   └─ children.start()                                   │
│        ├─ Reactive.start()                                       │
│        │   └─ stateManager.subscribe(stateKeys, update)          │
│        │       Khi state thay đổi → scheduleUpdate → re-render   │
│        ├─ Output.start()                                         │
│        │   └─ stateManager.subscribe(stateKeys, update)          │
│        │       Khi state thay đổi → update textContent            │
│        └─ Component.start()                                      │
│            └─ Load & mount child view                            │
├─────────────────────────────────────────────────────────────────┤
│ 9. LIFECYCLE HOOK                                                │
│    view.onMounted()                                              │
│    _afterEach(to, from)                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2. SPA Navigation (Subsequent Pages)

```
Click <a href="/about">
  │
  ├─ handleAutoNavigation(event)
  │   └─ event.preventDefault()
  │
  ├─ history.pushState({}, '', '/about')
  │
  └─ handleRoute('/about')
      │
      ├─ matchRoute → RouteMatch
      ├─ _beforeEach? → allow/deny
      │
      ├─ ⚡ OLD VIEW CLEANUP
      │   ├─ ctrl.stop()   ← unsubscribe reactive
      │   └─ ctrl.destroy() ← abort events, destroy tree
      │
      ├─ 🆕 NEW VIEW MOUNT
      │   ├─ Same layout? → reuse layout, chỉ swap page blocks
      │   └─ Different layout? → mount layout mới
      │
      └─ _afterEach
```

### 9.3. Browser Back/Forward

```
User clicks ← (browser back)
  │
  ├─ 'popstate' event → handlePopState()
  └─ handleRoute(window.location.pathname)
      └─ Same as SPA navigation (Section 9.2)
```

### 9.4. View Lifecycle Hooks

```typescript
class MyView extends View {
    onInit?()        // Sau khi setup, trước render
    onMounted?()     // Sau khi start (reactive active, DOM mounted)
    onUpdated?()     // Sau khi reactive update
    onDestroy?()     // Khi view bị destroy
    onActivated?()   // Khi view được re-activate (từ cache)
    onDeactivated?() // Khi view bị deactivate (vẫn cached)
}
```

---

## 10. Compiled Output — Đầu ra từ compiler

### 10.1. Cấu trúc file compiled

Mỗi file `.one` được compile thành:

```typescript
import { Application, View, ViewController, app } from 'saoview';

// ─── Constants ──────────────────────
const __VIEW_PATH__ = 'counter';
const __VIEW_TYPE__ = 'view';
const __VIEW_CONFIG__ = {
    hasSuperView: false,     // true nếu @extends layout
    viewType: 'view',        // 'view' | 'layout'
    hasAwaitData: false,     // true nếu có @await
    hasFetchData: false,     // true nếu có async fetch
    hasPrerender: false,     // true nếu có prerender section
    hasSections: false,      // true nếu có @section
    // ...
};

// ─── Custom ViewController ──────────
class CounterViewController extends ViewController {
    constructor(view: View) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        this.config = __VIEW_CONFIG__;
    }
}

// ─── View Class ─────────────────────
class CounterView extends View {
    constructor(App, systemData) {
        super(__VIEW_PATH__, __VIEW_TYPE__, CounterViewController);
    }

    $__setup__(__data__, systemData) {
        // 1. State declarations
        // 2. Variable declarations
        // 3. User-defined methods
        // 4. ctrl.setup({ render, prerender, commitData, ... })
    }
}

// ─── Factory Export ─────────────────
export function Counter(__data__ = {}, systemData = {}) {
    const App = app("App");
    const view = new CounterView(App, systemData);
    view.$__setup__(__data__, systemData);
    return view;
}
export default Counter;
```

### 10.2. Ví dụ render function

```typescript
// Từ Blade template:
//   <div class="counter">
//     <h1>Counter: {{ $count }}</h1>
//     <button @click="setCount(count + 1)">+1</button>
//     @if($count > 10)
//       <p class="warning">Too high!</p>
//     @endif
//   </div>

render: function() {
    let parentElement = this.parentElement;
    let parentReactive = null;
    
    return this.wrapper((parentElement) => [
        this.html(`div-1`, 'div', parentElement,
            { classes: { 'counter': { type: 'static', value: true } } },
            (parentElement) => [
                // <h1>Counter: {{ $count }}</h1>
                this.html(`div-1-h1-1`, 'h1', parentElement, {}, (parentElement) => [
                    this.text('Counter: '),
                    this.output(`div-1-h1-1-output-1`, parentElement, true, ['countState'],
                        () => count
                    )
                ]),
                
                // <button @click="setCount(count + 1)">+1</button>
                this.html(`div-1-button-1`, 'button', parentElement, {
                    events: {
                        'click': [(e) => setCount(count + 1)]
                    }
                }, (parentElement) => [
                    this.text('+1')
                ]),
                
                // @if($count > 10) ... @endif
                this.reactive(`rc-if-1`, 'if', parentReactive, parentElement,
                    ['countState'],
                    () => {
                        if (count > 10) {
                            return [
                                this.html(`rc-if-1-case_1-p-1`, 'p', parentElement,
                                    { classes: { 'warning': { type: 'static', value: true } } },
                                    (parentElement) => [
                                        this.text('Too high!')
                                    ]
                                )
                            ];
                        }
                        return [];
                    }
                )
            ]
        )
    ]);
}
```

### 10.3. Component Include Pattern

```typescript
// @include('partials.tasks', ['users' => $users])
this.include("component-1", __template__ + 'partials.tasks', parentElement,
    ['usersState'],  // stateKeys — reactive khi users thay đổi
    (parentElement) => ({
        "users": users
    })
)

// Nested @include with @children
// <tasks><demo :users="$users" /></tasks>
this.include("component-1", path, parentElement, [], (parentElement) => ({
    "__ONE_CHILDREN_CONTENT__": (parentElement) => [
        this.include("component-1-1", childPath, parentElement, [],
            (parentElement) => ({ "users": users })
        )
    ]
}))
// __ONE_CHILDREN_CONTENT__ là function, lazy evaluation
```

---

## 11. Sơ đồ Class quan hệ

```
                          ┌──────────────┐
                          │  Application │ (DI Container)
                          └──────┬───────┘
                     ┌───────────┼───────────┐
                     │           │           │
              ┌──────▼──────┐   │   ┌───────▼──────┐
              │   Router    │   │   │  EventService │
              └──────┬──────┘   │   └──────────────┘
                     │          │
              ┌──────▼──────────▼─────┐
              │     ViewManager       │
              │  (Orchestrator)       │
              └──────────┬────────────┘
                         │
              ┌──────────▼────────────┐
              │   View + ViewController│    ← 1:1 relationship
              │                       │
              │  View (user-facing)   │
              │   ├── $__setup__()    │
              │   ├── onMounted()     │
              │   └── [user methods]  │
              │                       │
              │  ViewController       │
              │   ├── states ─────────┼──── ViewState / StateManager
              │   ├── render() ───────┼──── Element Tree ──┐
              │   ├── start()         │                    │
              │   ├── stop()          │    ┌───────────────┤
              │   └── destroy()       │    │  Element Types│
              └───────────────────────┘    ├───────────────┤
                                           │ Wrapper       │
                                           │ Fragment      │
                                           │ Html          │
                                           │ TextElement   │
                                           │ Output        │
                                           │ Reactive      │
                                           │ Component     │
                                           │ Block         │
                                           │ BlockOutlet   │
                                           │ YieldElement  │
                                           └───────────────┘
```

### Services

```
┌─────────────────────────────────────────┐
│             Services Layer              │
├────────────────┬────────────────────────┤
│ BlockManager   │ Quản lý layout blocks  │
│ MarkerService  │ DOM comment markers    │
│ MarkerRegistry │ Marker ID registry     │
│ EventService   │ Pub/Sub event bus      │
│ HttpService    │ HTTP client            │
│ StoreService   │ Global state store     │
│ StorageService │ Persistent storage     │
│ HelperService  │ Utility functions      │
│ LoggerService  │ Logging                │
│ DomService     │ DOM utilities          │
└────────────────┴────────────────────────┘
```

---

## File Reference

| File | Vai trò |
|------|---------|
| `src/one/bootstrap/app.ts` | Entry point, khởi tạo App + services |
| `src/one/app/Application.ts` | DI Container (bind, singleton, make) |
| `src/one/routers/Router.ts` | SPA Router + ActiveRoute |
| `src/one/view/ViewManager.ts` | View lifecycle orchestrator |
| `src/one/view/View.ts` | Base View class (user-facing) |
| `src/one/view/ViewController.ts` | Internal controller (render, state, events) |
| `src/one/view/ViewState.ts` | Reactive state manager (useState, subscribe) |
| `src/one/view/LoopContext.ts` | Loop metadata ($loop.index, .first, .last) |
| `src/one/view/Section.ts` | @section management |
| `src/one/elements/Wrapper.ts` | Root wrapper (comment markers) |
| `src/one/elements/Fragment.ts` | Fragment container |
| `src/one/elements/Html.ts` | DOM element wrapper |
| `src/one/elements/Reactive.ts` | Reactive region (@if, @foreach) |
| `src/one/elements/Output.ts` | Reactive text output ({{ }}) |
| `src/one/elements/Component.ts` | Child view component (@include) |
| `src/one/elements/Block.ts` | Layout block (@block) |
| `src/one/elements/BlockOutlet.ts` | Layout outlet (@useBlock) |
| `src/one/elements/Yield.ts` | @yield directive |
| `src/one/services/BlockManager.ts` | Block ↔ Outlet coordination |
| `src/one/services/EventService.ts` | Pub/Sub event bus |
| `src/one/services/MarkerRegistry.ts` | Comment marker registry |
| `index.ts` | Public API exports |
