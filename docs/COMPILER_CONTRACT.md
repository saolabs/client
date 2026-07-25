# Compiler ↔ Client Runtime Contract

**Phiên bản**: 0.1 — Phase 4 alignment  
**Cập nhật**: 2026-06-13  
**Tham chiếu**: `compiler/examples/js/`, `client/tests/contract/`

Tài liệu này mô tả **các pattern chính xác** mà compiler (.sao → JS) sinh ra,
và **những gì client runtime phải hỗ trợ**. Mỗi pattern có section riêng,
kèm ví dụ compiler output và contract test tương ứng.

---

## §1. State Registration — `register(key)` với 1 argument

### Compiler output
```js
const set$count   = __STATE__.__.register('count');
const set$message = __STATE__.__.register('message');
```

Compiler **không** truyền initial value vào `register()`. Chỉ khai báo slot.

### Initial value — qua `commitConstructorData`
```js
commitConstructorData() {
    update$count(0);          // → updateStateByKey('count', 0)
    update$message('Hello!'); // → updateStateByKey('message', 'Hello!')
    lockUpdateRealState();    // → StateManager.lockUpdateRealState()
}
```

### Client fix (Phase 4)
```ts
// ViewState.ts — trước khi fix: value: any (required)
// Sau fix:
register(key: string | number, value?: any): (newValue: any) => void {
    return this.useState(value, key)[1];
}
```

### Contract test
`tests/contract/counter.contract.test.ts` — "register(key) 1-arg"

---

## §2. `commitConstructorData` / `lockUpdateRealState` flow

### Pattern đầy đủ
```js
const update$xxx = (value) => {
    if (__STATE__.__.canUpdateStateByKey) {
        __STATE__.__.updateStateByKey('xxx', value);
        xxx = value;   // cập nhật closure var để render dùng
    }
};

commitConstructorData() {
    update$status(false);
    update$user({ name: 'Jane' });
    lockUpdateRealState();  // khóa, không cho update nữa
}
```

### Quy tắc
- `canUpdateStateByKey` bắt đầu là `true` (StateManager vừa tạo)
- Sau `lockUpdateRealState()` → `false`
- `updateVariableData()` gọi `unlockUpdateRealState()` trước, lock lại sau

### Contract test
`tests/contract/counter.contract.test.ts` — "register(key) 1-arg: state slot..."

---

## §3. Setter closure — compiler pattern

Compiler tạo closure var + setter tổng quát:
```js
let count = null;
const setCount = (state) => { count = state; set$count(state); };
__STATE__.__.setters.setCount = setCount;
__STATE__.__.setters.count    = setCount; // alias cho @bind
```

Cả `setCount` và `count` (lowercase key) đều được expose lên `setters` map.  
Client dùng `setters[key]` khi resolve event handler, @bind update.

---

## §4. Named event handler vs inline lambda

### Named handler (compiler default)
```js
events: { click: [{ handler: 'increment', params: [] }] }
```
- `handler`: tên method trong `userDefinedConfig`
- `params`: array extra params (thường `[]`)
- Client resolve: `ctrl.userDefinedConfig[handler](...params)`

### Inline lambda (khi body quá đơn giản)
```js
events: { click: [(event) => setStatus(!status)] }
```
- Là arrow function, client gọi trực tiếp với `(event)`

### Client phải hỗ trợ cả hai dạng trong một array:
```js
events: { click: [handler1, handler2, ...] }
// handler: { handler: string, params: any[] } | ((event: Event) => void)
```

### Contract test
`tests/contract/counter.contract.test.ts` — "named event handler"  
`tests/contract/layout.contract.test.ts` — "inline event handler"

---

## §5. Two-way binding — `@bind` directive

### Compiler output pattern
```js
attrs: {
    "type":    { type: 'static', value: "text" },
    "bind":    { type: 'static', value: true },   // sentinel
    "newTodo": { type: 'static', value: true },   // state key
}
```

### Client detection logic
1. Tìm `attrs['bind']?.type === 'static' && attrs['bind']?.value === true`
2. Tìm key khác `'bind'` có `type: 'static', value: true` → đây là state key
3. Gọi `setupTwoWayBinding(stateKey)`
4. **KHÔNG** set `bind` hay `<stateKey>` lên DOM attributes

