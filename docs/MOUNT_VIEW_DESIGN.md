# MountView Flow — Thiết kế chi tiết

> Tài liệu kỹ thuật cho luồng `ViewManager.mountView()`:  
> Từ **Router gọi mountView** → **DOM rendering** → **Lifecycle activation**.  
> Bao gồm: layout reuse, block mounting, caching, và edge-case handling.

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Luồng chính: mountView step-by-step](#2-luồng-chính-mountview-step-by-step)
3. [Phase 1 — View Loading](#3-phase-1--view-loading)
4. [Phase 2 — Render Chain Resolution](#4-phase-2--render-chain-resolution)
5. [Phase 3 — Layout Comparison & Decision](#5-phase-3--layout-comparison--decision)
6. [Phase 4 — DOM Building](#6-phase-4--dom-building)
7. [Phase 5 — Block Mounting](#7-phase-5--block-mounting)
8. [Phase 6 — Data Commit & Start](#8-phase-6--data-commit--start)
9. [Caching Strategy](#9-caching-strategy)
10. [Cleanup & Unmount Logic](#10-cleanup--unmount-logic)
11. [Edge Cases](#11-edge-cases)
12. [Trạng thái hiện tại & TODO](#12-trạng-thái-hiện-tại--todo)
13. [Sequence Diagrams](#13-sequence-diagrams)

---

## 1. Tổng quan kiến trúc

### Các actor chính

| Component | Vai trò | File |
|-----------|---------|------|
| **Router** | Bắt URL change → gọi `mountView(name, data, route)` | `src/one/routers/Router.ts` |
| **ViewManager** | Orchestrator: load → render → compare layout → mount → start | `src/one/view/ViewManager.ts` |
| **ViewController** | Internal brain: quản lý state, render factory, element tree, lifecycle | `src/one/view/ViewController.ts` |
| **View** | User-facing class: lifecycle hooks, public API | `src/one/view/View.ts` |
| **Wrapper** | Root element container (comment markers bracket multiple root nodes) | `src/one/elements/Wrapper.ts` |
| **BlockManager** | Singleton: kết nối Block (page) ↔ BlockOutlet (layout) | `src/one/services/BlockManager.ts` |
| **Block** | Stores page content factory, registered in BlockManager | `src/one/elements/Block.ts` |
| **BlockOutlet** | Comment markers in layout — target cho block content insertion | `src/one/elements/BlockOutlet.ts` |

### Hai loại View

```
┌─────────────────────────────────────────────────┐
│ Standalone View (không extends)                  │
│                                                  │
│ render() → Wrapper (có DOM tree trực tiếp)       │
│ Ví dụ: home.js, counter.js                      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Extends View (page extends layout)               │
│                                                  │
│ Page render() → this.block('content', factory)   │
│              → return this.extendView('layout')  │
│                      ↓                           │
│ Layout render() → this.wrapper((...) => [        │
│                      this.blockOutlet('content') │
│                   ])                             │
│              → return Wrapper                    │
└─────────────────────────────────────────────────┘
```

### Extends Chain (nhiều tầng)

```
PageView.render()
  → this.block('content', pageContentFactory)
  → return this.extendView('layouts.admin')
        ↓
    AdminLayout.render()
      → this.block('body', adminBodyFactory)
      → return this.extendView('layouts.base')
            ↓
        BaseLayout.render()
          → this.wrapper((...) => [
                this.blockOutlet('body')  // outlet cho admin body
            ])
          → return Wrapper ← FINAL VIEW
```

Kết quả: `renderPageView()` trả về:
```
{
  type: 'success',
  view: PageView,           // view gốc (page)
  result: AdminLayout,      // kết quả render() = super view
  superView: BaseLayout,    // kết quả recursive
  finalView: BaseLayout     // view cuối cùng trả về Wrapper
}
```

---

## 2. Luồng chính: mountView step-by-step

```
Router.handleRoute(matchedRoute)
  │
  ▼
ViewManager.mountView(name, data, route, navigationType)
  │
  ├─[Phase 1] Load view từ registry (có cache)
  │
  ├─[Phase 2] renderPageView() — resolve extends chain
  │    └─ Recursive: render → View? → render lại → ... → Wrapper? → DONE
  │
  ├─[Phase 3] Layout Comparison
  │    ├─ Case A: First mount (chưa có layout) → Fresh mount
  │    ├─ Case B: Same layout instance → Partial update
  │    └─ Case C: Different layout → Full swap
  │
  ├─[Phase 4] DOM Building
  │    └─ Wrapper.render() → Html.render() → BlockOutlet.render() → ...
  │
  ├─[Phase 5] Block Mounting
  │    └─ BlockManager.mountAll() → insert block content vào outlets
  │
  ├─[Phase 6] Data Commit & Start
  │    ├─ commitData() cho tất cả views trong chain
  │    └─ start() → activate reactive subscriptions + onMounted hooks
  │
  └─ Done — View đang active, reactive, trong DOM
```

---

## 3. Phase 1 — View Loading

### Hiện tại (đã implement)

```typescript
// ViewManager.view()
view(name: string, data: Record<string, any>, cache: boolean): View | null {
    // 1. Check cache trước
    if (cache && this.store.has(name)) {
        const cachedView = this.store.get<View>(name);
        if (hasData(data)) cachedView?.__ctrl__.updateData(data);
        return cachedView;
    }
    
    // 2. Lấy factory từ registry
    const factory = this.viewRegistry[name];
    
    // 3. Gọi factory → View instance
    //    factory gọi: new XxxView({data}, {App, View, ...})
    //    → constructor: $__setup__() → ctrl.setup(config)
    const view = factory({data}, {App, View: this, ...systemData});
    
    // 4. Cache nếu cần
    if (cache) this.store.set(name, view);
    
    return view;
}
```

### Quyết định thiết kế

- **Cache mặc định = `true`** khi gọi từ `mountView`: View đã render 1 lần thì reuse instance, không tạo mới.
- **`extendView()` trong ViewController** cũng gọi `view(path, data, true)` → layout views luôn được cache.
- **Khi cache hit**: chỉ `updateData(newData)` nếu có data mới (ví dụ: route params thay đổi).

### Lưu ý quan trọng

Khi `view()` được gọi với `cache=true` và view đã tồn tại:
- View instance **giữ nguyên** — cùng ViewController, cùng state, cùng element tree.
- Chỉ update data nếu cần.
- **Không** gọi lại constructor hay `$__setup__()`.

---

## 4. Phase 2 — Render Chain Resolution

### Hiện tại (đã implement trong `renderPageView()`)

```typescript
renderPageView(view, data, rootElement, initMode, cache, renderLevel = 0) {
    const ctrl = view.__ctrl__;
    
    // Render view
    let result = ctrl.render();
    
    // Nếu result là View → view extends layout → recursive
    if (result instanceof View) {
        let superResult = this.renderPageView(result, {}, rootElement, initMode, cache, renderLevel + 1);
        return {
            type: 'success',
            view: view,              // page view gốc
            result: result,          // super view (layout)
            superView: superResult?.view,
            finalView: superResult?.finalView  // view cuối cùng (có Wrapper)
        };
    }
    
    // Nếu result là Wrapper → terminal → trả về
    return {
        type: 'success',
        view: view,
        result: result,    // Wrapper
        superView: null,
        finalView: view    // chính nó là final
    };
}
```

### Điều gì xảy ra trong mỗi render()?

**Page view render:**
```javascript
render: function() {
    // 1. Đăng ký block content (KHÔNG render DOM)
    this.block('block-content', 'content', (parentElement) => [
        this.html('div-1', "div", parentElement, {...}, (parentElement) => [...])
    ]);
    
    // 2. Set super view path
    this.superViewPath = 'layouts.base';
    
    // 3. Load & link super view, return View instance
    return this.extendView(this.superViewPath, {});
    //        ↓
    //   - Gọi ViewManager.view('layouts.base', {}, true)
    //   - Tạo/load layout View instance 
    //   - this.setSuperView(layoutCtrl)
    //   - Return layout View → renderPageView nhận diện là View → recurse
}
```

**Layout view render:**
```javascript
render: function() {
    // 1. Tạo Wrapper (chưa build DOM children)
    return this.wrapper((parentElement) => [
        this.html('div-1', "div", parentElement,
            { classes: { "container": { type: 'static', value: true } } },
            (parentElement) => [
                // 2. Đặt BlockOutlet marker cho "content"
                this.blockOutlet("ob-content", "content", parentElement)
            ])
    ]);
    // → Return Wrapper → renderPageView nhận diện không phải View → terminal
}
```

### Trạng thái sau Phase 2

| Thành phần | Trạng thái |
|------------|-----------|
| Page View instance | ✅ Tồn tại, ctrl có blocks registered trong BlockManager |
| Layout View instance | ✅ Tồn tại, ctrl có Wrapper stored (mainElement) |
| Wrapper | ✅ Created nhưng **childrenFactory chưa execute** → children = [] |
| BlockOutlet | ❌ Chưa tạo (nằm trong layout's childrenFactory, chưa chạy) |
| Block content DOM | ❌ Chưa tạo (nằm trong block's contentRenderFactory, chưa chạy) |
| DOM | ❌ Chưa có gì mới trong container |

**Quan trọng**: Sau Phase 2, chỉ có **metadata** (view instances, block registrations, wrapper factories). **Chưa có DOM nào được build.**

---

## 5. Phase 3 — Layout Comparison & Decision

Đây là **trung tâm logic** của mountView — quyết định mount strategy dựa trên layout hiện tại vs layout mới.

### Input

```typescript
const renderResult = this.renderPageView(view, data, ...);
const pageView = renderResult.view;          // Page view gốc
const finalView = renderResult.finalView;    // View cuối cùng (layout hoặc standalone)
const isStandalone = (finalView === pageView && !renderResult.superView);
```

### Ba trường hợp

```
┌──────────────────────────────────────────────────────────┐
│ Case A: FIRST MOUNT                                      │
│ Điều kiện: currentLayoutView === null                    │
│ Hành động: Fresh mount toàn bộ                           │
│                                                          │
│ 1. Build layout DOM (Wrapper.render())                   │
│ 2. Mount blocks (BlockManager.mountAll())                │
│ 3. commitData() cho tất cả views                         │
│ 4. start() cho tất cả views                              │
│ 5. Set currentLayoutView = finalView                     │
│ 6. Set currentPageView = pageView                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Case B: SAME LAYOUT                                      │
│ Điều kiện: finalView instance === currentLayoutView      │
│   (hoặc finalView.__ctrl__.path === currentLayoutPath)   │
│ Hành động: Partial update — chỉ swap page content        │
│                                                          │
│ 1. Stop old page view (stop events, giữ layout DOM)     │
│ 2. Clear block outlets (BlockManager.clearOutlet)        │
│ 3. Cache/destroy old page view (tùy strategy)           │
│ 4. Register new page's blocks trong BlockManager         │
│    (đã xảy ra trong render() Phase 2)                    │
│ 5. Mount new blocks (BlockManager.mountAll())            │
│ 6. commitData() cho new page view                        │
│ 7. Start new page block content                          │
│ 8. Set currentPageView = new pageView                    │
│                                                          │
│ ⚡ Layout DOM KHÔNG bị đụng — performance tối ưu        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Case C: DIFFERENT LAYOUT                                 │
│ Điều kiện: finalView instance !== currentLayoutView      │
│   (layout path khác nhau)                                │
│ Hành động: Full swap — unmount cũ, mount mới             │
│                                                          │
│ 1. Stop old page view                                    │
│ 2. Stop old layout view                                  │
│ 3. Cache old layout (nếu caching enabled)               │
│ 4. Unmount old layout DOM (Wrapper.clear() hoặc          │
│    destroy() tùy caching)                                │
│ 5. Build new layout DOM (Wrapper.render())               │
│ 6. Mount new blocks (BlockManager.mountAll())            │
│ 7. commitData() cho tất cả new views                     │
│ 8. Start tất cả new views                                │
│ 9. Set currentLayoutView = new finalView                 │
│ 10. Set currentPageView = new pageView                   │
└──────────────────────────────────────────────────────────┘
```

### Standalone View (không extends)

```
┌──────────────────────────────────────────────────────────┐
│ Case D: STANDALONE VIEW                                  │
│ Điều kiện: renderResult.superView === null               │
│   (render trả về Wrapper trực tiếp, không qua extends)   │
│ Hành động: Coi như different layout — full swap           │
│                                                          │
│ 1. Stop + unmount everything hiện tại                    │
│ 2. Build standalone Wrapper DOM                          │
│ 3. commitData()                                          │
│ 4. start()                                               │
│ 5. Set currentLayoutView = null (không có layout)        │
│ 6. Set currentPageView = standaloneView                  │
└──────────────────────────────────────────────────────────┘
```

### Pseudocode chi tiết

```typescript
mountView(name, data, route, navigationType) {
    // ── Phase 1: Load ──
    const view = this.view(name, data ?? {}, true);
    if (!view) return null;
    
    const oldPageView = this.currentPageView;
    const oldLayoutView = this.currentLayoutView;
    const oldLayoutPath = this.currentLayoutPath;
    
    view.__ctrl__.urlPath = route?.$urlPath ?? null;
    
    // ── Phase 2: Render chain ──
    const renderResult = this.renderPageView(view, data ?? {}, this.rootElement, 'create', true);
    if (renderResult?.type === 'error') {
        logger.error(renderResult.message);
        return null;
    }
    
    const pageView = renderResult.view;
    const finalView = renderResult.finalView;
    const hasSuperView = !!renderResult.superView;
    const newLayoutPath = hasSuperView ? finalView.__ctrl__.path : null;
    
    // ── Phase 3: Layout comparison ──
    const isFirstMount = !oldLayoutView && !oldPageView;
    const isSameLayout = hasSuperView 
        && oldLayoutView !== null
        && finalView === oldLayoutView;  // same instance (cached)
    const isStandalone = !hasSuperView;
    const isDifferentLayout = !isFirstMount && !isSameLayout;
    
    // ── Cleanup old views ──
    if (!isFirstMount) {
        if (isSameLayout) {
            // Giữ layout, chỉ swap page content
            this.stopPageView(oldPageView);
            this.clearPageBlocks(oldPageView);
            this.cacheOrDestroyPage(oldPageView);
        } else {
            // Full swap
            this.stopPageView(oldPageView);
            this.stopLayoutView(oldLayoutView);
            this.clearAllBlocks();
            this.unmountLayoutDOM(oldLayoutView);
            this.cacheOrDestroyPage(oldPageView);
            this.cacheOrDestroyLayout(oldLayoutView);
        }
    }
    
    // ── Phase 4 & 5: DOM Building + Block Mounting ──
    if (isSameLayout) {
        // Layout DOM đã có → chỉ mount new blocks
        this.blockManager.mountAll();
    } else {
        // Build layout DOM (hoặc standalone DOM)
        this.buildViewDOM(finalView);
        if (hasSuperView) {
            this.blockManager.mountAll();
        }
    }
    
    // ── Phase 6: Commit & Start ──
    this.commitViewChain(pageView, finalView, hasSuperView);
    this.startViewChain(pageView, finalView, hasSuperView);
    
    // ── Update state ──
    this.currentPageView = pageView;
    this.currentLayoutView = hasSuperView ? finalView : null;
    this.currentLayoutPath = newLayoutPath;
    this.currentViewType = hasSuperView ? 'layout' : 'view';
    
    return renderResult;
}
```

---

## 6. Phase 4 — DOM Building

### Vấn đề hiện tại

Sau `renderPageView()`:
- Layout's `Wrapper` đã được tạo nhưng **childrenFactory chưa chạy** → chưa có DOM.
- `Wrapper.render()` hiện tại **rỗng** — cần implement.

### Thiết kế DOM Building Flow

```
ViewManager.buildViewDOM(finalView)
  │
  ├─ Lấy Wrapper từ finalView.__ctrl__.mainElement
  │
  ├─ Set wrapper.parent = this.rootElement  (Html wrapping container)
  │
  └─ wrapper.render()
       │
       ├─ Append openTag (<!--wrapper-start-->) vào parent.element
       │
       ├─ Execute childrenFactory(this.parent)
       │     ↓
       │   Trả về array [Html, Html, BlockOutlet, ...]
       │   Mỗi Html element:
       │     ├─ new Html({...}) → tạo DOM element
       │     ├─ html.render() → append element vào parent
       │     │     └─ Execute childrenFactory(html) → recursive
       │     │           ↓
       │     │         [Html, TextElement, Output, BlockOutlet, ...]
       │     │         Mỗi child.render() → append vào html.element
       │     └─ ...
       │
       │   Mỗi BlockOutlet:
       │     └─ outlet.render() → append openTag + closeTag vào parent
       │          (markers cho block content insertion sau)
       │
       ├─ Store children references: this.children = result
       │
       └─ Append closeTag (<!--wrapper-end-->) vào parent.element
```

### Wrapper.render() — Cần implement

```typescript
render(): void {
    if (!this.parent?.element) return;
    const parentEl = this.parent.element;
    
    // 1. Append start marker
    parentEl.appendChild(this.openTag);
    
    // 2. Execute children factory → build element tree
    if (this.childrenFactory) {
        const children = this.childrenFactory(this.parent);
        if (Array.isArray(children)) {
            this.children = children.flat().filter(Boolean);
            
            // 3. Render each child → DOM insertion
            for (const child of this.children) {
                if (child && typeof child === 'object') {
                    if ('element' in child && child.element instanceof Node) {
                        // Html, TextElement — insert DOM element
                        parentEl.insertBefore(child.element, this.closeTag);
                    }
                    if ('render' in child && typeof child.render === 'function') {
                        child.render();
                    }
                }
            }
        }
    }
    
    // 4. Append end marker
    parentEl.appendChild(this.closeTag);
}
```

### Html.render() — DOM tree building

Mỗi `Html` element khi được tạo trong factory:
1. Constructor tạo `document.createElement(tagName)`
2. Append element vào parent DOM
3. Apply attributes, classes, styles
4. Execute childrenFactory → recursive child creation

```
containerEl (real DOM, ví dụ: <div id="app">)
  ├── <!--wrapper-start-->
  ├── <div class="container">           ← Layout Html #1
  │     ├── <header>                    ← Layout Html #2
  │     │     └── "My App"              ← TextElement
  │     ├── <main>                      ← Layout Html #3
  │     │     ├── <!--block-outlet-content-start-->
  │     │     │   ├── <div class="page-header">     ← Block content Html
  │     │     │   │     └── <h1>{{ title }}</h1>     ← Reactive Output
  │     │     │   └── <div class="page-body">       ← Block content Html
  │     │     │         └── ...
  │     │     └── <!--block-outlet-content-end-->
  │     └── <footer>                    ← Layout Html #4
  │           └── "© 2025"
  └── <!--wrapper-end-->
```

---

## 7. Phase 5 — Block Mounting

### Hiện tại (đã implement trong BlockManager)

```typescript
// BlockManager.mountAll()
mountAll(): void {
    for (const [name, block] of this.activeBlocks) {
        for (const [outletKey, outlet] of this.blockOutlets) {
            if (outletKey.endsWith(`:${name}`) || outlet.name === name) {
                this.mountBlockIntoOutlet(block, outlet);
                break;
            }
        }
    }
}

// mountBlockIntoOutlet()
mountBlockIntoOutlet(block, outlet): void {
    const content = block.contentRenderFactory!(block.ctx);
    // Insert each child between outlet markers
    for (const child of content) {
        if ('element' in child) {
            parentEl.insertBefore(child.element, outlet.closeTag);
            child.render();
        } else if ('openTag' in child) {
            child.render();
        }
    }
    this.mountedChildren.set(outlet.name, children);
}
```

### Timing quan trọng

```
Timeline:
  ┌────────────────────────────────────────────────┐
  │ Phase 2: Page render()                          │
  │   this.block('content', factory)                │
  │   → BlockManager.add(block)                     │
  │   → BlockManager.active('content', viewId)     │
  │   Block đã đăng ký nhưng factory CHƯA chạy     │
  └────────────────────────────────────────────────┘
               ↓
  ┌────────────────────────────────────────────────┐
  │ Phase 2: Layout render() (recursive)            │
  │   this.blockOutlet('content', parentElement)    │
  │   → BlockOutlet created (CHƯA render markers)  │
  │   → BlockManager.addOutlet(key, outlet)        │
  └────────────────────────────────────────────────┘
               ↓
  ┌────────────────────────────────────────────────┐
  │ Phase 4: Layout Wrapper.render()                │
  │   → childrenFactory chạy                        │
  │   → Html elements tạo DOM                       │
  │   → BlockOutlet.render() places markers         │
  │   → Outlet markers now in DOM                  │
  └────────────────────────────────────────────────┘
               ↓
  ┌────────────────────────────────────────────────┐
  │ Phase 5: BlockManager.mountAll()                │
  │   → Tìm matching outlet cho mỗi active block   │
  │   → Gọi block.contentRenderFactory(ctx)         │
  │   → Insert DOM children giữa outlet markers     │
  │   → Block content giờ hiện trong DOM            │
  └────────────────────────────────────────────────┘
```

### Partial Update (Same Layout — Case B)

Khi cùng layout, chỉ swap block content:

```typescript
// 1. Clear old block content từ outlets
blockManager.clearOutlet('content');
// → Destroy old page's mounted children
// → Remove DOM nodes giữa outlet markers

// 2. Deactivate old blocks
// (old page's blocks vẫn trong BlockManager.blocks nhưng không active)

// 3. New page render() đã đăng ký new blocks + activate
// (xảy ra trong Phase 2)

// 4. Mount new blocks
blockManager.mountAll();
// → New block content inserted giữa outlet markers
```

---

## 8. Phase 6 — Data Commit & Start

### Commit Data

`commitData()` gọi `commitConstructorData()` (compiled function) để set initial state values.

**Thứ tự**: Layout commit trước, Page commit sau (top-down).

```typescript
commitViewChain(pageView, finalView, hasSuperView): void {
    if (hasSuperView) {
        // Commit layout first
        finalView.__ctrl__.commitData();
        // Then commit page
        pageView.__ctrl__.commitData();
    } else {
        pageView.__ctrl__.commitData();
    }
}
```

### Start — Activate Reactive Subscriptions

`start()` kích hoạt reactive subscriptions cho toàn bộ element tree.

**Vấn đề hiện tại**: `ViewController.start()` dựa vào `_rootTree` nhưng `_rootTree` **chưa bao giờ được assign**.

**Giải pháp**: ViewManager phải set `_rootTree` sau DOM building:

```typescript
// Sau Phase 4 (DOM Building):
finalView.__ctrl__._rootTree = finalView.__ctrl__.mainElement;  // Wrapper

// Hoặc accessor nếu _rootTree là private:
finalView.__ctrl__.setRootTree(finalView.__ctrl__.mainElement);
```

### Start Flow — khác nhau cho layout vs page

**Layout view** (có Wrapper):
```
ViewController.start()
  → _rootTree.start()        // Wrapper.start()
    → child.start() for each  // Html.start(), Output.start(), Reactive.start()
       → recursive...
  → view.onMounted()
```

**Page view** (extends, content trong blocks):
```
Vấn đề: Page view không có _rootTree riêng.
Content của nó nằm trong BlockManager.mountedChildren.

Giải pháp: Start block content explicitly.
```

### Thiết kế Start cho Page View (extends)

```typescript
startViewChain(pageView, finalView, hasSuperView): void {
    if (hasSuperView) {
        // 1. Start layout element tree (Wrapper và con cháu)
        this.startView(finalView);
        
        // 2. Start page's block content (đã mount trong outlets)
        this.startBlockContent(pageView);
        
        // 3. Fire page's onMounted hook
        if (typeof pageView.onMounted === 'function') {
            pageView.onMounted();
        }
    } else {
        this.startView(pageView);
    }
}

startView(view): void {
    const ctrl = view.__ctrl__;
    const tree = ctrl.mainElement;  // Wrapper
    if (tree && typeof tree.start === 'function') {
        tree.start();
    }
    if (typeof view.onMounted === 'function') {
        view.onMounted();
    }
}

startBlockContent(pageView): void {
    // Block content children đã được track bởi BlockManager
    for (const [name, children] of this.blockManager.mountedChildren) {
        for (const child of children) {
            if ('start' in child && typeof child.start === 'function') {
                child.start();
            }
        }
    }
}
```

### Stop Flow — tương tự ngược lại

```typescript
stopPageView(pageView): void {
    if (!pageView) return;
    
    // Stop block content
    this.stopBlockContent(pageView);
    
    // Fire onDeactivated
    if (typeof pageView.onDeactivated === 'function') {
        pageView.onDeactivated();
    }
}

stopLayoutView(layoutView): void {
    if (!layoutView) return;
    const tree = layoutView.__ctrl__.mainElement;
    if (tree && typeof tree.stop === 'function') {
        tree.stop();
    }
    if (typeof layoutView.onDeactivated === 'function') {
        layoutView.onDeactivated();
    }
}
```

---

## 9. Caching Strategy

### Mục tiêu

- Navigate back/forward: layout/page đã render trước đó → **reuse** thay vì tạo mới.
- Giảm thiểu DOM manipulation.
- Quản lý memory — không cache vô hạn.

### Các tầng cache

```
┌─────────────────────────────────────────────────┐
│ Layer 1: View Instance Cache (StoreService)      │
│                                                  │
│ Key: view path (e.g. 'web.home')                │
│ Value: View instance                             │
│ Scope: ViewManager.store (shared singleton)      │
│                                                  │
│ ✅ ViewManager.view(name, data, cache=true)      │
│    → store.set(name, view)                       │
│ ✅ Đã implement                                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Layer 2: Layout DOM Cache (cachedLayouts Map)    │
│                                                  │
│ Key: layout path (e.g. 'layouts.base')          │
│ Value: Layout View (with intact DOM)             │
│ Scope: ViewManager.cachedLayouts                 │
│                                                  │
│ Khi layout bị swap (Case C):                    │
│   - stop() layout (pause reactivity)            │
│   - Detach layout DOM (remove from container)   │
│   - Cache trong cachedLayouts                    │
│                                                  │
│ Khi navigate về layout cũ:                       │
│   - Lấy từ cache                                │
│   - Re-attach DOM vào container                  │
│   - start() (re-activate reactivity)            │
│                                                  │
│ 🔧 Cần implement                                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Layer 3: Block Content Cache                     │
│                                                  │
│ Khi page bị swap (same layout):                 │
│   - stop() block content children               │
│   - Detach block content (clearOutlet giữ ref?) │
│   - Cache page view instance (Layer 1)          │
│                                                  │
│ Khi navigate về page cũ (same layout):          │
│   - Restore block content từ cache              │
│   - Re-mount vào outlets                        │
│   - start() block content                       │
│                                                  │
│ ⚠️ Phức tạp — Phase 2 implement                │
└─────────────────────────────────────────────────┘
```

### Cache Decision Tree

```
Navigate to new route:
  │
  ├─ View instance cached? (store.has(name))
  │    ├─ YES → reuse instance, updateData if needed
  │    │         ViewController giữ nguyên, blocks/wrapper giữ nguyên
  │    │         → Re-render? KHÔNG — dùng existing mainElement
  │    └─ NO → create new instance via factory
  │
  ├─ Layout cached? (cachedLayouts.has(layoutPath))
  │    ├─ YES → re-attach layout DOM
  │    │         → Wrapper.render() BỎ QUA (DOM đã có)
  │    │         → Chỉ mount new page blocks
  │    └─ NO → build layout DOM from scratch
  │
  └─ Page cached with DOM? (future)
       ├─ YES → restore cached block content
       └─ NO → mount blocks, build from scratch
```

### Cache Invalidation

```
Khi nào xóa cache:
1. Memory pressure → LRU eviction (evict layout/page ít dùng nhất)
2. Explicit: view.destroy() → xóa khỏi store
3. Full navigation away → destroy page view nếu không cache
4. Config: maxCachedLayouts, maxCachedPages (configurable)

Mặc định nên:
- Cache tất cả layouts (ít, thường 2-3 layouts)
- Cache N page views gần nhất (ví dụ: 5-10)
- LRU eviction khi vượt limit
```

### Phân biệt: Cached View + Re-render vs Cached View + Reuse DOM

**Scenario A**: Navigate `/home` → `/about` → `/home` (cùng layout)
```
Lần 1: /home → render page, build DOM, mount blocks
        → cache page view instance
Lần 2: /about → stop page /home → clear blocks
        → render /about page (hoặc cached), mount blocks
Lần 3: /home → stop page /about → clear blocks
        → Page /home: cached instance EXISTS
        → Có 2 options:
          Option 1: Re-render (gọi lại render() + mount blocks)
                    → Tốn CPU nhưng đảm bảo state mới nhất
          Option 2: Restore cached DOM (re-attach old nodes)
                    → Nhanh nhưng cần quản lý node references
        → Khuyến nghị Phase 1: Option 1 (re-render)
        → Khuyến nghị Phase 2: Option 2 (optimize với DOM cache)
```

---

## 10. Cleanup & Unmount Logic

### unmountLayoutDOM — Detach layout từ container

```typescript
unmountLayoutDOM(layoutView): void {
    if (!layoutView) return;
    const wrapper = layoutView.__ctrl__.mainElement;
    if (!wrapper) return;
    
    // Option A: Destroy (nếu không cache)
    wrapper.destroy();
    // → clear children, remove markers, null parent
    
    // Option B: Detach (nếu cache)
    // Remove all DOM nodes giữa markers (và markers) khỏi container
    // Nhưng KHÔNG destroy children — giữ references cho re-attach
    this.detachWrapper(wrapper);
}

detachWrapper(wrapper): void {
    const parent = wrapper.parent?.element;
    if (!parent) return;
    
    // Collect all nodes from openTag to closeTag
    const fragment = document.createDocumentFragment();
    let current = wrapper.openTag;
    while (current) {
        const next = current.nextSibling;
        fragment.appendChild(current);
        if (current === wrapper.closeTag) break;
        current = next;
    }
    
    // Store fragment for re-attach later
    wrapper._cachedFragment = fragment;
}
```

### Re-attach cached layout

```typescript
reattachWrapper(wrapper, parentElement): void {
    if (wrapper._cachedFragment) {
        parentElement.element.appendChild(wrapper._cachedFragment);
        wrapper._cachedFragment = null;
        wrapper.parent = parentElement;
    }
}
```

### Full unmount flow

```typescript
unmountAll(): void {
    // 1. Stop everything
    this.stopPageView(this.currentPageView);
    this.stopLayoutView(this.currentLayoutView);
    
    // 2. Clear blocks
    this.blockManager.clearAllOutlets();
    
    // 3. Destroy page view
    if (this.currentPageView) {
        this.currentPageView.__ctrl__.destroy();
    }
    
    // 4. Destroy layout view
    if (this.currentLayoutView) {
        this.currentLayoutView.__ctrl__.destroy();
    }
    
    // 5. Clear container DOM
    if (this.container) {
        this.container.innerHTML = '';
    }
    
    // 6. Reset state
    this.currentPageView = null;
    this.currentLayoutView = null;
    this.currentLayoutPath = null;
    this.activeViews.clear();
    this.viewStack = [];
    
    // 7. Destroy BlockManager
    this.blockManager.destroy();
}
```

---

## 11. Edge Cases

### 11.1 Navigate tới cùng page, khác params

```
/users/1 → /users/2 (cùng route pattern, cùng view 'web.users.show')

- View instance: SAME (cached)
- Layout: SAME
- Data: DIFFERENT (params changed)

Flow: 
  1. view = this.view('web.users.show', {id: 2}, true) → cached, updateData({id: 2})
  2. render() → blocks updated (vì state changed)
     NHƯNG: render() tạo lại elements HAY reuse?
     → Nếu elements có id → reuse (ViewController.html() checks existing)
     → Nếu state triggers reactive update → Output re-renders
  3. Chỉ cần: updateData → reactive state change → automatic re-render via RAF
     → KHÔNG cần remount!

Giải pháp: Detect same view + different data → skip mount, chỉ updateData.
```

```typescript
// Trong mountView():
if (this.currentPageView === view && isSameLayout) {
    // Same view, same layout — just update data
    view.__ctrl__.updateData(data ?? {});
    view.__ctrl__.urlPath = route?.$urlPath ?? null;
    // Reactive system sẽ tự update DOM via RAF
    return;
}
```

### 11.2 Navigate tới cùng page, cùng params (duplicate navigation)

```
/home → /home (nhấn link home lần nữa)

Flow: Skip entirely — no action needed.
```

```typescript
if (this.currentPageView?.__ctrl__.path === name 
    && view.__ctrl__.urlPath === route?.$urlPath) {
    return; // No-op
}
```

### 11.3 Standalone → Extends (và ngược lại)

```
/login (standalone) → /dashboard (extends admin-layout)

- Old: standalone view (no layout)
- New: extends view (có layout)

Flow: Treat as Case C (full swap).
  1. Destroy standalone view + DOM
  2. Build layout DOM
  3. Mount page blocks  
  4. Start
```

### 11.4 Back/Forward navigation (popstate)

```
/home → /about → /contact → [Back] → /about → [Back] → /home

navigationType sẽ là 'pop' thay vì 'push'.
Với caching: page views đã cached → reuse nhanh.
Không khác gì navigation bình thường, chỉ khác navigationType.
```

### 11.5 Async data loading (hasAwaitData / hasFetchData)

```
View có fetchData config:
  render() → cần fetch data xong mới render

Flow:
  1. Prerender (skeleton/loading)
  2. Fetch data
  3. Render with data
  4. Mount

⚠️ Chưa implement trong renderPageView — có check nhưng chưa xử lý.
   Cần xử lý riêng sau — không block Phase 1 mountView.
```

### 11.6 Nested extends (3+ levels)

```
Page → AdminLayout → BaseLayout

renderPageView() đã xử lý recursive.
finalView = BaseLayout (cuối chain).
BlockManager cần handle multiple block names:
  - Page registers block 'content'
  - AdminLayout registers block 'body' + outlet 'content'
  - BaseLayout has outlet 'body'

Flow:
  Phase 4: BaseLayout Wrapper.render() → tạo DOM + blockOutlet('body')
  Phase 5: 
    1. BlockManager.mountAll() cho 'body' block (AdminLayout content)
       → Insert AdminLayout content vào BaseLayout outlet
       → AdminLayout content có blockOutlet('content') → tạo outlet markers
    2. BlockManager.mountAll() cho 'content' block (Page content)
       → Insert Page content vào AdminLayout outlet

⚠️ Cần verify: mountAll() gọi 1 lần hay cần sequential?
   → Có thể cần gọi lần lượt theo thứ tự chain:
      mountBlocks(BaseLayout) → mountBlocks(AdminLayout) → Page blocks tự insert
```

### 11.7 Layout có reactive content riêng

```
Layout có {{ appName }}, {{ year }}, navigation highlighting, v.v.
Khi same layout — start/stop phải giữ layout reactive active.

Flow Case B (same layout):
  - KHÔNG stop layout view
  - Chỉ stop old page blocks
  - Layout continue reactive → header/nav/footer giữ nguyên
```

---

## 12. Trạng thái hiện tại & TODO

### Đã implement ✅

| Component | Method | Status |
|-----------|--------|--------|
| ViewManager | `view()` — load/cache view instance | ✅ |
| ViewManager | `renderPageView()` — recursive extends chain | ✅ |
| ViewController | `render()` — invoke renderFactory | ✅ |
| ViewController | `extendView()` — load super view, link controllers | ✅ |
| ViewController | `block()` — register block in BlockManager | ✅ |
| ViewController | `blockOutlet()` — create outlet element | ✅ |
| ViewController | `wrapper()` — create/reuse Wrapper | ✅ |
| ViewController | `start()` / `stop()` / `destroy()` — lifecycle (cần _rootTree) | ✅ (partial) |
| BlockManager | `add()` / `active()` / `subscribe()` | ✅ |
| BlockManager | `mountAll()` / `mountBlockIntoOutlet()` | ✅ |
| BlockManager | `clearOutlet()` / `clearAllOutlets()` / `destroy()` | ✅ |
| Wrapper | Constructor, `start()`, `stop()`, `clear()`, `destroy()` | ✅ |

### Cần implement 🔧

| Component | Method/Logic | Priority | Mô tả |
|-----------|-------------|----------|--------|
| **ViewManager** | `mountView()` — main orchestration | P0 | Phase 3–6 logic |
| **Wrapper** | `render()` — DOM building | P0 | Execute childrenFactory, insert DOM |
| **ViewManager** | `stopPageView()` | P0 | Stop page blocks content |
| **ViewManager** | `stopLayoutView()` | P0 | Stop layout wrapper tree |
| **ViewManager** | `startViewChain()` | P0 | Start layout + page blocks |
| **ViewManager** | `commitViewChain()` | P0 | commitData for all views |
| **ViewManager** | `buildViewDOM()` | P0 | Wrapper.render() + DOM insertion |
| **ViewManager** | `clearPageBlocks()` | P0 | BlockManager.clearOutlet for page blocks |
| **ViewManager** | `unmountLayoutDOM()` | P1 | Remove layout DOM from container |
| **ViewManager** | `unmountAll()` | P1 | Full cleanup |
| **ViewManager** | `unmountView()` | P1 | Single view cleanup |
| **ViewManager** | Layout DOM cache / reattach | P2 | detachWrapper / reattachWrapper |
| **ViewManager** | Same-view-diff-params detection | P1 | Skip remount, just updateData |
| **ViewManager** | Duplicate navigation detection | P1 | No-op for same route |
| **ViewController** | `_rootTree` assignment | P0 | Set after DOM building |
| **ViewController** | `commitData()` | P1 | Call commitConstructorData |
| **BlockManager** | `startBlockContent()` | P0 | Start mounted children |
| **BlockManager** | `stopBlockContent()` | P0 | Stop mounted children |
| **BlockManager** | Sequential mounting for nested extends | P2 | Handle 3+ level chains |

### Cần sửa ⚠️

| Issue | Component | Mô tả |
|-------|-----------|--------|
| `_rootTree` never assigned | ViewController | start()/stop() luôn no-op vì _rootTree = null |
| `Wrapper.render()` empty | Wrapper | Không build DOM children |
| BlockManager.mountedChildren private | BlockManager | Cần expose hoặc add start/stop methods |
| `commitData()` empty | ViewController | Cần gọi commitConstructorData từ runtimeConfig |

---

## 13. Sequence Diagrams

### Case A: First Mount (Page extends Layout)

```
Router          ViewManager         ViewController(Page)    ViewController(Layout)    BlockManager
  │                 │                       │                        │                     │
  │ mountView()     │                       │                        │                     │
  ├────────────────►│                       │                        │                     │
  │                 │ view(name,data,true)   │                        │                     │
  │                 ├──────────────────────► │ new View()             │                     │
  │                 │                       │ $__setup__()           │                     │
  │                 │◄──────────────────────┤ return view            │                     │
  │                 │                       │                        │                     │
  │                 │ renderPageView(view)   │                        │                     │
  │                 ├──────────────────────►│                        │                     │
  │                 │                       │ ctrl.render()          │                     │
  │                 │                       ├─── block('content',f)──┼────────────────────►│ add(block)
  │                 │                       │                        │                     │ active('content')
  │                 │                       │ extendView('layout')   │                     │
  │                 │                       ├───────────────────────►│ new View()          │
  │                 │                       │                        │ $__setup__()        │
  │                 │                       │ setSuperView()         │                     │
  │                 │                       │◄─ return layoutView ───┤                     │
  │                 │                       │                        │                     │
  │                 │ renderPageView(layout) │                       │                     │
  │                 ├──────────────────────────────────────────────►│                     │
  │                 │                       │                        │ ctrl.render()       │
  │                 │                       │                        │ wrapper(factory)    │
  │                 │                       │                        │◄─ return Wrapper    │
  │                 │◄──────────────────────────────────────────────┤                     │
  │                 │ renderResult = {finalView: layout}            │                     │
  │                 │                       │                        │                     │
  │                 │──── Phase 3: isFirstMount = true ────│        │                     │
  │                 │                       │                        │                     │
  │                 │──── Phase 4: buildViewDOM(layout) ───│        │                     │
  │                 │                       │                        │ wrapper.render()    │
  │                 │                       │                        │ → childrenFactory() │
  │                 │                       │                        │ → Html.render()     │
  │                 │                       │                        │ → BlockOutlet.render()
  │                 │                       │                        │   └──────────────►│ addOutlet()
  │                 │                       │                        │                     │
  │                 │──── Phase 5: BlockManager.mountAll() ─────────────────────────────►│
  │                 │                       │                        │                     │ match blocks→outlets
  │                 │                       │                        │                     │ mountBlockIntoOutlet()
  │                 │                       │                        │                     │ → render block DOM
  │                 │                       │                        │                     │
  │                 │──── Phase 6: commitData + start ──────│       │                     │
  │                 │                       │ commitData()   │ commitData()                │
  │                 │                       │ startBlocks    │ wrapper.start()             │
  │                 │                       │ onMounted()    │ onMounted()                 │
  │                 │                       │                        │                     │
  │◄────────────────┤ done                  │                        │                     │
```

### Case B: Same Layout — Page Swap

```
Router          ViewManager         Old Page    New Page    Layout    BlockManager
  │                 │                  │           │          │           │
  │ mountView()     │                  │           │          │           │
  ├────────────────►│                  │           │          │           │
  │                 │ view(name,true)  │           │          │           │
  │                 ├─────────────────────────────►│          │           │
  │                 │                  │           │◄─────────│           │
  │                 │ renderPageView() │           │          │           │
  │                 ├─────────────────────────────►│ render() │           │
  │                 │                  │           │ block()──┼──────────►│ add+active
  │                 │                  │           │ extendView()         │
  │                 │                  │           │──────────►│ (cached) │
  │                 │                  │           │◄──────────│          │
  │                 │◄─────────res ───────────────│           │          │
  │                 │                  │           │          │           │
  │                 │ Phase 3: isSameLayout === true          │           │
  │                 │                  │           │          │           │
  │                 │ stopPageBlocks() │           │          │           │
  │                 ├─────────────────►│ stop children        │           │
  │                 │                  │           │          │           │
  │                 │ clearOutlet('content') ─────────────────────────►│
  │                 │                  │           │          │   │ remove DOM
  │                 │                  │           │          │   │ destroy children
  │                 │                  │           │          │           │
  │                 │ mountAll() ──────────────────────────────────────►│
  │                 │                  │           │          │   │ mount new blocks
  │                 │                  │           │          │   │ render DOM
  │                 │                  │           │          │           │
  │                 │ commitData + startBlocks ───►│          │           │
  │                 │                  │           │ start()  │           │
  │                 │                  │           │ mounted  │           │
  │◄────────────────┤                  │           │          │           │
  │                 │                  │           │          │           │
  │                 │  Layout DOM KHÔNG bị thay đổi! ⚡       │           │
```

### Case C: Different Layout — Full Swap

```
Router          ViewManager         Old All    New Page    New Layout    BlockManager
  │                 │                  │          │            │              │
  │ mountView()     │                  │          │            │              │
  ├────────────────►│                  │          │            │              │
  │                 │ renderPageView() │          │            │              │
  │                 ├─────────────────────────────►│ render()  │              │
  │                 │                  │          │ block()───┼─────────────►│
  │                 │                  │          │ extendView()              │
  │                 │                  │          │           ►│ render()     │
  │                 │                  │          │            │ wrapper()    │
  │                 │◄───────── renderResult ─────│            │              │
  │                 │                  │          │            │              │
  │                 │ Phase 3: isDifferentLayout               │              │
  │                 │                  │          │            │              │
  │                 │ stop old page    │          │            │              │
  │                 ├─────────────────►│ stop     │            │              │
  │                 │ stop old layout  │          │            │              │
  │                 ├─────────────────►│ stop     │            │              │
  │                 │ clearAllOutlets  ──────────────────────────────────────►│  
  │                 │ unmount old DOM  │          │            │              │
  │                 ├─────────────────►│ clear/detach          │              │
  │                 │ cache old layout │          │            │              │
  │                 │                  │          │            │              │
  │                 │ buildViewDOM()   │          │            │              │
  │                 ├─────────────────────────────────────────►│ wrapper.render()
  │                 │                  │          │            │ → DOM building
  │                 │                  │          │            │ → outlets placed
  │                 │                  │          │            │              │
  │                 │ mountAll() ───────────────────────────────────────────►│
  │                 │                  │          │            │   mount blocks│
  │                 │                  │          │            │              │
  │                 │ commitData + start ─────────│            │              │
  │                 │                  │          │ start      │ start        │
  │◄────────────────┤                  │          │            │              │
```

---

## Phụ lục A: Compiled Output Analysis

### Page View (extends) — Render Factory Anatomy

```javascript
// File: demo2-extends.js
render: function () {
    // Step 1: Đăng ký block content (factory stored, NOT executed)
    this.block('block-content', 'content', (parentElement) => [
        // Đây là contentRenderFactory — sẽ được BlockManager gọi sau
        this.html('div-section-heading', "div", parentElement, {
            classes: { "section-heading": { type: 'static', value: true } }
        }, (parentElement) => [
            this.html('h2-1', "h2", parentElement, {}, (parentElement) => [
                this.output('out-1', parentElement, () => this.view.title)
            ]),
            // ... more elements
        ]),
        // ... more elements
    ]);

    // Step 2: Set super view path
    this.superViewPath = App.Helper.execute(() => `${__layout__ + 'base'}`);

    // Step 3: Load super view, link controllers, return View instance
    return this.extendView(this.superViewPath, {});
}
```

### Layout View — Render Factory Anatomy

```javascript
// File: demo2-layout.js
render: function () {
    // Returns Wrapper directly — terminal view
    return this.wrapper((parentElement) => [
        this.html('div-1', "div", parentElement,
            { classes: { "container": { type: 'static', value: true } } },
            (parentElement) => [
                // BlockOutlet — comment markers for block insertion point
                this.blockOutlet("ob-content", "content", parentElement)
            ]
        )
    ]);
}
```

## Phụ lục B: DOM State at Each Phase

```html
<!-- Phase 0: Initial -->
<div id="app"></div>

<!-- Phase 4: After Wrapper.render() -->
<div id="app">
  <!--wrapper-start-->
  <div class="container">
    <!--block-outlet-content-start-->
    <!--block-outlet-content-end-->
  </div>
  <!--wrapper-end-->
</div>

<!-- Phase 5: After BlockManager.mountAll() -->
<div id="app">
  <!--wrapper-start-->
  <div class="container">
    <!--block-outlet-content-start-->
    <div class="section-heading">
      <h2>{{ title }}</h2>
    </div>
    <div class="section-body">
      <p>{{ content }}</p>
    </div>
    <!--block-outlet-content-end-->
  </div>
  <!--wrapper-end-->
</div>

<!-- Phase 6: After start() — same DOM, reactive subscriptions active -->
<!-- Output elements now listen for state changes and auto-update -->
```

## Phụ lục C: Quyết định thiết kế cần thảo luận

### C.1: Layout comparison — instance check vs path check?

**Option A**: `finalView === currentLayoutView` (reference equality)
- Pro: Chính xác, nhanh
- Con: Nếu layout bị tạo mới (cache miss), sẽ false dù cùng path

**Option B**: `finalView.__ctrl__.path === currentLayoutPath` (path equality)
- Pro: Works kể cả khi instance khác
- Con: Chưa chắc cùng path = cùng layout (dynamic layouts?)

**Khuyến nghị**: Dùng **cả hai**: instance check trước, path check fallback.

```typescript
const isSameLayout = (finalView === oldLayoutView) 
    || (finalView.__ctrl__.path === oldLayoutPath);
```

### C.2: Khi same layout, có cần re-render layout không?

**Không** — layout DOM giữ nguyên. Layout reactive content vẫn active.
Chỉ clear + remount page blocks.

### C.3: BlockManager — singleton hay per-layout?

**Hiện tại**: Singleton (`export const BlockManager = new BlockManagerService()`).
- Pro: Đơn giản, easy access
- Con: Khi swap layout, phải cleanup all blocks/outlets manually

**Khuyến nghị giữ singleton**, nhưng thêm methods:
- `clearBlocksForView(viewId)` — xóa blocks của 1 view cụ thể
- `clearOutletsForView(viewId)` — xóa outlets của 1 layout cụ thể

### C.4: Start order — layout trước hay page trước?

**Layout trước** (top-down):
1. Layout wrapper.start() → activate layout reactive (header, nav, footer)
2. Block content start() → activate page reactive
3. Page onMounted()

Lý do: Layout DOM cần active trước để ensure structure stable khi page content starts.

---

> **Document version**: 1.0  
> **Last updated**: Phase 1 design — pre-implementation  
> **Next step**: Implement mountView() Phase 1 (P0 items) theo thiết kế này
