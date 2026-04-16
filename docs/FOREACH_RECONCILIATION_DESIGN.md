# Thiết kế: Reactive Re-render — DOM Morphing + Keyed Reconciliation

> **Status**: Design phase — chờ hoàn thiện View, ViewController trước khi triển khai.
> **Date**: 2026-02-09

---

## 0. Tổng quan kiến trúc 2 tầng

| Tầng | Scope | Cơ chế | Giải quyết |
|------|-------|--------|------------|
| **Tầng 1: DOM Morph** | Mọi reactive re-render (`@if`, `@foreach`, `@for`, `@while`, `@switch`, `output`) | So sánh DOM nodes cũ vs HTML mới, patch tối thiểu | Giữ DOM state (focus, input values, checkbox, scroll, animation...) |
| **Tầng 2: Keyed Reconciliation** | `@foreach` có `@key` + `@include` | Di chuyển DOM nodes theo stable key, reuse view instances | Giữ view state nội bộ khi list thay đổi thứ tự |

- **Tầng 1** giải quyết **90% cases** — kể cả duplicate items, loops không có key, `@if` blocks.
- **Tầng 2** chỉ cần khi `@foreach` + `@include` + cần giữ view state chính xác theo identity.

---

## 0.1. DOM State bị mất khi dùng innerHTML replace

Mọi reactive type đều gặp vấn đề này, không chỉ `@foreach`:

```blade
@foreach($tags as $tag)
    <input type="text" value="{{ $tag }}" />  ← user đang gõ → re-render → mất focus + giá trị
@endforeach

@for($i = 0; $i < $count; $i++)
    <input type="checkbox" />  ← user vừa check → re-render → mất
@endfor

@if($showForm)
    <form><input value="{{ $name }}" /></form>  ← đang gõ → re-render → mất
@endif
```

**DOM state bị mất:**
- Focus position, cursor position
- Input values đang gõ (chưa submit)
- Checkbox/radio checked state
- `<select>` selected option
- Scroll position
- CSS animation/transition progress
- `<details>` open/close
- `contenteditable` content

---

## 0.2. Giải pháp Tầng 1: DOM Morphing

Thay vì `innerHTML = newHTML` (destroy + recreate), dùng **DOM morphing** — so sánh DOM cũ vs HTML mới, chỉ patch thuộc tính/nodes thực sự thay đổi.

```typescript
// Thay vì:
marker.replaceContent(newHTML);  // destroy all → insert new

// Dùng:
marker.morphContent(newHTML);    // diff old DOM vs new HTML → patch
```

### Morph Algorithm

```
morphChildren(parentNode, newNodes):
    oldChildren = [...parentNode.childNodes]
    i = 0

    for each newNode in newNodes:
        if i < oldChildren.length:
            morphNode(oldChildren[i], newNode)   // patch in-place
        else:
            parentNode.appendChild(newNode)       // thêm mới
        i++

    // Xóa nodes dư
    while i < oldChildren.length:
        parentNode.removeChild(oldChildren[i])
        i++

morphNode(oldNode, newNode):
    if oldNode.nodeType !== newNode.nodeType:
        oldNode.replaceWith(newNode); return

    if textNode:
        if oldNode.textContent !== newNode.textContent:
            oldNode.textContent = newNode.textContent
        return

    if element:
        if oldNode.tagName !== newNode.tagName:
            oldNode.replaceWith(newNode); return

        patchAttributes(oldNode, newNode)   // thêm/sửa/xóa attributes
        morphChildren(oldNode, newNode.childNodes)  // đệ quy
```

**Đặc biệt với form elements**: KHÔNG patch `value`/`checked` nếu element đang focus (user đang tương tác).

### Ví dụ Morph

```
Cũ (DOM):  <span>Count: 5</span>
Mới (HTML): <span>Count: 6</span>
→ Chỉ update textContent "5" → "6", span node giữ nguyên

Cũ:  <input type="text" value="hello" />  ← user đã gõ "hello world"
Mới: <input type="text" value="hello" />  ← cùng output
→ KHÔNG LÀM GÌ → giữ nguyên "hello world"

Cũ:  [<li>apple</li>, <li>banana</li>, <li>cherry</li>]
Mới: [<li>apple</li>, <li>grape</li>, <li>cherry</li>]
→ li[0]: SKIP, li[1]: patch text "banana"→"grape", li[2]: SKIP
```

---

Khi `$users` thay đổi (thêm/xóa/đổi thứ tự), cần:
- **Giữ nguyên** view instances của items không thay đổi (giữ state nội bộ)
- **Tạo mới** view instances cho items mới thêm
- **Destroy** view instances của items bị xóa
- **Di chuyển** DOM nodes khi thứ tự thay đổi (không destroy + recreate)