### Hành vi sau khi setup
| Direction | Trigger | Action |
|---|---|---|
| state → DOM | state change | `element.value = newVal` |
| DOM → state | `input` event (text) hoặc `change` event (checkbox) | `setter(target.value)` |

### Contract test
`tests/contract/bind.contract.test.ts` — "bind/stateKey attrs KHÔNG xuất hiện..."

---

## §6. camelCase attr normalization

Compiler emit HTML attribute names theo camelCase khi parsed từ template:
```js
attrs: {
    "dataCount": { type: 'binding', factory: () => count, stateKeys: ['count'] },
    "ariaLabel": { type: 'static', value: 'close' },
}
```

DOM yêu cầu `data-count` và `aria-label`. Client phải normalize:
```ts
// Html.ts — normalizeAttrName()
'dataCount'  → 'data-count'
'ariaLabel'  → 'aria-label'
'ariaHidden' → 'aria-hidden'
```

**Quy tắc**: `data[A-Z]xxx` → `data-xxx`; `aria[A-Z]xxx` → `aria-xxx`.  
Các attr khác (`id`, `class`, `href`, `type`, ...) giữ nguyên.

### Contract test
`tests/contract/bind.contract.test.ts` — "dataCount → data-count"

---

## §7. `App.View.generateViewId()`

Mỗi compiled View constructor gọi:
```js
const __VIEW_ID__ = App.View.generateViewId();
```

Trả về unique string (dùng làm element/marker ID prefix để tránh collision khi
cùng view mount nhiều instance).

