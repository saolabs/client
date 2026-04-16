# OneView v3 — RUNTIME API SPECIFICATION

> Quick-reference cho API contract giữa compiled output và runtime.
> Mỗi entry ghi rõ: gọi từ đâu, signature, trạng thái hiện tại, file cần sửa.

---

## 1. STATE MANAGEMENT API

### 1.1 `StateManager.register(key, value?)`
- **Gọi từ**: `$__setup__` — `const set$count = __STATE__.__.register('count');`
- **Signature**: `register(key: string | number, value?: any): (newValue: any) => void`
- **Trả về**: Internal setter function (gọi set giá trị + trigger subscribers)
- **Trạng thái**: ✅ Đã có
- **File**: `src/one/view/ViewState.ts` dòng ~109

### 1.2 `StateManager.canUpdateStateByKey` (getter)
- **Gọi từ**: `$__setup__` — `if (__STATE__.__.canUpdateStateByKey) { updateStateByKey(...) }`
- **Signature**: `get canUpdateStateByKey(): boolean`
- **Mô tả**: `true` trước `lockUpdateRealState()`, `false` sau
- **Trạng thái**: ✅ Đã có (Phase 1)
- **File**: `src/one/view/ViewState.ts`

### 1.3 `StateManager.lockUpdateRealState()`
- **Gọi từ**: `$__setup__` → `commitConstructorData()` cuối cùng
- **Signature**: `lockUpdateRealState(): void`
- **Mô tả**: Set `canUpdateStateByKey = false`
- **Trạng thái**: ✅ Đã có (Phase 1)
- **File**: `src/one/view/ViewState.ts`

### 1.4 `StateManager.unlockUpdateRealState()`
- **Gọi từ**: `ViewController.updateData()` trước khi gọi `updateVariableData`
- **Signature**: `unlockUpdateRealState(): void`
- **Mô tả**: Set `canUpdateStateByKey = true`
- **Trạng thái**: ✅ Đã có (Phase 1)
- **File**: `src/one/view/ViewState.ts`

### 1.5 `StateManager.updateRealState(stateMap)`
- **Gọi từ**: `$__setup__` — `updateRealState(state)` wrapper
- **Signature**: `updateRealState(stateMap: Record<string | number, any>): void`
- **Mô tả**: Set nhiều state values QUIETLY (không trigger). Chỉ works khi `canUpdateStateByKey = true`
- **Trạng thái**: ✅ Đã có (Phase 1)
- **File**: `src/one/view/ViewState.ts`

### 1.6 `StateManager.updateStateByKey(key, value)`
- **Gọi từ**: `$__setup__` — `updateStateByKey('count', value)`
- **Signature**: `updateStateByKey(key: string | number, value: any): any`
- **Mô tả**: Set 1 state value + trigger subscribers
- **Trạng thái**: ✅ Đã có
- **File**: `src/one/view/ViewState.ts` dòng ~112

### 1.7 `StateManager.setters`
- **Gọi từ**: `$__setup__` — `__STATE__.__.setters.setCount = setCount;`
- **Signature**: `setters: Record<string | number, (value: any) => void>`
- **Mô tả**: Public object — compiled output gắn setters cho external access
- **Trạng thái**: ✅ Đã có
- **File**: `src/one/view/ViewState.ts` dòng ~37

### 1.8 `ViewState.__useState(value, key?)`
- **Gọi từ**: `$__setup__` — `const useState = (value) => __STATE__.__useState(value);`
- **Signature**: `__useState(value: any, key?: string | number): [any, (newValue: any) => void]`
- **Mô tả**: Wrapper giống React useState. Trả về `[value, setter]` (không trả key)
- **Trạng thái**: ✅ Đã có (Phase 1)
- **File**: `src/one/view/ViewState.ts`

### 1.9 `StateManager.subscribe(key|keys, callback)`
- **Gọi từ**: Output.start(), Reactive, Html bindings
- **Signature**: `subscribe(key: string | number | string[] | Record<string, listener>, callback?: listener): () => void`
- **Trả về**: Unsubscribe function
- **Trạng thái**: ✅ Đã có
- **File**: `src/one/view/ViewState.ts` dòng ~158

### 1.10 `StateManager.getStateByKey(key)`
- **Gọi từ**: Internal — hỗ trợ nested paths "user.name"
- **Signature**: `getStateByKey(key: string | number): any`
- **Trạng thái**: ✅ Đã có
- **File**: `src/one/view/ViewState.ts` dòng ~119

---

## 2. VIEW CONTROLLER API

### 2.1 `ViewController.setup(config)`
- **Gọi từ**: `$__setup__` — `this.__ctrl__.setup({...})`
- **Config fields**:
  ```
  data, viewId, path, superView, subscribe,
  scripts, styles, resources,
  commitConstructorData, updateVariableData, updateVariableItemData,
  prerender, render, fetch
  ```
- **Trạng thái**: ✅ Đã có (Phase 2) — parse metadata, lưu render factory, bind lifecycle
- **File**: `src/one/view/ViewController.ts`

### 2.2 `ViewController.setApp(app)`
- **Gọi từ**: constructor — `this.__ctrl__.setApp(App);`
- **Trạng thái**: ✅ Đã có
- **File**: `src/one/view/ViewController.ts`