### Ví dụ cụ thể

```
Ban đầu: [A, B, C, D, E, F, G, H, I, J]  (10 users)
                    ↑ đang edit view C

Thao tác:
  1. Xóa G (user thứ 7)
  2. Thêm K (user mới)
  3. Xóa A (user đầu tiên)

Kết quả: [B, C, D, E, F, H, I, J, K]

Mong muốn:
  - View instance C: GIỮ NGUYÊN (đang edit, không mất state)
  - View instance G: DESTROY
  - View instance A: DESTROY
  - View instance K: TẠO MỚI
  - Các view B,D,E,F,H,I,J: GIỮ NGUYÊN, chỉ cập nhật vị trí DOM
```

### Tại sao dùng index không được?

```
Index:    0  1  2  3  4  5  6  7  8  9
Trước:   [A, B, C, D, E, F, G, H, I, J]
Sau:     [B, C, D, E, F, H, I, J, K]
Index:    0  1  2  3  4  5  6  7  8

Index 0: A → B  ← SAI: View instance A bị gán data B
Index 1: B → C  ← SAI: View instance B bị gán data C
Index 2: C → D  ← SAI: View instance C (đang edit) bị gán data D → MẤT STATE
...
```

---

## 2. Giải pháp: Stable Key

### 2.1. Cú pháp

Thêm directive `@key` để developer chỉ định identity:

```blade
@foreach($users as $user)
    @key($user['id'])
    @include('components.user-card', ['user' => $user])
@endforeach
```

Hoặc cú pháp ngắn gọn hơn (syntax sugar):

```blade
@foreach($users as $user, key: $user['id'])
    @include('components.user-card', ['user' => $user])
@endforeach
```

**Key rules:**
- Key phải **unique** trong cùng một `@foreach`
- Key phải **ổn định** — cùng một item luôn cho cùng key (không dùng random, index)
- Key thường là ID từ database, hoặc unique property của item

### 2.2. Compiled Output (JS/TS)

```typescript
// Với @key
this.__reactive('foreach', __rc__, rcId, ['users'],
  (__rc__) => this.__foreach(users, (user, __loopKey, __loopIndex, __loop) => {
    const __itemKey__ = user['id'];  // ← từ @key($user['id'])
    return this.__keyed(__rc__, __itemKey__, (__rc__) => `
      ${this.__reactive('include', __rc__, ..., ['user'],
        (__rc__) => App.View.renderView(
          this.__include('components.user-card', { user })
        )
      )}
    `);
  }, { keyed: true })
)
```

### 2.3. Compiled Output (Blade)

```blade
@startReactive('foreach', 'rc-' . $__VIEW_ID__ . '-foreach-1', ['users'])
@foreach($users as $user)
    @key($user['id'])
    @include('components.user-card', ['user' => $user])
@endforeach
@endReactive('foreach', 'rc-' . $__VIEW_ID__ . '-foreach-1')
```

`@key` sẽ được Laravel render thành:
```html
<!--key:user-123-->
```
JS runtime dùng comment marker này để map DOM nodes ↔ stable key.

---

## 3. Reconciliation Algorithm

### 3.1. Data structures

```typescript
interface KeyedChildView {
    key: string | number;            // Stable key từ @key
    viewInstance: View | null;       // View con (nếu có @include)
    reactiveChildren: Reactive[];   // Reactive blocks bên trong item
    domNodes: Node[];               // DOM nodes thuộc item này
    marker: OneMarkerModel;         // Comment marker pair
}

// ForeachReactive giữ map
class ForeachReactive extends Reactive {
    childMap: Map<string, KeyedChildView>;  // key → child
    keyOrder: string[];                      // thứ tự keys hiện tại
}
```

### 3.2. Algorithm (khi state thay đổi)

```
Input:
  oldKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
  newKeys = ['B', 'C', 'D', 'E', 'F', 'H', 'I', 'J', 'K']

Step 1: Tính diff
  removed  = oldKeys - newKeys = {'A', 'G'}
  added    = newKeys - oldKeys = {'K'}
  kept     = oldKeys ∩ newKeys = {'B','C','D','E','F','H','I','J'}

Step 2: Destroy removed
  Với mỗi key ∈ removed:
    - childMap[key].viewInstance.destroy()
    - Xóa DOM nodes
    - Xóa khỏi childMap

Step 3: Create added
  Với mỗi key ∈ added:
    - Tạo View instance mới
    - Render HTML
    - Thêm vào childMap[key]

Step 4: Reorder kept (DOM move)
  Duyệt newKeys theo thứ tự:
    Với mỗi key:
      Nếu key ∈ kept:
        - Di chuyển DOM nodes đến vị trí đúng (insertBefore)
        - Cập nhật data mới nếu props thay đổi (patch, không destroy)
      Nếu key ∈ added:
        - Insert DOM nodes vào vị trí đúng

Step 5: Cập nhật LoopContext
  Với mỗi key theo thứ tự mới:
    - Cập nhật __loopIndex, iteration, first, last, odd, even
```