### Client fix (Phase 4)
```ts
// ViewManager.ts
generateViewId(): string {
    return `v${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
```

### Contract test
`tests/contract/counter.contract.test.ts` — "App.View.generateViewId()"

---

## §8. `App.Helper.count(arr)`

Compiler emit `App.Helper.count(posts)` bên trong `@if` / `@foreach`:
```js
if (App.Helper.count(posts) === 0) { ... }
```

`HelperService.count()` — PHP-compatible, đã implement:
- Array → `arr.length`
- Object → `Object.keys(obj).length`
- null/undefined → `0`
- string → `str.length`

**Không cần thay đổi client**. Chỉ cần đảm bảo `App.Helper` được bind trước khi view mount.

### Contract test
`tests/contract/layout.contract.test.ts` — "App.Helper.count() dùng trong @if"

---

## §9. Layout extends — `extendView(path, {})`

Compiler luôn truyền object rỗng làm arg thứ 2:
```js
this.superViewPath = 'examples.demo2-layout';
return this.extendView(this.superViewPath, {});
```

ViewController.extendView phải chấp nhận 2 args (arg 2 không dùng, để future-proof).

### Contract test
`tests/contract/layout.contract.test.ts` — "extendView(path, {}) 2 args accepted"

---

## §10. `@switch` reactive type

Compiler emit `type: 'switch'` cho Reactive element:
```js
this.reactive('id', 'switch', parentReactive, parentElement, ['val'], factory)
```

`Reactive` constructor chấp nhận bất kỳ string type nào — không cần thay đổi.  
`@switch` được render giống `@if` — factory được gọi lại mỗi khi state thay đổi.

---

## §11. binding class — `{ type: 'binding', value, factory, stateKeys }`

Compiler emit:
```js
classes: [
    { type: 'static',  value: 'container' },
    { type: 'binding', value: 'active', factory: () => isActive, stateKeys: ['active'] },
]
```

`type: 'binding'`: class được thêm khi `factory()` truthy, bỏ khi falsy.  
Subscribe `stateKeys` → re-evaluate factory → toggle class.

**Không cần thay đổi** (đã implement trong Html.ts từ trước Phase 4).

---

## §12. block / blockOutlet — compiler signature

```js
// Page (trong render, trước extendView):
this.block('block-content', 'content', (parentElement) => [ ... ]);

// Layout (trong render):
this.blockOutlet('d9c86768', 'content', parentElement);
```

- `block(id, name, factory)` — 3 args
- `blockOutlet(id, name, parentElement)` — 3 args (không có data arg)

Khớp với `ViewController.block()` và `ViewController.blockOutlet()`.

---

## Tổng hợp thay đổi Phase 4

| File | Thay đổi |
|---|---|
| `src/core/contracts/ViewStateInterface.ts` | Thêm `setters`, `canUpdateStateByKey`, `lockUpdateRealState()`, `unlockUpdateRealState()` vào `StateManagerInterface`; `register()` value optional |
| `src/core/view/ViewState.ts` | `register(key, value?)` — value optional |
| `src/core/view/ViewManager.ts` | Thêm `generateViewId()` public method |
| `src/core/elements/Html.ts` | `normalizeAttrName()`, `setupTwoWayBinding()`, `_applyAttr()`, refactor `initializeAttributes()` |
| `src/core/contracts/ViewManagerInterface.ts` | Thêm `generateViewId()`, `exists()`, `view()` |

---

## Contract tests

| File | Coverage |
|---|---|
| `tests/contract/counter.contract.test.ts` | §1, §2, §3, §4 (named), §7 |
| `tests/contract/bind.contract.test.ts` | §5, §6 |
| `tests/contract/layout.contract.test.ts` | §4 (inline), §8, §9, §11, §12 |

---

## §13 — SSR Hydration: `__SSR_VIEW_ID__` và class-based element claim

### Pattern

Blade compiler prefix class của mỗi element với `$__VIEW_ID__`:

```blade
<div @class([$__VIEW_ID__ . '-d69e6b1d', 'flex', 'col'])>
    <h3 @class([$__VIEW_ID__ . '-e8dfa113', 'title'])>{{ $item->name }}</h3>
</div>
```

Kết quả HTML gửi về client:
```html
<div class="v12abc-d69e6b1d flex col">
    <h3 class="v12abc-e8dfa113 title">Category Name</h3>
</div>
```

### Client JS compiler output

```js
const __VIEW_ID__ = __data__.__SSR_VIEW_ID__ || App.View.generateViewId();
// ...
this.html(`d69e6b1d`, "div", parentElement, { classes: [...] }, (parentElement) => [
    this.html(`e8dfa113`, "h3", parentElement, { classes: [...] }, ...),
])
```

- CSR (fresh): `__VIEW_ID__` = mới từ `App.View.generateViewId()` → element ID là class
- SSR hydration: `__VIEW_ID__` = `__SSR_VIEW_ID__` từ server → khớp với server-rendered classes

### Client hydration flow

1. Laravel truyền `$__VIEW_ID__` về qua page data: `{ __SSR_VIEW_ID__: "v12abc" }`
2. Client gọi `ViewManager.hydrateView('web.view', { __SSR_VIEW_ID__: 'v12abc' })`
3. `initMode` = `'hydrate'` trong toàn bộ render pass
4. Html constructor tìm: `parentElement.element.querySelector('div.v12abc-d69e6b1d')`
5. Nếu tìm thấy → claim DOM node (không tạo mới) → giữ lại SSR structure
6. Nếu không tìm thấy → partial hydration fallback (tạo element mới)

Với Layout lồng nhau, runtime resolve `viewId` của từng Layout theo metadata
Blade đã export:

```html
<script type="application/json" data-ref="view-data"
        data-view-name="layouts.app" data-view-id="v-layout-app">...</script>
```

`data-view-name` là identity của từng mắt xích. Marker scan chỉ là fallback
cho HTML/fixture một Layout không có metadata này.

### Phạm vi claim (top-down isolation)

```
searchScope = parentElement.element  ← scope ưu tiên (tránh cross-view collision)
fallback    = document               ← cho root-level elements
```

### `@key` và hydration

`@key(item.id)` nhúng key vào element ID:
```js
this.html(`af0882bc-${i}-${item.id}`, "div", ...)
```
→ class trên server: `v12abc-af0882bc-0-1`

`@key` giúp ID ổn định qua các lần render → client claim đúng DOM node ngay cả khi
thứ tự render thay đổi. Đây là mục đích chính của `@key` (không phải CSR reconciliation
— cái đó do `ForeachSlotCache` xử lý).

### ViewManagerInterface

```typescript
hydrateView(
    name: string,
    data: Record<string, any> & { __SSR_VIEW_ID__: string },
    route?: any
): Promise<any>
```

### Test coverage

`tests/hydration/ssr-hydration.test.ts`:
- Html claim đúng DOM node bằng class
- Không nhầm element của view khác
- Partial hydration fallback
- ViewManager.hydrateView() API

---

## §14 — `@key` và vấn đề off-by-one trong `@foreach` không có `@key`

### Phân tích (kiểm tra 2026-06-13)

#### Khi có `@key(item.id)`:

| Output | ID pattern |
|---|---|
| JS | `` `hashed-${i}-${item.id}` `` |
| Blade | `{viewId}-hashed-{$i}-{$item->id}` |

✅ Nhất quán — hydration hoạt động đúng.

#### Khi KHÔNG có `@key`:

| Output | ID pattern | Indexing |
|---|---|---|
| JS (`render_generator.py`) | `` `hashed-${__loopIndex + 1}` `` | **1-based** |
| Blade (`hydrate_processor.py`) | `{viewId}-hashed-{$loop->index}` | **0-based** (`$loop->index`) |

⚠️ **Off-by-one mismatch** — item đầu tiên: JS tạo ID `hashed-1`, Blade tạo class `{viewId}-hashed-0` → hydration thất bại.

### Phạm vi ảnh hưởng

- **SSR Hydration**: bị ảnh hưởng — `@foreach` không có `@key` sẽ claim nhầm hoặc không tìm thấy DOM node
- **CSR (ForeachSlotCache)**: **không bị ảnh hưởng** — dùng object reference identity, hoàn toàn độc lập với element ID
- **Client runtime (Phase 8)**: **đúng** — claims `${viewId}-${id}` từ JS factory; nếu JS và Blade nhất quán (nhờ `@key`) thì hoạt động

### Fix đề xuất (compiler side)

Trong `render_generator.py` line 498:
```python
# Hiện tại (sai cho SSR):
loop_id_expr = node.custom_key_js if node.custom_key_js else '__loopIndex + 1'

# Đề xuất fix (khớp với Blade $loop->index):
loop_id_expr = node.custom_key_js if node.custom_key_js else '__loopIndex'
```

### Kết luận thực tế

Dùng `@key` với `@foreach` là **bắt buộc** cho SSR hydration đúng. Compiler nên enforce hoặc warn khi thiếu `@key` trong foreach có SSR.

---

## §15 — Directive Binding Helpers: `__showBinding`, `__styleBinding`, `__classBinding`

### Tổng quan

Compiler pre-process một số directives **trước** khi parse AST. Kết quả là template literal calls trong element config — các method này phải tồn tại trên `ViewController` để được gọi lúc runtime.

| Directive | Pre-processor | Method được gọi |
|---|---|---|
| `@show($cond)` | `show_directive_handler.py` | `this.__showBinding(stateKeys, cond)` |
| `@style(['prop' => $val])` | `style_directive_handler.py` | `this.__styleBinding(stateKeys, [['prop', val], ...])` |
| `@class([...])` | `class_binding_handler.py` (legacy) | `this.__classBinding([{type, value, checker?}])` |

---

### §15.1 — `__showBinding`

**Compiler emit (show_directive_handler.py):**
```html
<!-- Input .sao -->
<div @show($isVisible)>

<!-- Sau pre-process (trước AST parse) -->
<div style="${this.__showBinding(['isVisible'], isVisible)}">
```

**Compiled JS config:**
```javascript
attrs: {
  style: {
    type: 'binding',
    factory: () => this.__showBinding(['isVisible'], isVisible),
    stateKeys: ['isVisible'],
  }
}
```

**Runtime behavior:**
- `condition` truthy → `''` (element hiện, style attribute bị xóa hoặc set rỗng)
- `condition` falsy → `'display: none;'` (element ẩn)

Reactivity: `Html._applyAttr()` subscribe `stateKeys` và gọi lại `factory()` khi state thay đổi.

---

### §15.2 — `__styleBinding`

**Compiler emit (style_directive_handler.py):**
```html
<!-- Input .sao -->
<div @style(['color' => $textColor, 'font-size' => $fontSize])>

<!-- Sau pre-process -->
<div style="${this.__styleBinding(['textColor', 'fontSize'], [['color', textColor], ['font-size', fontSize]])}">
```

**Method signature:**
```typescript
__styleBinding(stateKeys: string[], styles: [string, any][]): string
```

**Filtering rules:**
- Lọc bỏ entries có value: `null`, `undefined`, `false`, `''`
- Giữ lại: số `0`, booleans `true`, strings không rỗng
- Output: `"color: red; font-size: 16px"` (join với `'; '`)

**Lưu ý:** `0` (số không) là valid CSS value (ví dụ `z-index: 0`, `margin: 0`) → KHÔNG bị lọc.

---

### §15.3 — `__classBinding` (legacy path)

**Chỉ áp dụng cho old template_processor fallback.** New AST path (RenderGenerator) emit `options.classes[]` trực tiếp → `Html.initializeClasses()` xử lý, không qua `__classBinding`.

**Format input:**
```typescript
type ClassConfig = {
  type: 'static' | 'binding';
  value: string;
  states?: string[];    // state keys để subscribe (used by Html, not __classBinding)
  checker?: () => any;  // closure trả về truthy/falsy
};
```

**Ví dụ compiled output (legacy):**
```javascript
// @class(['btn', 'is-active' => $isActive])
classes: this.__classBinding([
  { type: 'static', value: 'btn' },
  { type: 'binding', value: 'is-active', states: ['isActive'], checker: () => isActive },
])
```

**Runtime rules:**
- `type: 'static'` → luôn thêm nếu `value` không rỗng
- `type: 'binding'` → thêm nếu `checker()` truthy; bỏ qua nếu không có `checker`

---

### §15.4 — Vị trí trong rendering lifecycle

```
ViewController.render()
  └─ Html constructor (initMode = CREATE/HYDRATE)
       └─ Html._applyAttr()
            └─ factory()  ← calls __showBinding / __styleBinding
       └─ Html.initializeClasses()
            └─ (new AST path: classes[] config trực tiếp)
            └─ (legacy path: __classBinding result đã được inline vào config)
```

### §15.5 — Tests

`tests/directives/directive-bindings.test.ts`:
- `__showBinding`: truthy/falsy conditions, stateKeys không ảnh hưởng
- `__styleBinding`: filtering null/undefined/false/'', giữ 0, empty array, invalid input guard
- `__classBinding`: static classes, binding classes với checker, no-checker guard, closure state, defensive guard cho non-array

---

## §16 — Runtime assets: `<script>`, `<style>`, `<link rel="stylesheet">`

Compiler thu các tag asset khỏi template và emit vào `ViewController.setup()`:

- `<script src="...">` → `{ type: 'src', src, attributes }`
- `<script>...</script>` không chứa config export → `{ type: 'code', content, attributes }`
- `<style>` → global `{ type: 'code', content }`
- `<style scoped>` → `{ type: 'code', content, scoped: true }`
- `<link rel="stylesheet" href="...">` → `{ type: 'href', href, attributes }`

Các tag này không được render lần hai trong subtree View. `export default`/`script setup`
là code cấu hình compile-time, không phải runtime asset.

Runtime identity/lifecycle:

- CSS global và stylesheet dedup theo content/URL cùng toàn bộ attributes, xuyên View path.
- Scoped CSS dedup trong cùng View path; mỗi path có scope-id riêng và mọi instance dùng chung một `<style>`.
- Style/link tăng ref khi mount/resume, giảm ref khi pause/unmount/destroy, remove khi ref về 0.
- Script là side effect cấp document: dedup theo content/src + attributes và execute tối đa một lần;
  node được giữ tới teardown app. Logic cần chạy/dọn theo mỗi instance phải đặt trong lifecycle hook.

Blade SSR hiện không đưa runtime asset của `.sao` vào response head; chúng được acquire khi
client hydrate. CSS critical cần nằm trong bundle/head Laravel cho tới khi có asset manifest
SSR với identity marker để client claim mà không duplicate.