### 2.3 `ViewController.setUserDefinedConfig(config)`
- **Gọi từ**: `$__setup__` — `this.__ctrl__.setUserDefinedConfig({toggle() {...}})`
- **Trạng thái**: ✅ Đã có
- **File**: `src/one/view/ViewController.ts`

### 2.4 `ViewController.commitData()`
- **Gọi từ**: ViewManager sau render + mount
- **Mô tả**: Gọi `config.commitConstructorData()` 1 lần. Idempotent.
- **Trạng thái**: ✅ Đã có (Phase 2)
- **File**: `src/one/view/ViewController.ts`

### 2.5 `ViewController.updateData(newData)`
- **Gọi từ**: ViewManager khi navigate same view, different params
- **Mô tả**: Unlock → gọi `config.updateVariableData(newData)` → tự lock trong callback
- **Trạng thái**: ✅ Đã có (Phase 2)
- **File**: `src/one/view/ViewController.ts`

### 2.6 `ViewController.start()` / `stop()`
- **Gọi từ**: ViewManager sau commitData / trước destroy
- **Mô tả**: Walk element tree, gọi start/stop trên Output, TextElement, etc.
- **Trạng thái**: ✅ Đã có (Phase 7)
- **File**: `src/one/view/ViewController.ts`

### 2.7 `ViewController.scheduleUpdate(reactive)`
- **Gọi từ**: Reactive subscriptions
- **Trạng thái**: ✅ Đã có
- **File**: `src/one/view/ViewController.ts`

### 2.8 `ViewController.addEventListener(el, event, handlers)`
- **Gọi từ**: Html.initializeEvents()
- **Trạng thái**: ✅ Đã có
- **File**: `src/one/view/ViewController.ts`

### 2.9 `ViewController.__foreach(list, callback)`
- **Gọi từ**: Compiled render factory
- **Trạng thái**: ✅ Đã có
- **File**: `src/one/view/ViewController.ts`

---

## 3. ELEMENT FACTORY API (gọi trong render function)

### 3.1 `fragment(config, childrenFactory)`
```typescript
fragment({ ctx, parentElement }, (parentElement) => [...])
```
- **Trạng thái**: ✅ Đã có trong index.ts (Phase 6) — `parentElement` → `parent` mapping done

### 3.2 `html(tagName, config, childrenFactory)`
```typescript
html("div", { ctx, parentElement, classes: {...}, attrs: {...}, events: {...} }, (parentElement) => [...])
```
- **Trạng thái**: ✅ Đã có trong index.ts (Phase 4+6) — classes/styles/attrs reactive bindings đầy đủ

### 3.3 `output(config, contentFactory)`
```typescript
output({ ctx, parentElement, stateKeys: ["count"], isEscapeHTML: true }, () => count)
```
- **Trạng thái**: ✅ Đã có (Phase 3) — Full implementation: render/start/stop/update/destroy với comment markers

### 3.4 `reactive(type, config, childrenFactory)`
```typescript
reactive("if", {id, ctx, parentElement, parentReactive, stateKeys}, (parentReactive, parentElement) => [...])
```
- **Trạng thái**: ✅ Đã có (Phase 6) — Param names đã fix: `ctx` → `viewController`, `stateKeys` → `statesKeys` mapping

### 3.5 `block(ctx, name, viewId?, contentRenderFactory?)`
- **Trạng thái**: ✅ Factory function có (Phase 8)
- **Ghi chú**: Block.mount() + BlockManager.mountAll() đã implement. Cần test e2e.

### 3.6 `blockOutlet(ctx, blockName, parent)`
- **Trạng thái**: ✅ Factory function có (Phase 8)
- **Ghi chú**: Đã kết nối với Block qua BlockManager

### 3.7 `text(config, textFactory)` 
- **Trạng thái**: ✅ Đã có trong index.ts

---

## 4. VIEW CLASS API

### 4.1 `new View(path, viewType, viewControllerClass?)`
- **Trạng thái**: ✅

### 4.2 `view.$__setup__(__data__, systemData)`
- **Mô tả**: Override trong compiled subclass
- **Trạng thái**: ✅ Hook hoạt động

### 4.3 Lifecycle Hooks
```typescript
onInit?(): void | Promise<void>;
onMounted?(): void | Promise<void>;
onUpdated?(): void | Promise<void>;
onDestroy?(): void | Promise<void>;
onActivated?(): void | Promise<void>;
onDeactivated?(): void | Promise<void>;
```
- **Trạng thái**: ✅ Declared + ViewController.start() gọi onMounted() (Phase 7)

---

## 5. TỔNG KẾT TRẠNG THÁI

> **Cập nhật sau Phase 1–8**: Tất cả API đã implement xong.

| API | ✅ Có | ❌ Thiếu | ⚠️ Partial |
|-----|-------|---------|-----------|
| StateManager | 10 | 0 | 0 |
| ViewController | 9 | 0 | 0 |
| Element Factories | 7 | 0 | 0 |
| View | 3 | 0 | 0 |
| **Tổng** | **29** | **0** | **0** |

**Còn lại (Phase 9–12)**:
1. `ViewManager` — orchestrator quản lý view lifecycle (chưa tạo)
2. `Router` — navigation + URL binding (chưa port)
3. Reconciliation — keyed list diff (chưa implement)
4. SSR Hydration — server-side rendering (chưa implement)

---

*File này là API contract reference. Mọi runtime change phải update tương ứng.*