### 3.3. DOM Move Strategy

Dùng **anchor-based insertion** (giống Svelte):

```
Parent container:
  <!--reactive:rc-v1-foreach-1-->        ← foreach open marker
    <!--key:B-->                          ← item B marker
      <div class="user-card">...</div>
    <!--/key:B-->
    <!--key:C-->                          ← item C marker
      <div class="user-card">...</div>
    <!--/key:C-->
    ...
  <!--/reactive:rc-v1-foreach-1-->       ← foreach close marker
```

Khi reorder: dùng `parentNode.insertBefore(node, anchor)` để di chuyển — **không cần re-render HTML, không mất state**.

---

## 4. Cập nhật Data cho Kept Items (Patch)

Khi item được giữ lại nhưng **data thay đổi** (ví dụ: `user.name` đổi), cần cơ chế **patch** thay vì re-render toàn bộ view con.

### Phương án: Props-based Reactivity

View con nhận data qua `props`. Khi parent foreach re-reconcile:

```typescript
// Kept item — chỉ cập nhật props
if (childView && propsChanged(oldProps, newProps)) {
    childView.__updateProps(newProps);
    // → trigger re-render các reactive blocks BÊN TRONG view con
    //   mà phụ thuộc vào props đã thay đổi
}
```

Điều này tương tự React's `props` + `shouldComponentUpdate`:
- View con có state nội bộ → **không bị ảnh hưởng**
- View con có reactive blocks phụ thuộc props → **tự động re-render**
- View con không phụ thuộc props thay đổi → **không làm gì**

---

## 5. Khi không có @key

Nếu developer không dùng `@key`:

### Phương án A: Fallback về index (hiện tại)
- Đơn giản nhưng sai khi reorder/delete
- Warning trong development mode

### Phương án B: Auto-detect key (recommended)
- Nếu item là object có `id` property → tự dùng `item.id`
- Nếu item là object có `_id` property → tự dùng `item._id`
- Nếu không tìm được → fallback index + dev warning

### Phương án C: Content-hash key
- Hash nội dung item để tạo key
- Chậm, không ổn định khi data thay đổi
- Không recommended

**Recommended**: Phương án B — auto-detect `id`/`_id`, fallback index + warning.

---

## 6. Comparison với các Framework khác

| Feature | React | Vue | Svelte | **OneView (đề xuất)** |
|---------|-------|-----|--------|----------------------|
| Key syntax | `key={id}` | `:key="id"` | `{#each items as item (item.id)}` | `@key($item['id'])` |
| Required? | No (warning) | No (warning) | No | No (auto-detect + warning) |
| Reconciliation | Fiber reconciler | Patch + VNode diff | Keyed each block | Comment marker + DOM move |
| Virtual DOM | Yes | Yes | No | **No** (direct DOM) |
| DOM moves | Via reconciler | Via patch | `insertBefore` | **`insertBefore`** (giống Svelte) |

OneView gần nhất với Svelte vì cả hai đều:
- Không dùng Virtual DOM
- Compile-time → biết trước structure
- DOM moves trực tiếp qua `insertBefore`

---

## 7. Implementation Phases

### Phase 1: Core Reconciliation (Minimum Viable)
- [ ] `@key` directive — compiler (one2js + one2blade)
- [ ] `KeyedChildMap` class — runtime
- [ ] `ForeachReactive.reconcile()` — diff old/new keys, destroy/create/move
- [ ] Key comment markers — `<!--key:xxx-->...<!--/key:xxx-->`
- [ ] DOM move via `insertBefore`

### Phase 2: View Instance Reuse
- [ ] `__include()` implementation — create View instance
- [ ] `renderView()` implementation — render View → HTML string
- [ ] View instance caching per key trong `childMap`
- [ ] `View.__updateProps()` — patch props without destroy

### Phase 3: Lifecycle Integration
- [ ] `onBeforeDestroy()` — gọi trước khi remove child view
- [ ] `onMove()` — gọi khi view được di chuyển vị trí
- [ ] `onPropsUpdate()` — gọi khi props thay đổi
- [ ] Memory cleanup — WeakRef cho view instances

### Phase 4: Optimization
- [ ] Auto-detect key (`id`, `_id`)
- [ ] Batch DOM moves (minimize reflow)
- [ ] LIS (Longest Increasing Subsequence) algorithm cho optimal moves
- [ ] Development mode warnings khi thiếu `@key`

---

## 8. Chi tiết thuật toán LIS cho DOM Moves

Khi có N items giữ lại và cần reorder, naive approach di chuyển tất cả = O(N) DOM operations. Dùng LIS (Longest Increasing Subsequence) để tìm subsequence dài nhất đã đúng thứ tự → chỉ cần di chuyển items KHÔNG thuộc LIS.

```
oldOrder: [B, C, D, E, F, H, I, J]  (indices: 0,1,2,3,4,5,6,7)
newOrder: [C, B, D, E, J, F, H, I]

Map old positions:
  C→1, B→0, D→2, E→3, J→7, F→4, H→5, I→6

New order by old positions: [1, 0, 2, 3, 7, 4, 5, 6]

LIS: [0, 2, 3, 4, 5, 6]  → items B, D, E, F, H, I đứng yên
Cần move: C (vị trí cũ 1 → đầu), J (vị trí cũ 7 → giữa)

Chỉ 2 DOM moves thay vì 8!
```

---

## 9. Ví dụ End-to-End

### Template (.one)
```blade
@const([$users, $setUsers] = useState([
    ['id' => 1, 'name' => 'Alice'],
    ['id' => 2, 'name' => 'Bob'],
    ['id' => 3, 'name' => 'Charlie'],
]))

<div class="user-list">
    @foreach($users as $user)
        @key($user['id'])
        @include('components.user-card', ['user' => $user])
    @endforeach
</div>
```

### Initial Render (SSR HTML)
```html
<div class="user-list">
    <!--reactive:rc-v1-foreach-1-->
        <!--key:1-->
        <!--reactive:rc-v1-include-2-->
            <div class="user-card">Alice</div>
        <!--/reactive:rc-v1-include-2-->
        <!--/key:1-->
        <!--key:2-->
        <!--reactive:rc-v1-include-3-->
            <div class="user-card">Bob</div>
        <!--/reactive:rc-v1-include-3-->
        <!--/key:2-->
        <!--key:3-->
        <!--reactive:rc-v1-include-4-->
            <div class="user-card">Charlie</div>
        <!--/reactive:rc-v1-include-4-->
        <!--/key:3-->
    <!--/reactive:rc-v1-foreach-1-->
</div>
```

### After `setUsers([...users, {id: 4, name: 'David'}])` — Thêm 1 user

```
Diff:
  removed = {}
  added   = {4}
  kept    = {1, 2, 3}

Actions:
  1. Create view instance cho key=4 (David)
  2. Render HTML: <div class="user-card">David</div>
  3. Insert <!--key:4-->...<!--/key:4--> trước <!--/reactive:rc-v1-foreach-1-->
  4. Keys 1,2,3: KHÔNG LÀM GÌ (giữ nguyên state)
```

### After `setUsers(users.filter(u => u.id !== 1))` — Xóa Alice

```
Diff:
  removed = {1}
  added   = {}
  kept    = {2, 3, 4}

Actions:
  1. Destroy view instance key=1 (Alice) — gọi lifecycle hooks
  2. Remove <!--key:1-->...<!--/key:1--> khỏi DOM
  3. Keys 2,3,4: KHÔNG LÀM GÌ (giữ nguyên state + vị trí)
```

---

## 10. Khi không có @key — Các trường hợp đặc biệt

### 10.1. List primitives không trùng
```
tags = ['javascript', 'typescript', 'python']
```
→ Dùng **giá trị chính nó** làm key. Tự động, không cần `@key`.

### 10.2. List primitives CÓ trùng
```
tags = ['apple', 'apple', 'banana', 'apple']
```
→ Không thể dùng value làm key (trùng). Nhưng vì items giống hệt nhau, việc swap view instance giữa chúng **không có ý nghĩa** — data giống nhau, render giống nhau.

### 10.3. List objects không có field nào unique
```
items = [{color: 'red'}, {color: 'red'}, {color: 'blue'}]
```
→ Giống case 10.2.

### 10.4. Nhận xét quan trọng

**Nếu items không có identity → việc giữ/swap state nội bộ không có ý nghĩa logic.**

"Giữ state cho đúng item" chỉ có nghĩa khi phân biệt được item nào là item nào. Nếu 2 items giống hệt nhau, không cách nào (kể cả user) biết state đang thuộc về "item gốc" hay "item bị swap".

### 10.5. Chiến lược tổng hợp

| Tình huống | Key strategy | Reconciliation |
|-----------|-------------|----------------|
| Object có `id`/`_id` | Auto-detect `item.id` | Tầng 2: Keyed reconciliation |
| Developer chỉ định `@key` | `@key($item['slug'])` | Tầng 2: Keyed reconciliation |
| Primitives không trùng | Dùng value tự động | Tầng 2: Keyed reconciliation |
| Primitives trùng / Objects không có key | **Index + Tầng 1 DOM morph** | Không move DOM, morph in-place |
| Không có `@include` (chỉ HTML thuần) | Index + Tầng 1 DOM morph | Morph giữ DOM state (focus, input...) |

### 10.6. In-place update cho trường hợp không có key

```
Trước: ['apple', 'apple', 'banana', 'apple']  → 4 DOM slots
Sau:   ['apple', 'banana', 'apple']            → 3 DOM slots

Slot 0: 'apple' → 'apple'   → MORPH → không đổi
Slot 1: 'apple' → 'banana'  → MORPH → patch text/attrs
Slot 2: 'banana' → 'apple'  → MORPH → patch text/attrs
Slot 3: 'apple' → (xóa)     → REMOVE (destroy view nếu @include)
```

Không di chuyển DOM, chỉ morph in-place. State nội bộ có thể "lệch" item — đây là **expected behavior** vì items không có identity.

---

## 11. Tóm tắt mối quan hệ giữa 2 tầng và các loops

| Loại loop | Tầng 1 (DOM Morph) | Tầng 2 (Keyed) |
|-----------|-------------------|----------------|
| `@foreach` + HTML thuần | ✅ Đủ dùng | Không cần |
| `@foreach` + `@include` + có key | ✅ Base layer | ✅ Bổ sung: move DOM, reuse view |
| `@foreach` + `@include` + không key | ✅ Fallback | ⚠️ In-place morph + dev warning |
| `@for` | ✅ Đủ dùng | Không áp dụng |
| `@while` | ✅ Đủ dùng | Không áp dụng |
| `@if` / `@switch` | ✅ Đủ dùng | Không áp dụng |
| `output` (`{{ }}`) | ✅ textContent patch | Không áp dụng |

---

## 12. Implementation Phases (Cập nhật)

### Phase 0: DOM Morphing Engine ⭐ (Ưu tiên cao nhất)
- [ ] `DomMorpher` class — core morph algorithm
- [ ] `morphNode()`, `morphChildren()`, `patchAttributes()`
- [ ] Form element protection (skip value/checked khi focused)
- [ ] Comment marker awareness (skip `<!--reactive:...-->` nodes)
- [ ] Integrate vào `OneMarkerModel.morphContent()` thay cho `replaceContent()`
- [ ] Áp dụng cho TẤT CẢ reactive types

### Phase 1: Core Keyed Reconciliation
- [ ] `@key` directive — compiler (one2js + one2blade)
- [ ] `KeyedChildMap` class — runtime
- [ ] `ForeachReactive.reconcile()` — diff old/new keys, destroy/create/move
- [ ] Key comment markers — `<!--key:xxx-->...<!--/key:xxx-->`
- [ ] DOM move via `insertBefore`

### Phase 2: View Instance Reuse
- [ ] `__include()` implementation — create View instance
- [ ] `renderView()` implementation — render View → HTML string
- [ ] View instance caching per key trong `childMap`
- [ ] `View.__updateProps()` — patch props without destroy

### Phase 3: Lifecycle Integration
- [ ] `onBeforeDestroy()` — gọi trước khi remove child view
- [ ] `onMove()` — gọi khi view được di chuyển vị trí
- [ ] `onPropsUpdate()` — gọi khi props thay đổi
- [ ] Memory cleanup — WeakRef cho view instances

### Phase 4: Optimization
- [ ] Auto-detect key (`id`, `_id`, value for primitives)
- [ ] Batch DOM moves (minimize reflow)
- [ ] LIS (Longest Increasing Subsequence) algorithm cho optimal moves
- [ ] Development mode warnings khi `@foreach` + `@include` thiếu `@key`

---

## 13. Trạng thái hiện tại cần hoàn thiện trước

Trước khi triển khai reconciliation, cần hoàn thiện:

- [ ] `Reactive.refresh()` — hiện đang empty
- [ ] State → re-render wiring (subscribe stateKeys → trigger re-render)
- [ ] `__include()` implementation
- [ ] `renderView()` implementation
- [ ] Child view lifecycle management (create/destroy)
- [ ] `View`, `ViewController` hoàn thiện
