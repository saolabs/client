# Client — Known Gaps & Roadmap

> Theo dõi lỗi đã phát hiện, phương án khắc phục, và tiến độ để client đáp ứng
> yêu cầu một frontend framework thực chiến (so với Vue/React). File này là
> **living document** — cập nhật trạng thái khi làm, không xoá lịch sử.

**Cập nhật 2026-08-04 (phiên rà soát #2):** vá **GAP-10** (`ForeachSlotCache`
đánh rơi slot → refresh list làm view con `@include` biến mất, §2.10),
**GAP-11** (registry `elements` + `MarkerRegistry` không bao giờ co, §2.10),
**GAP-12** (mutate tại chỗ thất bại im lặng, §2.11), **GAP-13** (a11y sau
điều hướng, §2.12), **GAP-14** (props không có kiểu, §2.13), **GAP-15**
(event modifier, §2.14), **N2** (transition primitive, §2.15), **GAP-16**
(mutate không kèm set + `subscribe` nuốt key, §2.16), **N3** (nested route, §2.17), **GAP-17** (registry không co khi view bị xoá thật, §2.18), **GAP-18**
(lệch-1 id marker loop không `@key` — hydration sai, §2.19), **GAP-19**
(trường chết + `isViewMounted()` luôn trả false, §2.20). Mở mục mới **§1c** cho các thiếu sót phát hiện khi
đối chiếu với Vue/React/Svelte/Solid nhưng CHƯA làm.
Trạng thái test: client **44 file / 366 test**, compiler **10 file** — pass, `tsc` sạch.

> ⚠️ Bài học lớn nhất của phiên #2, xem §5: mục §2.1 dưới đây từng ghi
> "SSR / Hydration / Reactive core — ✅ Đã verify đúng", verify bằng *đọc code +
> compile thật*. Nhưng GAP-10 nằm đúng trong vùng đó và là kịch bản phổ biến
> nhất của app CRUD. Đọc code không bắt được vì lỗi chỉ xuất hiện ở **pass thứ
> hai** của reconciler. **Với code có trạng thái qua nhiều pass, "verify" phải
> là test chạy được, không phải đọc hiểu.**

**Bắt đầu:** 2026-08-03 · **Cập nhật trước đó:** 2026-08-03 — đã vá xong
**GAP-03** (error boundary, §2.4), **GAP-07** (showError, §2.4) và
**GAP-01** (code-splitting §2.5/§2.5b), **GAP-06** (testing utilities §2.6),
**GAP-08** (export chết §2.6b), **GAP-04** (computed §2.7), **GAP-04b** (cú
pháp `@computed` cho `.sao` §2.7b), **GAP-09** (listener nuốt lỗi §2.8 — tìm
ra khi rà soát lại GAP-03), **GAP-05** (DevTools §2.9 — hook + overlay).
**Toàn bộ danh sách GAP đã đóng** — còn lại 7 việc hoãn có chủ ý (§1b).
Kèm cập nhật `saola-language-support` v1.9.0 cho `@computed` (grammar +
snippet + completion + tránh cảnh báo "chưa khai báo" sai).
Kèm **3 lỗ hổng có sẵn** phát hiện dọc đường, đều đã vá: phase mount nằm ngoài
mọi try/catch → unhandled rejection; export `./core` trỏ file không tồn tại;
flush core không xử lý cascade (listener enqueue trong lúc flush → cập nhật
dẫn xuất kẹt tới lần state đổi kế tiếp) — và **1 phát hiện kiến trúc quan
trọng**: hệ `directives_line`/`parse_let_directives` (dùng cho @let/@const)
hoá ra là code CHẾT, bị `DeclarationTracker` thay thế từ trước nhưng chưa ai
xoá — lần thứ 3 gặp lớp bug "2 hệ song song, 1 hệ chết" trong dự án này
(sau `@class`, `@bind`). Không dọn trong phiên này (ngoài phạm vi @computed).
Trạng thái test: client **35 file / 307 test**, compiler **73 test** — pass, build sạch.

## Cách dùng file này

- Trạng thái mỗi mục: `✅ Đã xong` · `🚧 Đang làm` · `❌ Chưa làm` · `⚠️ Biết, chưa ưu tiên`
- Sửa xong → đổi trạng thái + ghi ngày + link file/test/commit liên quan. Không xoá mục.
- "Đã verify" luôn trỏ file:line hoặc kết quả compile/test đã tự chạy —
  không suy đoán từ docs cũ (nhiều doc khác trong `docs/` đã lỗi thời, xem
  bài học ở mục 5).
- **Quy tắc 2 đường (bắt buộc, sau sự cố GAP-02):** không kết luận "chưa có /
  không hoạt động" nếu mới kiểm tra 1 đường. Phải soát ít nhất 2 đường độc
  lập — vd runtime client + đường compile thật, hoặc code + output thật của
  app. Repo này có nhiều module cũ/mới song song cho cùng 1 tính năng.
- Ưu tiên: **P0** chặn production · **P1** nên có sớm · **P2** cải thiện DX ·
  **P3** ecosystem/tooling, làm sau.

---

## 1. Tổng quan tiến độ

| Khu vực | Trạng thái | Chi tiết |
|---|---|---|
| SSR / Hydration / Reactive core | ✅ Đã verify đúng | §2.1 |
| `@section` / `@yield` + quản lý `<head>` | ✅ Xây mới hoàn chỉnh | §2.2 |
| `@await` / prerender (CSR + hydrate) | ✅ Đã sửa 3 bug | §2.3 |
| Error boundary | ✅ Xong (2026-08-03) — `onError` + lưới cuối phase mount | GAP-03, §2.4 |
| `showError()` nội suy chuỗi vào `innerHTML` | ✅ Xong (2026-08-03) — dựng bằng DOM API | GAP-07, §2.4 |
| Code-splitting / lazy-load route | ✅ Xong (2026-08-03) — runtime + generator, opt-in | GAP-01, §2.5 |
| Two-way binding (`@bind`/`@val`) | ✅ Đã hoạt động từ trước; refactor xong config riêng | GAP-02 |
| Computed/watch có memoization | ✅ Xong (2026-08-03) — runtime §2.7 + cú pháp `.sao` §2.7b | GAP-04/04b |
| Testing utilities cho end-user | ✅ Xong (2026-08-03) — `@saolabs/client/testing` | GAP-06, §2.6 |
| Export `./core` trong package.json trỏ file không tồn tại | ✅ Xong (2026-08-03) — xoá + `check-exports` | GAP-08, §2.6b |
| Lỗi trong callback subscribe bị nuốt im lặng | ✅ Xong (2026-08-03) — báo về boundary | GAP-09, §2.8 |
| DevTools | ✅ Xong (2026-08-04) — hook + inspector overlay | GAP-05, §2.9 |
| `@foreach` refresh list → view con `@include` biến mất | ✅ Xong (2026-08-04) — `ForeachSlotCache._evicted` | GAP-10, §2.10 |
| Registry `elements` + `MarkerRegistry` chỉ phình, không co | ✅ Xong (2026-08-04) — `releaseElement` + `markerRegistry.remove` | GAP-11, §2.10 |
| Mutate tại chỗ (`push`/gán field) thất bại IM LẶNG | ✅ Xong (2026-08-04) — cảnh báo warn-once ở đường setter | GAP-12, §2.11 |
| A11y sau điều hướng: focus + aria-live | ✅ Xong (2026-08-04) — `Router.announceNavigation` | GAP-13, §2.12 |
| Props không có kiểu (`__data__: any`) | ✅ Xong (2026-08-04) — emit `interface {Name}Props` ở TS mode | GAP-14, §2.13 |
| Event modifier `.prevent/.stop/.self/.once` | ✅ Xong (2026-08-04) — compiler + runtime + extension | GAP-15, §2.14 |
| Transition enter/leave | ✅ Xong (2026-08-04) — `@transition('fade')`, dùng `getAnimations()` | N2, §2.15 |
| Mutate KHÔNG kèm set + `subscribe` nuốt key chưa register | ✅ Xong (2026-08-04) — snapshot nông lúc flush | GAP-16, §2.16 |
| Nested route (`children`) | ✅ Xong (2026-08-04) — flatten cấu hình; render lồng đã có sẵn | N3, §2.17 |
| `MarkerRegistry` phình 1 record mỗi lần điều hướng | ✅ Xong (2026-08-04) — destroy trước khi rời Map | GAP-17, §2.18 |
| Lệch-1 id marker loop không `@key` (SSR 0-based ↔ CSR 1-based) | ✅ Xong (2026-08-04) — bỏ `+ 1` phía sao2js | GAP-18, §2.19 |
| Trường chết `cachedLayouts`/`activeViews`, `isViewMounted()` nói dối | ✅ Xong (2026-08-04) — xoá + đọc dữ liệu sống | GAP-19, §2.20 |

**Danh sách GAP đã đóng hết.** Còn lại: 7 việc hoãn có chủ ý (§1b) và
3 thiếu sót đã nhận diện nhưng chưa làm (§1c — N2, N3 đã xong; N6 là chủ ý).

### 1b. Việc đã HOÃN CÓ CHỦ Ý (gom một chỗ để không rơi rớt)

Không phải lỗ hổng — là quyết định phạm vi. Ghi lại để lần sau còn tìm thấy.

| # | Việc | Vì sao hoãn | Kích hoạt lại khi |
|---|---|---|---|
| D1 | `modulepreload` cho chunk entry khi bật lazy | Thuộc `core/` + app shell, không phải client runtime | Thực sự bật `registry.lazy` cho app |
| D2 | Pagecache detach/re-register cho `@yield` | Edge case nested layout + pagecache, chưa có usage thật (YAGNI) | Có layout lồng + yield cùng lúc trong app |
| D3 | Test e2e `@bind(user.name)` (dot-path lồng) | `getStateByKey`/`updateStateAddressKey` đã hỗ trợ dot-path; khả năng chạy đúng nhưng CHƯA verify | Trước khi tài liệu hoá `@bind` dot-path là tính năng chính thức |
| D4 | Fallback content cho lỗi ở tầng listener (§2.8) | Tầng đó không biết vùng DOM nào hỏng | Có nhu cầu thay nội dung vùng lỗi ngoài Component/Reactive |
| D5 | 2 test compiler hỏng sẵn (`test_blade_template.py`, `test_import_e2e.py`) | Nợ có TRƯỚC phiên này, dùng API cũ (`renderView.__include`) | Dọn nợ test compiler |
| D6 | `DomService`, `MarkerModel.setContent` | Đã verify **không có caller nào** trong `src/` — dead code, không phải lỗ hổng | Dọn dead code toàn repo |
| D7 | Registry app `saola/resources/js/saola/views.ts` export `{}` | Cần chạy lại compiler cho cây `.sao` hiện tại | Chạy app end-to-end thật |

---

### 1c. Thiếu sót đã nhận diện, CHƯA làm (đối chiếu Vue/React/Svelte/Solid)

Từ phiên rà soát #2. Không phải bug — là tính năng chưa có. Xếp theo
(tác động × độ rẻ), không theo mức độ "framework khác có".

| # | Thiếu | So sánh | Chi phí | Làm khi |
|---|---|---|---|---|
| N1 | `@foreach` không patch tại chỗ theo `@key` — ref đổi là destroy+recreate | React/Vue/Svelte đều patch | Cao | Dòng có DOM state thật (input đang gõ, focus) |
| ~~N2~~ | ~~Không có primitive transition/animation~~ | — | — | ✅ **Xong 2026-08-04**, xem §2.15 |
| ~~N3~~ | ~~Không có nested route~~ | — | — | ✅ **Xong 2026-08-04**, xem §2.17 |
| N4 | Reactivity nông — không deep/Proxy | Vue 3 Proxy bắt được | Cao (thay LÕI) | **Có thể không bao giờ** — xem lập luận §2.16b; GAP-12 + GAP-16 đã lấp phần dùng thật |
| N5 | Không có memo primitive cho list lớn | `v-memo`, `React.memo` | Trung bình | Đo được vấn đề hiệu năng thật. YAGNI tới lúc đó |
| N6 | `@include` props không reactive khi data từ biến loop | React/Vue: truyền `user={user}` là con re-render | — (CHỦ Ý) | Không sửa — cần **ghi tài liệu to**, vì ngược trực giác |

**Ghi chú N6:** compiler emit `stateKeys=[]` cho `@include` trong `@foreach`
(biến loop không nằm trong `state_variables`) → `Component.start()` không
subscribe. Con chỉ cập nhật bằng cách bị destroy+tạo lại theo slot của loop.
Đúng thiết kế, nhưng khác mọi framework khác nên phải nói rõ trong docs.

---

## 2. Đã hoàn thành

### 2.1. SSR / Hydration / Reactive — rà soát toàn bộ

Rà soát bằng cách đọc code + compile thử `.sao` thật (không tin docs cũ —
nhiều claim trong `HYDRATION.md`/`SYSTEM_FAMILIARIZATION.md` đã lỗi thời,
được đối chiếu lại bằng code hiện tại).

- ✅ Marker shortcut table khớp 100% giữa `client/src/core/services/MarkerRegistry.ts`
  và `core/src/core/View/Services/ViewStorageManager.php`.
- ✅ Nested layout viewId discovery đã implement đầy đủ
  (`ViewManager.discoverChainViewId`, `client/src/core/view/ViewManager.ts:525`)
  — docs cũ ghi "chỉ single layout" đã sai/lỗi thời.
- ✅ Compiler class-binding reactivity đúng (verify bằng compile thật
  `saola/.../demo/index.sao` — `stateKeys` được điền đúng).
- ⚠️ `@yield`/`@section` (cơ chế cũ, độc lập với cơ chế mới xây ở §2.2) từng
  là dead code — đã thay thế hoàn toàn bởi SectionManager mới, xem §2.2.

### 2.2. `@section` / `@yield` + `HeadService` — xây mới hoàn chỉnh

**Vấn đề gốc:** `YieldElement.render()` chỉ đặt marker rỗng,
`contentFactory` không bao giờ được gọi, `yieldContent()` gọi vào method
không tồn tại trên `ViewManager`. `@yield`/`@section` là dead code hoàn toàn
dù compiler đã emit đúng từ lâu.

**Đã xây:**
- [`SectionManager.ts`](../src/core/services/SectionManager.ts) — viết lại
  hoàn toàn (thay bản copy chết của BlockManager), mirror pattern
  Block↔BlockOutlet: mount text/html content vào yield marker, reactive theo
  `stateKeys`, cross-controller (section khai báo ở page, yield dùng ở layout).
- **Section-as-block** (`contentType: 'html'`): mount children thật giữa
  marker, cùng insertion pattern với `BlockManager.mountBlockIntoOutlet`.
- **Section-as-value trong attribute/textarea** (`contentType: 'text'`):
  `this.yieldContent(name, default)` resolve đồng bộ; trong `<textarea>` set
  thẳng `.value` thay vì chèn text node (tránh lỗi "mutate text node con
  textarea sau khi live thì không cập nhật hiển thị").
- [`HeadService.ts`](../src/core/services/HeadService.ts) — quản lý
  `<title>`/`<meta>`/`<link>`/JSON-LD **độc lập với mọi view**, gọi được từ
  bất kỳ đâu qua `app('Head')`/`App.Head`, đăng ký trong DI container như
  `Http`/`Router`. Reuse tag SSR đã render (không tạo trùng), snapshot giá
  trị gốc để `resetPage()` trả lại đúng — sửa luôn bug rò rỉ `meta:*` từ
  trang A sang trang B khi navigate.
- **Attribute-embedded `@yield` reactive** (`<meta content="@yield(...)">`):
  compiler emit thêm `yieldName` vào attr config; `Html.ts::_applyAttr` subscribe
  qua `SectionManager.subscribe(yieldName, cb)` — cập nhật sống khi section
  đổi, dù không có `stateKeys` tĩnh nào (section nào đang active chỉ biết ở
  runtime).
- Sửa kèm (root cause, phát hiện khi xây): `YieldElement` thiếu prefix
  `viewId` vào marker id (khác `Component`/`Reactive`/`Output`) → sẽ hydrate
  sai marker; thiếu guard idempotent ở `render()` mà `BlockOutlet` đã có;
  `ViewController.section()` không cập nhật `renderFactory` khi re-render
  (closure cũ kẹt mãi mãi).

**Test:** [`tests/elements/section-yield.test.ts`](../tests/elements/section-yield.test.ts)
(10 test), [`tests/services/head.test.ts`](../tests/services/head.test.ts) (7 test).

**Chưa làm / follow-up biết trước:**
- Pagecache detach/reregister cho yield khi layout bị cache (edge case nested
  layout + pagecache, chưa có usage thật → bỏ qua theo YAGNI, note lại đây
  nếu sau này cần).

### 2.3. `@await` / prerender — 3 bug đã sửa

Phát hiện + sửa qua 2 vòng (vòng 1 sai, bị bắt lỗi và sửa lại đúng ở vòng 2 —
xem bài học ở §5).

1. **Compiler: `hasPrerender` gần như không bao giờ bật.** Hai bug regex độc
   lập trong `main_compiler.py`:
   - `_extract_vars_names` không cắt phần `= giá_trị_mặc_định` khỏi tên biến.
   - `_template_uses_vars` chỉ khớp biến kiểu PHP `$tên` (cùng lớp bug đã
     từng sửa ở `template_ast.py::_get_state_vars` nhưng bỏ sót chỗ này).
   Verify bằng compile thật `examples/sao/await.sao`: trước fix
   `hasPrerender: false`, sau fix `true`. Cả hai đã sửa.
2. **Client: hydrate phải VẪN gọi `prerender()`, chỉ bỏ fetch + bỏ hiển thị
   skeleton.** Lần sửa đầu (sai): bỏ qua `prerender()` hoàn toàn khi hydrate
   — làm mất các block/section TĨNH mà compiler chỉ đăng ký trong
   `prerender()` (vd `block-footer`, `section('sidebar')` trong
   `await.sao` — `render()` không khai báo lại). Lần sửa đúng
   (`ViewManager.ts:585-611`): vẫn gọi `prerender()` (đăng ký block tĩnh),
   rồi gọi ngay `render()` với data đã có từ SSR (đè placeholder → nội dung
   thật) — không `await Http.get()`, không flash (hydrate không insert DOM ở
   bước nào).
3. **Client: swap sau fetch không hoạt động với trang `@extends`/`@block`.**
   Cơ chế swap `preloadElement`→`mainElement` chỉ set khi gọi
   `this.wrapper(...)`; trang dùng layout gọi `this.block(...)` +
   `return this.extendView(...)`, không bao giờ set 2 field đó → code log
   "swap done" nhưng DOM vẫn hiện skeleton mãi mãi. Test tái hiện bug trước
   khi sửa (`prerender-layout.test.ts`). Sửa: thêm nhánh khi
   `render()` trả về layout-chain (`finalResult.superView`), gọi
   `blockManager.mountViewBlocks()` + `sectionManager.mountViewSections()` +
   `startAll()` — đúng cơ chế mount ban đầu vẫn dùng
   (`ViewManager.ts:633-648`).

**Test:** [`tests/view/mountview.test.ts`](../tests/view/mountview.test.ts)
(describe `hydrateView`), [`tests/view/prerender-layout.test.ts`](../tests/view/prerender-layout.test.ts).

**Trạng thái cuối §2:** client 30/30 file · 276/276 test pass; compiler 6/8
script pass (2 fail còn lại là nợ test cũ có từ trước phiên này, không liên
quan — `src/common/test_blade_template.py`, `test_import_e2e.py`).

---

### 2.4. Error boundary (GAP-03) + `showError` an toàn (GAP-07) — 2026-08-03

**API mới — `onError` trong `ctrl.setup({...})`:**
```ts
onError(err: unknown, info: { phase: 'render'|'update'|'async', path: string }): children | void
```
- Trả children → dùng làm **fallback** cho vùng lỗi.
- Trả `undefined` → coi như "chỉ ghi nhận", lỗi **bubble tiếp** lên boundary cha.
- `info.path` là path của view **nơi lỗi xảy ra** (có thể là view con), không
  phải view chứa boundary.
- Boundary tìm theo chuỗi `ctrl.parent` (`ViewController.handleError`). Điểm
  bắt đầu tìm là controller **chứa** `@include`, nên `onError` của một view
  KHÔNG bắt lỗi render của chính nó — giống React ErrorBoundary.

**Điểm đã wrap:**
| Nơi | Phase | Ghi chú |
|---|---|---|
| `Component.ts` (`guardChildMount`) | `render` | cô lập nguyên subtree `@include`; `mountFallback()` dọn DOM dở dang rồi chèn fallback giữa markers |
| `Reactive.ts` (`render` → `_render`) | `update` (đã mounted) / `render` | lỗi sau tương tác — trước đây nằm ngoài mọi try/catch |
| `ViewManager.renderPageView` Case 2/3 | `async` | fetch hỏng: trước chỉ log → skeleton treo vĩnh viễn |

**Bất biến (có test):** boundary gần nhất thắng · `onError` tự throw → bỏ qua
boundary đó, bubble tiếp, **không lặp vô hạn** (cờ `_handlingError`) · không
boundary nào → giữ hành vi bubble.

**Lỗ hổng có sẵn phát hiện khi viết test — đã vá:** `activateRenderedChain`
(phase mount) nằm **ngoài** mọi try/catch của `mountView`/`hydrateView`. Lỗi
lúc gắn tree vào DOM (vd `@include` con throw) **thoát hẳn ra ngoài** →
unhandled promise rejection + trang mount dở, KHÔNG hề rơi vào `showError` như
tôi giả định lúc lập kế hoạch. Đã bọc try/catch ở cả 2 nơi → `showError` giờ
đúng vai "lưới cuối".

**GAP-07:** `showError` dựng bằng `createElement` + `textContent` +
`replaceChildren` thay cho nội suy chuỗi vào `innerHTML`; `JSON.stringify`
bọc try/catch (details có thể circular).

**Test:** [`tests/view/error-boundary.test.ts`](../tests/view/error-boundary.test.ts) (7 test).
Tổng: 31 file / 283 test pass.

---

### 2.5. Lazy-load view — Phần A: runtime (GAP-01) — 2026-08-03

Registry giờ chấp nhận `'web.about': () => import('./about.js')` ở **cấp route**.

**API:**
| Method | Dùng khi |
|---|---|
| `await View.view(name, data, cache)` | async; hỗ trợ lazy. Dùng bởi `mountView`/`hydrateView` |
| `View.resolveViewSync(name, data, cache)` | **đồng bộ** — `@include`/`@extends`; lazy chưa preload → `null` + log hướng dẫn |
| `await View.preloadView(name)` | nạp trước view lazy để `resolveViewSync` dùng được |

**3 shape được chấp nhận sau khi resolve** (`unwrapLazyFactory`) — người viết
registry không phải tự `.then(m => m.default)`:
module namespace `{default: factory}` · factory trần · View instance.

**`resolvedFactories: Map`** cache factory ĐÃ unwrap → navigate lần 2 không
await/unwrap lại (test đếm bằng spy: loader gọi đúng 1 lần).

**⚠ Giới hạn đã biết (không phải bug):** `@include`/`@extends` chạy trong
render tree **đồng bộ** — không await được. View lazy dùng ở 2 chỗ này phải
`preloadView()` trước, hoặc để eager. Trước đây 2 đường này gọi `view()` và
sẽ nhận Promise → vỡ ngầm ở `view.__ctrl__`; nay trả `null` + log nêu rõ cách
khắc phục.

**Lỗi import** (chunk 404/mạng) → `null`, không throw ra Router; app vẫn
navigate tiếp được (có test).

**Test:** [`tests/view/lazy-view.test.ts`](../tests/view/lazy-view.test.ts) (9 test),
gồm regression "View trực tiếp (eager) — hành vi cũ KHÔNG đổi".
Tổng: 32 file / 292 test pass.

### 2.5b. Lazy-load view — Phần B: generator (GAP-01) — 2026-08-03

`registry-generator.js` sinh được `'web.posts': () => import('./posts.js')`.

**Bật (opt-in) trong context config:**
```json
"registry": { "lazy": true, "eager": ["web.modules.home"] }
```
Không khai báo → **eager 100% như cũ**, mọi app hiện có không đổi hành vi.

**Tự động ép eager** (`_resolveEagerSet`) — nguyên tắc *không chắc → eager*,
vì đoán sai chiều lazy là **vỡ runtime**, còn eager dư chỉ mất tối ưu:
1. **Layout** — dot-path khớp `(^|\.)layouts?\.`
2. **View bị `@include`/`@extends`** — quét output đã compile, gom **mọi**
   string literal trong vùng tham số của `include|includeIf|includeWhen|extendView`
   rồi so khớp theo hậu tố (đường dẫn trong output có tiền tố runtime
   `__template__ + 'x'` nên không so khớp nguyên chuỗi được).
   → cả 2 nhóm này resolve **đồng bộ** qua `resolveViewSync`, lazy là vỡ.
3. **`registry.eager[]`** của user — khớp đúng hoặc theo tiền tố segment
   (`web.modules` khớp `web.modules.posts.list`, KHÔNG khớp nửa chừng tên).

**TypeScript:** khi bật lazy, type registry nới thành
`Record<string, (...) => View | Promise<any>>` — nếu không `tsc` của app sẽ đỏ.

**⚠ Việc cần làm khi thực sự bật cho app:** view entry của route hay được
truy cập nên nằm trong `eager[]`. Lazy entry + SSR → user thấy HTML ngay
nhưng phải chờ tải chunk mới hydrate xong (trang hiện mà bấm chưa ăn).
Cách khử triệt để là server phát `<link rel="modulepreload">` cho chunk entry —
chưa làm, thuộc `core/` + app shell.

**Test:** [`compiler/tests/test_registry_lazy.js`](../../compiler/tests/test_registry_lazy.js)
(9 test, gồm regression "mặc định eager 100%").

---

### 2.6. Testing utilities (GAP-06) — 2026-08-03

`tests/helpers/harness.ts` → `src/testing/index.ts`, export công khai
**`@saolabs/client/testing`**. Hướng dẫn dùng: [TESTING.md](TESTING.md).

**API:** `mount(factory, data?)` (view ĐÃ COMPILE — dành cho người dùng
framework) · `mountView(renderFn, options?)` (render function viết tay — test
element/lifecycle lẻ) · `nextFrame()` · `Harness{ container, text(), setState,
getState, view, ctrl, destroy }`.

`tests/helpers/harness.ts` giờ chỉ **re-export** → ~300 test nội bộ chạy trên
đúng code người dùng nhận được, không còn 2 bản song song lệch nhau.
Module không import runner nào (vitest/jest) nên dùng được với mọi runner.

**Phát hiện khi làm — `dist` layout:** `tsconfig` có `rootDir: "."` nên
`src/testing/index.ts` build ra **`dist/src/testing/index.js`** (không phải
`dist/testing/`). Export đã trỏ đúng đường dẫn thật; kiểm bằng script duyệt
`package.json.exports` xem file có tồn tại không → xem GAP-08.

**Test:** [`tests/testing/public-testing-api.test.ts`](../tests/testing/public-testing-api.test.ts) (5 test).

---

### 2.6b. Export `./core` chết + `check-exports` (GAP-08) — 2026-08-03

Xoá entry `./core` khỏi `package.json.exports` — trỏ `./dist/core/index.js`
vốn **không bao giờ tồn tại** (`src/core/index.ts` không có trong repo, và
`rootDir: "."` đẩy mọi thứ ra `dist/src/...`). Không thể resolve → chắc chắn
chưa ai dùng được, xoá an toàn. Không tạo barrel thay thế (YAGNI — chưa có
nhu cầu thật).

Thêm [`scripts/check-exports.js`](../scripts/check-exports.js) duyệt mọi
entry `exports` (cả `types`/`import`/`require`) xác minh file tồn tại, gắn vào
`prepublishOnly` → lỗi loại này bị chặn ở khâu đóng gói thay vì nổ lúc người
dùng import. Chạy riêng: `npm run check-exports`.

---

### 2.7. `computed()` có memo hoá (GAP-04) — 2026-08-03

```ts
states.__.computed('total', () => qty * price, ['qty', 'price']);
```

**Lazy + memo:** dep đổi → chỉ đánh dấu bẩn; tính thật lúc ĐỌC. Dep đổi 5 lần
trong 1 batch → tính 1 lần; đổi mà không ai đọc → không tính (có test).

**Dùng như state thường:** slot nằm chung `states` với `value` là *getter*
(`Object.defineProperty`) nên MỌI đường đọc đều tươi — `getStateByKey(key)`,
`viewState[key]`, `states[key].value` trực tiếp. Output/Reactive chỉ cần
`stateKeys: ['total']`, không cần biết đó là computed. Read-only (set → warn).

**Bug ở flush core phát hiện khi làm — đã sửa:** listener của computed
`enqueueChange(key)` **trong lúc** đang flush, nhưng `flushChanges()` đã
snapshot xong và `hasPendingFlush` vẫn true → key mới nằm lại hàng đợi, không
ai flush tiếp, cập nhật dẫn xuất **kẹt tới lần state đổi kế tiếp**. Sửa:
`executeFlush()` lặp cho tới khi hàng đợi lắng trong **cùng frame**, có trần
`MAX_CASCADE = 20` + cảnh báo để chặn computed phụ thuộc vòng. Ảnh hưởng cả
`flushNow()` (dùng chung `executeFlush`) → cascade cũng đúng khi hydrate/resume.

Tách `enqueueChange()` ra khỏi `commitStateChange()`: bản cũ so sánh giá trị
cũ/mới, mà so sánh thì phải ĐỌC `states[key].value` → kích hoạt tính lại ngay,
mất tính lazy.

**Test:** [`tests/view/computed.test.ts`](../tests/view/computed.test.ts) (9 test).

---

### 2.7b. Cú pháp `@computed` cho `.sao` (GAP-04b) — 2026-08-03

```
@states({ first: 'Sao', last: 'La', qty: 2, price: 10 })
@computed(fullName = first + ' ' + last)
@computed(total = qty * price)

<blade>
    <h1>{{ fullName }}</h1>
    <p>Total: {{ total }}</p>
</blade>
```

Sinh trong CONSTRUCTOR scope (không phải render(), xem lỗi phát hiện dưới):
```js
let fullName;
const get$fullName = __STATE__.__.computed('fullName', () => first + " " + last, ["first", "last"]);
fullName = get$fullName();
__STATE__.__.subscribe(['fullName'], () => { fullName = get$fullName(); });
```
`fullName`/`total` dùng được như bare identifier trong `{{ }}`/attr/reactive —
y hệt state thường, vì compiler đăng ký tên chúng vào CHUNG `usestate_variables`
(set mà mọi output/attr/class codegen đã dùng để trích `stateKeys`).

**Phát hiện quan trọng khi wire — có 2 hệ thống xử lý khai báo song song, 1 hệ
chết:** ban đầu tôi nối `@computed` vào `parsers.py::parse_let_directives`'s
anh em (`let_declarations`/`directives_line`) — build chạy, `stateKeys` đúng,
nhưng **runtime báo `fullName is not defined`**. Compile thử thật + đọc kỹ mới
phát hiện `directives_line` được truyền vào
`function_generators.generate_render_function()` nhưng **bị bỏ qua hoàn
toàn** (comment ngay đầu hàm: *"vars_line and directives_line are now handled
in wrapper scope"*) — hệ thống ĐANG SỐNG cho việc SINH CODE là
`common/declaration_tracker.py::DeclarationTracker` (parse theo VỊ TRÍ, giữ
đúng thứ tự khai báo) → `main_compiler.py::_generate_wrapper_declarations()`
(sinh code constructor thật, đúng chỗ tôi thấy trong output đã compile —
`let first = null; const setFirst = ...`). Đây là lần THỨ BA gặp đúng lớp bug
này trong dự án (`@class`: `class_binding_handler.py` chết vs
`template_ast.py` sống; `@bind`: `binding_directive_service.py` chết vs
`template_ast.py` sống; nay `@let`/`@const`/`@computed`: `directives_line`
chết vs `DeclarationTracker` sống) — xem quy tắc 2 đường đã áp dụng lại đúng lúc.

> **Đính chính (rà soát lại 2026-08-03):** phát biểu ban đầu của tôi — *"toàn
> bộ `directives_line` mechanism chết"* — là **nói quá**. Chính xác:
> `directives_line` (chuỗi code sinh ra) bị bỏ qua, nhưng
> `let_declarations`/`const_declarations` (đầu vào của nó) VẪN SỐNG cho việc
> PHÂN TÍCH: `_calculate_prerender_need()` (chính chỗ đã fix `hasPrerender`
> ở §2.3), `_detect_state_keys()`, `_declarations_use_vars()`,
> `_extract_declared_template_variables()`. Nên **không được xoá**
> `parse_let_directives`/`parse_const_directives` — chỉ nhánh sinh code là
> chết. Bài học phụ: "chết" phải nói rõ chết ở khâu nào.

**Verify việc đọc giá trị BAN ĐẦU đúng — không phải chỉ đoán:** `@computed`'s
dòng khởi tạo (`fullName = get$fullName()`) chạy NGAY trong constructor, lúc
`first`/`last` còn `let x = null` (giá trị thật chỉ được gán sau, trong
`commitConstructorData()`, chạy SAU). Viết riêng
[`tests/contract/computed.contract.test.ts`](../tests/contract/computed.contract.test.ts)
mount qua `ViewManager.mountView()` THẬT (không qua test harness rút gọn) để
verify DOM đúng `"Sao La"` ngay lập tức, không cần `await nextFrame()` thêm —
**pass nhờ đúng cascade-fix đã làm ở §2.7** (`activateView()`'s `flushNow()`
chạy SAU `start()` nên mọi subscriber — kể cả mirror-sync của computed — đã
sẵn sàng nhận cascade trong CÙNG 1 lần flush).

**Test:** [`compiler`] compile thật + đối chiếu output (không có test file
riêng — theo đúng mẫu đã dùng cho `@bind`/`@class` trong phiên này);
[`tests/contract/computed.contract.test.ts`](../tests/contract/computed.contract.test.ts) (1 test, qua pipeline thật).

---

### 2.8. Lỗi trong callback subscribe bị nuốt im lặng (GAP-09) — 2026-08-03

**Phát hiện khi rà soát lại GAP-03 xem có bỏ sót điểm throw nào.**
`StateManager.flushChanges()` bọc mỗi listener bằng try/catch nhưng chỉ
`console.error` → lỗi **không tới boundary**, DOM giữ giá trị cũ. Im lặng sai
tệ hơn nổ: `{{ user.name }}` khi `user` thành `null` sẽ đứng yên ở giá trị cũ,
không ai biết.

Phạm vi ảnh hưởng rộng — MỌI factory người dùng chạy khi state đổi đều đi qua
đây: `Output` (`{{ }}`), `TextElement`, `Html` attr/class/style/prop binding,
mirror-sync của `@computed`. GAP-03 trước đó chỉ bọc `Component`/`Reactive`/
fetch async, nên toàn bộ nhóm này lọt lưới.

**Sửa:** `reportListenerError()` trong `ViewState.ts` — 1 chỗ bao trọn cả
single-key lẫn multi-key listener, route về `controller.handleError(err,
{phase:'update'})`, không boundary nào nhận → giữ `console.error` như cũ.

**Giới hạn có chủ ý:** tầng này KHÔNG nhận fallback content (không biết vùng
DOM nào hỏng) — boundary chỉ được BÁO để log/đặt state lỗi. Muốn thay nội dung
vùng lỗi thì đặt boundary ở `Component`/`Reactive`, nơi có ranh giới marker.

**Test:** 2 test mới trong
[`tests/view/error-boundary.test.ts`](../tests/view/error-boundary.test.ts)
(boundary được báo; không boundary → app vẫn sống). Tổng **35 file / 309 test**.

---

### 2.9. DevTools (GAP-05) — 2026-08-04

Hướng dẫn dùng: [DEVTOOLS.md](DEVTOOLS.md).

**Quyết định phạm vi — overlay in-page thay vì browser extension.** Kế hoạch cũ
xếp GAP-05 là "dự án extension riêng". Khi bắt tay làm thì thấy phần *giá trị*
nằm ở **hook** (đọc cây view/state/sự kiện), còn extension chỉ là một cách
hiển thị — mà lại kèm scaffolding riêng (manifest, content script, bridge,
publish store). Overlay chạy ngay ở mọi môi trường kể cả webview mobile, chi
phí nhỏ hơn nhiều. Hook tách hẳn khỏi UI nên **extension vẫn dựng được sau**
trên cùng nguồn dữ liệu (cắm `window.__SAOLA_DEVTOOLS_HOOK__` trước khi boot).

| File | Vai trò |
|---|---|
| `devtools/hook.ts` | Thu thập sự kiện + snapshot cây view. Không biết gì về UI |
| `devtools/inspector.ts` | Panel in-page (consumer của hook) |
| `devtools/index.ts` | API công khai `App.devtools`, đăng ký DI tên `Devtools` |

**Zero-cost khi tắt:** `emit()` thoát ở dòng đầu nếu chưa bật — không tạo
object, không serialize. Không cần cờ build để loại khỏi production.

**Không tạo nguồn sự thật thứ hai:** snapshot đọc thẳng từ
ViewManager/ViewController lúc gọi, hook không giữ state song song → không có
gì để lệch. Đổi lại phải thêm accessor `ViewManager.getLayoutChain()`.

**Sự kiện:** `view:mounted`, `view:destroyed` (`ViewController`),
`state:changed` kèm key đổi (`ViewState.flushChanges`), `error` kèm phase +
message (`ViewController.handleError` — dùng lại đúng đường của GAP-03/09).
Vòng đệm 200 sự kiện để mở panel muộn vẫn xem được lịch sử.

**An toàn:** panel dựng toàn bộ bằng `createElement` + `textContent` — state
có thể chứa dữ liệu người dùng nhập, nội suy `innerHTML` là đường tiêm HTML
(đúng lỗi đã vá ở §2.4). Có test riêng: state chứa `<img onerror>` phải hiển
thị dạng text, không tạo element. Snapshot state qua JSON round-trip nên cấu
trúc vòng không làm nổ panel.

**Chưa có:** time-travel (tốn bộ nhớ, chưa làm), sửa state từ panel (chỉ đọc),
extension đóng gói sẵn.

**Test:** [`tests/devtools/devtools.test.ts`](../tests/devtools/devtools.test.ts)
(10 test). Tổng: **36 file / 319 test**.

---

### 2.10. `@foreach` refresh list + rò registry (GAP-10, GAP-11) — 2026-08-04

**Triệu chứng:** list user render xong, sửa 1 user, client refresh list →
**view con của `@include` biến mất khỏi DOM** (không phải hiện data cũ — mất
trắng vùng đó, im lặng).

**Gốc:** [`ForeachSlotCache.store()`](../src/core/elements/ForeachSlotCache.ts)
làm `slots[occ] = slot`. Slot cũ rơi khỏi `_map` NGAY lúc ghi đè, mà
`prunePass()` chỉ duyệt `_map` → không bao giờ destroy nó. Docstring khẳng
định ngược lại — **doc sai, không phải code đúng**.

Kích hoạt: cùng cache key + object ref MỚI = đúng kịch bản refresh từ server
với `@key(item.id)` (id giữ nguyên, ref đổi vì JSON parse).

Dây chuyền: slot cũ không destroy → `Component.__destroyed__` vẫn `false` →
`aliveFromRegistry()` TÁI DÙNG nó → nhưng markers nằm trong `<li>` đã detach
→ `openTag.parentNode` truthy + `_childMounted` true → `mountChild()` return
ngay → không mount gì.

**Vá:**
- `_evicted[]` giữ slot bị ghi đè, `prunePass()` destroy nó trước (GAP-10).
- `__foreach` khôi phục `_foreachSkipRegistry` cũ thay vì gán cứng `false`,
  và đóng `_currentForeachCache` quanh callback → `@foreach` lồng inline
  không mượn cache của loop ngoài (trước đó slot loop trong bị prunePass của
  loop ngoài destroy oan mỗi khi item ngoài là cache HIT).
- `ViewController.registerElement/releaseElement` — WeakMap `element → key`,
  vì key registry là id THÔ còn `element.id` phần lớn đã prefix `viewId`.
  Guard `=== el` bắt buộc: pass mới đã ghi element mới vào cùng id TRƯỚC khi
  prunePass destroy element cũ (GAP-11).
- `markerRegistry.remove()` trong `destroy()` của Reactive/Block/BlockOutlet.
  `MarkerRegistry` là singleton **toàn cục** (sống qua navigate) mà `register()`
  chưa từng có `remove()` đối ứng — 0 caller (GAP-11).
- `YieldElement.__destroyed__` — thiếu hẳn field nên Yield đã destroy vẫn bị
  `aliveFromRegistry` tái dùng.

**Đo được** (6 trang × 10 dòng, DOM luôn 10 item):
`ctrl.elements` 32 → 182 · `MarkerRegistry` 15 → 65. Sau vá: hằng số.

**Test:** [`tests/foreach/foreach-refresh.test.ts`](../tests/foreach/foreach-refresh.test.ts) (4 test).

---

### 2.11. Mutate tại chỗ thất bại im lặng (GAP-12) — 2026-08-04

Reactivity so `===`. `list.push(x)` / `list[0].name = 'x'` giữ nguyên
reference → **không cập nhật gì, không báo gì**. Lớp bug tốn thời gian nhất
của mô hình này (Vue bắt bằng Proxy; React có eslint + StrictMode).

`StateManager.warnSameReference()` — cảnh báo warn-once theo `view::key`.
Hai lớp lọc để KHÔNG có dương tính giả:
- chỉ object/array (set lại cùng số/chuỗi là bình thường, vô hại);
- chỉ đường `setValue` (dev tự set). Đường `updateStateByKey` — `update$x()`
  lúc init và `__UPDATE_DATA_TRAIT__` khi cha truyền props — hoàn toàn có thể
  re-pass đúng ref cũ một cách hợp lệ.

Bản đầu đặt ở `commitStateChange` cho MỌI đường và lộ ngay 1 dương tính giả
khi chạy suite — xem bài học §5.

**Test:** [`tests/view/mutate-in-place-warning.test.ts`](../tests/view/mutate-in-place-warning.test.ts) (5 test).

---

### 2.12. A11y sau điều hướng (GAP-13) — 2026-08-04

Full page load làm sẵn hai việc mà SPA thì không: (1) focus quay về đầu nội
dung, (2) báo cho screen reader biết trang đã đổi. `applyScroll()` đã có
nhưng focus thì chưa — bàn phím vẫn kẹt ở link của trang TRƯỚC, Tab tiếp tục
từ vị trí đã bị gỡ khỏi DOM.

`Router.announceNavigation()` chạy ngay sau `applyScroll()`:
- focus container view, `tabindex="-1"` + `focus({preventScroll: true})`
  (không phá scroll vừa set);
- live region `aria-live="polite"` đọc `document.title`, ghi ở frame sau vì
  AT chỉ đọc lại khi nội dung **đổi**;
- ẩn bằng `clip` chứ KHÔNG `display:none` (cái đó làm AT bỏ qua luôn);
- bỏ qua `type === 'initial'` — lần paint đầu/hydrate không cướp focus;
- `destroy()` gỡ region.

**Test:** [`tests/integration/router-a11y.test.ts`](../tests/integration/router-a11y.test.ts) (3 test).

---

### 2.13. Props có kiểu ở TS mode (GAP-14) — 2026-08-04

Trước: `constructor(__data__ = {}, ...)` không kiểu → một view `.sao` KHÔNG có
contract compile-time nào về thứ cha truyền vào. `{{ $count.toUpperCase() }}`
với `count = 0` không hề bị `tsc` bắt. Lỗ hổng lớn nhất của một framework
tự nhận TS-first — và dữ liệu để vá **đã có sẵn** trong khối `@props({...})`.

Compiler emit thêm `export interface {Name}Props`, dùng cho cả constructor và
factory. Kiểu suy TỪ LITERAL của default (`[]`→`any[]`, `0`→`number`,
`'x'`→`string`, `true`→`boolean`, `{}`→`Record<string, any>`); biểu thức →
`any`, **không đoán bừa** (đoán sai làm `tsc` báo lỗi ở code đúng, tệ hơn
không đoán).

Index signature `[key: string]: any` là **bắt buộc**, không phải cho tiện:
data thật luôn mang thêm key ngoài khai báo (route params, systemData,
`__SSR_VIEW_ID__`) — interface đóng sẽ làm mọi view không compile được.
Đã verify prop khai báo VẪN bị check dù có index signature:
`Demo({ count: 'x' })` → `TS2322`.

JS mode không đổi một byte nào.

**File:** `compiler/src/templates/view.js` (placeholder
`[COMPONENT_PROPS_INTERFACE]`), `main_compiler.py::_generate_props_interface`
+ `_infer_prop_type`.
**Test:** `compiler/tests/test_props_interface.py` (20 check).

> Bẫy gặp phải: `all_declarations` bị **gán lại thành list khác** ở giữa
> `compile_blade_to_js` (dòng ~569, chỉ còn @let/@const dạng string), nên chỗ
> sinh interface phải giữ bản gốc vào `data_declarations` ngay sau khi parse.

---

### 2.14. Event modifier (GAP-15) — 2026-08-04

`@click.prevent.stop(...)`, `.self`, `.once` — xếp chồng được.

Modifier đi trong bucket **riêng** `eventModifiers: { click: [...] }` cạnh
`events`, KHÔNG nhét vào trong: shape `events: {click: [...]}` là contract sẵn
có với `Html.addEventListeners`, và view compile trước tính năng này không có
key đó nên chạy y nguyên.

- `self` kiểm TRƯỚC `prevent`/`stop` (giống Vue): event từ element con coi như
  không xảy ra thì cũng không được preventDefault.
- `once` là option của `addEventListener`, không bọc handler.
- Modifier gõ sai → **cảnh báo + bỏ qua**, handler vẫn đăng ký (gõ sai không
  được làm mất event).

Tập hợp lệ `EVENT_MODIFIERS` (compiler) phải khớp type `EventModifier`
(client) — như quan hệ marker shortcut ↔ `ViewStorageManager`.

**File:** `template_ast.py` (parse + `EVENT_MODIFIERS`), `render_generator.py`
(emit), `Html.addEventListeners`, `ViewController.wrapEventModifiers`.
**Liên quan:** `saola-language-support` — grammar `sao.tmLanguage.json`
(2 pattern), completion + snippet.
**Test:** `compiler/tests/test_event_modifiers.py` (10 check),
[`tests/directives/event-modifiers.test.ts`](../tests/directives/event-modifiers.test.ts) (6 test).

---

### 2.15. Transition enter/leave (N2) — 2026-08-04

`@transition('fade')` trên element. Quy ước class giống Vue để người dùng
không phải học lại: `fade-enter-from` `fade-enter-active` `fade-enter-to`,
và bộ `fade-leave-*` tương ứng.

**Dùng `element.getAnimations()` thay vì nghe `transitionend`.** `transitionend`
bắn MỘT lần cho MỖI property, không bắn khi giá trị không đổi, và không phân
biệt transition của element với của con — nên cách làm kinh điển (Vue 2015)
phải parse `transition-duration` rồi hẹn giờ dự phòng. `getAnimations()` trả
thẳng mọi animation đang chạy kèm promise `.finished`, đúng cả khi nhiều
property lẫn khi bị huỷ giữa chừng. **Không có animation nào → resolve ngay**,
nên khai báo `@transition` mà quên viết CSS thì node vẫn biến mất sau ~1 frame
chứ không kẹt lại (đây cũng là đường chạy trong jsdom).

**Ba chỗ khó, đều đã xử lý:**

1. *Element leave phải NẰM LẠI DOM* tới khi animation xong, trong khi
   `Reactive.clearContent()` và `_cleanOrphanNodes()` quét sạch mọi node giữa
   cặp marker. → `isLeaving(node)` cho hai vòng quét đó bỏ qua; node tự gỡ khi
   xong.
2. *Không được xoá trắng nội dung khi đang bay ra.* `destroy()` của child Html
   gỡ luôn DOM của nó, nên teardown cây con phải HOÃN tới sau leave
   (`teardownSubtree()` tách riêng). Element vẫn inert ngay lập tức — listener
   gỡ, binding huỷ — chỉ phần nhìn được giữ lại.
3. *Enter/leave chồng nhau khi reorder.* Mỗi element mang một sequence token;
   sequence cũ thấy token đã đổi thì thoát, không đụng DOM nữa.

**Không làm** (rung chuông khi cần thì thêm): move/FLIP transition,
transition group, JS hook (`@before-enter`...), `mode="out-in"`.

`destroy()` của element KHÔNG khai báo `@transition` vẫn **đồng bộ y như cũ** —
có test khoá riêng điều này.

**File:** `src/core/helpers/transition.ts` (mới), `Html.maybeRunEnter`/
`destroy`/`teardownSubtree`, `Reactive` (2 vòng quét), `template_ast.py` +
`render_generator.py`, extension (grammar/completion/snippet).
**Test:** [`tests/elements/transition.test.ts`](../tests/elements/transition.test.ts)
(9 test, gồm 1 test tích hợp item rời `@foreach`),
`compiler/tests/test_transition.py` (9 check).

---

### 2.16. Mutate không kèm set + `subscribe` nuốt key (GAP-16) — 2026-08-04

Hai lỗi ÂM THẦM trong chính luồng reactive — không throw, không log, chỉ là
UI đứng im.

**(a) `subscribe([...])` bỏ key chưa register.** Nhánh nhiều key lọc
`if (this.states[k])` rồi `if (keys.size === 0) return () => {}` — subscription
biến mất không dấu vết. Nhánh single-key **chưa bao giờ lọc**, nên
`subscribe(['a'])` chạy còn `subscribe(['a','b'])` thì không: bất nhất ngay
trong một hàm. Bỏ bộ lọc; key không bao giờ register thì tự nhiên không bao giờ
fire vì `flushChanges()` đã kiểm `mkl.keys.has(changedKey)`.

**(b) Mutate mà KHÔNG set gì cả.** GAP-12 chỉ bắt được
`list.push(x); setList(list)` — có đi qua setter. Trường hợp này không đi qua
đâu cả:

```js
list.push(x);   // hết. Không cập nhật, không cảnh báo.
```

Chỗ duy nhất còn quan sát được là **lúc flush**: giữ snapshot NÔNG của mỗi
state kiểu object, đối chiếu ở đầu `flushChanges()`. Reference y nguyên mà nội
dung đã khác ⇒ có người mutate ngoài luồng. Nghĩa là lỗi lộ ra ở lần flush kế
tiếp do BẤT KỲ key nào — trong thực tế gần như luôn là tương tác ngay sau đó.

Bắt được: `push`/`splice`/`shift`/`sort`/gán lại phần tử/thêm-bớt field.
**Không** bắt được mutate lồng (`user.profile.name = 'x'`) — ngưỡng có chủ ý,
ghi bằng `ponytail:` tại chỗ.

Dùng chung `warnedKeys` với GAP-12 nên mỗi key chỉ kêu đúng một lần dù bị bắt
bằng đường nào.

**Kiểm chứng quan trọng nhất:** chạy toàn bộ 41 file test — **không có một
cảnh báo giả nào**. Và revert tạm cả hai vá thì đúng 5 test mới fail, 7 test cũ
vẫn pass.

**Test:** [`tests/view/mutate-in-place-warning.test.ts`](../tests/view/mutate-in-place-warning.test.ts) (12 test).

---

### 2.16b. Vì sao KHÔNG làm N4 (deep reactivity bằng Proxy)

Không phải "khó nên bỏ" — mà là **Proxy gần như không mua được gì ở kiến trúc
này**, và cái giá là thay lõi.

**Granularity bị chặn ở tầng key, không phải ở tầng phát hiện.** Subscription
là map phẳng theo TÊN key (`listeners: Map<key, cb[]>`), `stateKeys` do compiler
tính TĨNH. Xem output thật của `@foreach`:

```js
this.reactive(`0c972300`, "foreach", ..., ["users"], ...)   // subscriber DUY NHẤT
  this.__foreach(users, (user, ...) => [
    this.output(`54ca1c00-${user['id']}`, pe, true, [], () => user['name'])
                                              // ↑ stateKeys RỖNG
```

Output của `user['name']` **không đăng ký nghe gì cả** — biến loop không nằm
trong `state_variables`. Cả vùng list chỉ có một subscriber: `Reactive` nghe
`users`. Nên dù Proxy bắt được `users[3].name = 'x'`, nó **không có ai ở tầng
item để gọi** — chỉ có thể `enqueueChange('users')` → re-render toàn vùng. Kết
quả y hệt `state.users = [...state.users]`, đổi lại là phí proxy trên mọi object
và phí get-trap trên mọi lần đọc.

Muốn Proxy có ý nghĩa thật thì phải thay compile-time `stateKeys` bằng runtime
effect tracking — tức thay lõi reactivity, đúng thứ khiến Saola không phải Vue
(không VDOM, không dep graph runtime).

**Hai hệ quả kéo theo:**
- **SSR vỡ.** `stateKeys` là contract SSR/CSR: `sao2blade` gate emit marker theo
  `if skeys or loop_scopes`. Dependency chỉ biết lúc runtime ⇒ server không tính
  được ⇒ marker lệch ⇒ hydration nhân đôi DOM (xem §2.1, GAP-10).
- **Reconciler phải audit lại.** `ForeachSlotCache.claim()` reuse theo
  `slot.item === item`; Proxy phá reference identity trừ khi memo hoá cẩn thận
  (Vue phải giữ WeakMap raw→proxy đúng vì lý do này).

**Kết luận:** GAP-12 + GAP-16 lấp phần dùng thật (mutate rồi set, và mutate rồi
quên set) với chi phí gần bằng không. Phần còn lại của N4 là mutate LỒNG — đuôi
dài, và đánh đổi để lấy nó là thay cả lõi. Nếu một ngày mutate lồng thành vấn
đề đo được thì đó mới là lúc mở lại, và khi đó phải mở cùng lúc với effect
tracking chứ không phải chỉ thêm Proxy.

---

### 2.17. Nested route (N3) — 2026-08-04

**Phần lớn tính năng này HOÁ RA đã có sẵn.** Trước khi thiết kế gì, tôi dựng
probe chạy thật (đúng bài học §5, không kết luận từ đọc code): hai page cùng
`@extends('web.shell')`, điều hướng `/a` → `/b`.

```
sau /a  → shellRenders = 1
sau /b  → shellRenders = 1        ← cha KHÔNG render lại
CÙNG node layout? true
```

`extendView()` resolve layout với `cache: true` nên mọi page dùng chung ĐÚNG
một instance; `ViewManager.renderPageView` thấy `currentLayoutChain.indexOf(superView) >= 0`
thì tái dùng nguyên chuỗi ngoài thay vì render lại. Tức **giữ nguyên view cha
khi chuyển giữa các con — giá trị cốt lõi của nested route — đã hoạt động**.

Cái thiếu chỉ là **tầng cấu hình**: không có cách khai báo cây, nên mỗi route
con phải lặp lại full path và không chia sẻ được `meta`.

Nên bản vá chỉ là một bước flatten trong `addRoutes()` — choke point duy nhất
mà cả `configure()` lẫn `replaceRoutes()` đều đi qua:

```ts
{ path: '/users', meta: { auth: true }, children: [
    { path: '',        component: 'web.users.index'   },   // → /users
    { path: 'profile', component: 'web.users.profile' },   // → /users/profile
    { path: '{id}',    component: 'web.users.detail'  },   // → /users/{id}
]}
```

Quy tắc, tất cả đều có test khoá:
- **Thứ tự khai báo = độ ưu tiên.** `matchRoute()` khớp first-match-wins trên
  bảng phẳng, nên emit giữ nguyên thứ tự để `/users/profile` đứng trước
  `/users/{id}` đúng như người viết mong đợi.
- **`meta` kế thừa**, con ghi đè khi trùng key.
- **Index child (`path: ''`)** sinh đúng path cha → thay route riêng của cha
  cho URL đó (khai báo con là chỉ định cụ thể hơn).
- **Cha không có `component`** = nhóm thuần tuý (gom prefix + meta), không sinh
  route nào cho chính nó.
- **Con bắt đầu bằng `/`** là đường tuyệt đối, thoát khỏi prefix cha.
- Không `children` → bảng route y hệt trước.

**Không tự phát minh outlet mới.** Chỗ render vẫn là `@extends` + `@useBlock` —
con khai báo cha (ngược chiều với `<router-view>` của Vue, nơi cha liệt kê con),
nhưng tương đương về chức năng và đã được test sẵn. Thêm một hệ outlet song
song chỉ để giống Vue là đúng lớp lỗi "2 hệ song song" mà §5 đã gặp 4 lần.

**Test:** [`tests/integration/router-nested.test.ts`](../tests/integration/router-nested.test.ts)
— 8 test flatten + 1 test end-to-end xác nhận `shellRenders` không tăng và DOM
node của cha giữ nguyên khi chuyển giữa hai route con.

---

### 2.18. Registry không co khi view bị XOÁ THẬT (GAP-17) — 2026-08-04

Rà soát theo một trục duy nhất: **tái dùng hết mức khi còn dùng, nhưng nhả sạch
khi đã xoá thật**. Cách đo: điều hướng 80 URL trong khi PageCache LRU chỉ chứa
10 — mọi thứ vượt 10 là bị destroy thật — rồi xem registry nào KHÔNG đứng yên.

```
sau 5  URL | marker=6  theoTag={block:5,  blockoutlet:1} | blocks=5  pageCache=4
sau 80 URL | marker=81 theoTag={block:80, blockoutlet:1} | blocks=11 pageCache=10
                    ↑ tăng tuyến tính, mọi thứ khác đều có trần
```

`BlockManager.blocks` dừng đúng ở 11 (10 cache + 1 active) — Map được dọn đúng.
Nhưng `MarkerRegistry` (singleton **toàn cục**, sống qua mọi navigate) giữ đủ
80 record.

**Gốc:** `unmountView()` làm `this.blocks.delete(key)` mà **không gọi
`block.destroy()`**. Và `Block` KHÔNG nằm trong `ctrl.elements`, nên teardown
cây element cũng không bao giờ chạm tới nó → `markerRegistry.remove()` thêm ở
§2.10 là code không bao giờ chạy tới. Cùng mẫu ở `removeOutletsOfView()` và
`removeYieldsOfView()`.

**Phân biệt bắt buộc:** `detachOutletsOfView()` **cố ý KHÔNG destroy** — layout
chỉ pause vào PageCache và sẽ được re-register khi resume. Destroy nhầm ở đó là
phá chính cơ chế tái dùng. Ranh giới detach ↔ remove giờ ghi rõ tại chỗ.

**Kèm theo:** `MarkerRegistry.clear()` có sẵn nhưng **0 caller** — không teardown
nào dọn nó. Thêm vào `ViewManager.destroy()` (hot reload / unmount root / dọn
giữa test), là chỗ duy nhất có thẩm quyền dọn một singleton tầng module.

**Sau vá:** 80 URL → `block: 11`, khớp **chính xác** số Block còn sống. Đã kiểm
tới 80 lần điều hướng vẫn đứng yên.

**Test:** [`tests/view/registry-cleanup.test.ts`](../tests/view/registry-cleanup.test.ts)
— khẳng định `markersByTag().block === BlockManager.blocks.size` chứ không so
với một hằng số, và app teardown đưa registry về 0. Revert vá → `expected 80 to
be 11`.

> Bài học: **một `destroy()` không có ai gọi trông y hệt một `destroy()` đúng.**
> §2.10 thêm `markerRegistry.remove()` vào `Block.destroy()` và tin là xong —
> không ai gọi hàm đó. Chỉ phép đo mới lộ ra. Khi thêm cleanup vào `destroy()`,
> phải grep NGƯỢC xem ai gọi `destroy()` ấy, và với object không nằm trong
> `ctrl.elements` thì câu trả lời thường là: không ai.

---

### 2.19. Lệch-1 id marker trong loop không `@key` (GAP-18) — 2026-08-04

Lỗi này nằm trong ghi chú dự án từ trước ("still open") nhưng chưa ai vá.
Kiểm bằng cách compile CÙNG một `.sao` qua cả hai CLI rồi so trực tiếp:

```
SSR (sao2blade):  e1b3df84-{$loop->index}       → 0-based: -0, -1, -2
CSR (sao2js):     e1b3df84-${__loopIndex + 1}   → 1-based: -1, -2, -3
```

Item 0 đi claim marker của item 1; item cuối không tìm thấy marker nên element
được TẠO MỚI. Ảnh hưởng **mọi `@foreach` không có `@key`**.

**Vá:** đúng MỘT token — `render_generator.py` bỏ `+ 1`. Phía sao2blade thậm
chí đã ghi js_var là `__loopIndex` (0-based) trong `loop_scopes`, tức ý định
ban đầu vốn là 0-based; chỉ chỗ sinh id đi lệch.

**Vì sao guard cũ không bắt được:** `test_loop_output_marker_sync.py` chỉ dựng
fixture CÓ `@key(todo['id'])` — nhánh dùng biểu thức key, không đụng chỉ số.
Và tệ hơn, `test_foreach_key.py` **khẳng định `'${__loopIndex + 1}'`**, tức
khoá chính cái bug. Test hardcode giá trị thay vì bất biến sẽ biến lỗi thành
"hành vi mong đợi".

**Triệu chứng thật, đo được:** không phải nhân đôi ngay lúc hydrate (element
thừa được tạo nhưng chưa chèn), mà là một element **mồ côi** — sống trong
registry, chưa gắn DOM — sẽ được chèn vào ở lần update kế tiếp. Test runtime
khẳng định `orphans === []`; mô phỏng lệch-1 → `expected [ 'li-3' ] to deeply
equal []`.

**Test:** `compiler/tests/test_loop_index_sync.py` (7 check, so GỐC ĐẾM hai
phía chứ không so chuỗi cứng) +
[`tests/hydration/loop-index-hydration.test.ts`](../tests/hydration/loop-index-hydration.test.ts)
(2 test end-to-end). `test_foreach_key.py` đã sửa để khẳng định ý định, kèm
chú thích vì sao dòng cũ sai.

---

### 2.20. Trường chết + API nói dối (GAP-19) — 2026-08-04

Phát hiện dọc theo cuộc rà soát §2.18.

- `ViewManager.cachedLayouts` — khai báo, **0 tham chiếu** khác trong toàn bộ
  source. Xoá.
- `ViewManager.activeViews` — **chưa bao giờ được ghi**. Hệ quả:
  `isViewMounted()` **luôn trả false** dù view đang hiển thị, và
  `unmountView(path)` là no-op hoàn toàn.

`isViewMounted()` nằm trong `ViewManagerInterface` — API công khai trả sai.
Không xoá mà **sửa cho đúng**: đọc `currentPageView` + `currentLayoutChain` —
dữ liệu SỐNG, đã được cập nhật đầy đủ. `unmountView(path)` thì xoá hẳn: 0
caller và không có gì để triển khai đúng.

Dấu hiệu nhận ra sớm nhất là ở chính test cũ, nó đã né:

```ts
// isViewMounted kiểm tra activeViews — sau mountView standalone, view chưa có...
// Ta test getCurrentView() thay thế
```

**Khi một test phải viết chú thích giải thích vì sao nó KHÔNG kiểm thứ nó định
kiểm, đó là báo cáo lỗi chứ không phải chú thích.** Test giờ khẳng định
`isViewMounted` đúng cho cả view đang mount lẫn view đã rời.

---

## 3. Lỗ hổng cần vá — chi tiết + phương án

### ~~GAP-08~~ — Export `./core` trỏ file không tồn tại · ✅ xong, xem §2.6b

**Đã verify:** script duyệt toàn bộ `package.json.exports` kiểm tra file thật:
```
OK    .         -> ./dist/index.js
OK    ./plugins -> ./dist/plugins.js
MISS  ./core    -> ./dist/core/index.js     ← không tồn tại
OK    ./testing -> ./dist/src/testing/index.js
```
`src/core/index.ts` **không hề tồn tại** trong repo, và `rootDir: "."` khiến
mọi thứ trong `src/` build ra `dist/src/...` — nên đường dẫn này không bao giờ
resolve được. `import ... from '@saolabs/client/core'` luôn lỗi.

**Là lỗi có sẵn**, không do các thay đổi phiên này. Vì không thể resolve nên
chắc chắn chưa ai dùng được → xoá an toàn.

**Phương án (cần chốt):** (a) **xoá** entry `./core` — đúng nhất, vì nó là dead
config; hoặc (b) tạo barrel `src/core/index.ts` re-export public API rồi trỏ
`./dist/src/core/index.js` — chỉ nên làm nếu thật sự muốn có entry point này.
Chưa tự xoá vì đây là public API surface của package.

**Đề xuất bổ sung:** thêm script `check-exports` vào `prepublishOnly` để mọi
entry trong `exports` được xác minh tồn tại trước khi publish — lỗi loại này
lẽ ra phải chặn được ở khâu đóng gói.

---

> **Cách verify (bản 2026-08-03, sau sự cố kết luận sai GAP-02):** mỗi GAP
> dưới đây được kiểm tra bằng **ít nhất 2 đường dẫn độc lập** (runtime client
> + đường compile/generator thật, hoặc code + output thật của app), không
> chỉ 1 lần grep. Mục "Đã verify" ghi rõ đã kiểm gì.

### GAP-01 — Không có code-splitting; đường lazy-load được type/doc nhưng sẽ vỡ nếu dùng · **P1**

**Đã verify (3 đường):**
1. `viewRegistry` chỉ được ĐỌC ở đúng 1 chỗ — `ViewManager.ts:339` trong
   `view()`. `view()` KHÔNG phải `async`, gọi `factory(data, sys)` rồi dùng
   thẳng kết quả; không có `await`/`.then`/`instanceof Promise` nào trong hàm.
2. Cả 2 call site (`mountView` ViewManager.ts:798, `hydrateView`
   ViewManager.ts:1406) đều đã là `async fn` → thêm `await` không phải đổi
   kiến trúc.
3. **Registry generator thực tế emit STATIC EAGER import**
   (`compiler/src/registry-generator.js:52` → `import X from './path.js'`),
   xác nhận bằng file thật `saola/resources/js/saola/web/registry.ts`
   (~17 view, toàn bộ eager).

**Đính chính so với bản kế hoạch trước (hạ P0 → P1):** trước tôi ghi "lazy-load
không hoạt động → P0 chặn production". Chính xác hơn: **app hiện tại KHÔNG vỡ**,
vì generator chỉ sinh eager import và runtime xử lý eager đúng. Vấn đề thật
gồm 2 phần tách biệt:
- **(a) Không hề có code-splitting** — mọi view của mọi route nằm chung 1
  bundle, tải hết ngay lần load đầu. Đây là vấn đề *quy mô*, không phải *hỏng*.
- **(b) Bẫy đã giăng sẵn** — kiểu dữ liệu (`ViewManager.ts:102`) và doc
  (`ViewManager.ts:229-231`, `RUNTIME_ARCHITECTURE.md`) đều quảng cáo
  `() => import('./x.js')` là hợp lệ. Ai dùng đúng như doc → `view` là
  `Promise`, mọi `view.__ctrl__` sau đó vỡ. Chưa ai gặp chỉ vì generator
  chưa bao giờ sinh ra dạng đó.

**Kế hoạch — 2 phần, làm được độc lập:**

*Phần A — runtime chấp nhận lazy factory (client):*
1. `view()` → `async view()`. Sau `const result = factory(data, sys)`:
   nếu `result` là thenable (`typeof result?.then === 'function'`) → `await`.
2. **Chuẩn hoá 3 shape** sau khi resolve (không bắt người viết registry tự
   `.then(m => m.default(...))`):
   - là **module namespace** (có `.default` là function) → gọi `default(data, sys)`
   - là **factory function** → gọi `(data, sys)`
   - đã là **View instance** (có `__ctrl__`) → dùng thẳng (giữ nguyên hành vi eager hiện tại)
3. Thêm `resolvedFactories: Map<name, factory>` — cache factory ĐÃ unwrap.
   (`import()` tự cache module, nhưng cache ở đây tránh lặp await + unwrap
   mỗi lần navigate; tách bạch với `store` hiện tại vốn cache View *instance*.)
4. Thêm `await` tại 2 call site (đều đã async sẵn).
5. Lỗi import (mạng lỗi/chunk 404) → đi vào error path hiện có, KHÔNG throw
   ra ngoài làm chết Router.

*Phần B — generator sinh được lazy (compiler):*
6. `registry-generator.js`: thêm chế độ lazy → emit
   `'web.about': () => import('./views/.../about.js')` thay vì static import.
   Bật/tắt qua `sao.config.json` (mặc định GIỮ eager để không đổi hành vi
   app đang chạy).
7. **Cảnh báo thiết kế phải chốt trước khi bật:** view entry của route đầu
   tiên KHÔNG nên lazy — hydrate sẽ phải chờ thêm 1 round-trip mạng mới
   claim được DOM server, gây mất tương tác tạm thời. Đề xuất: entry + layout
   luôn eager, chỉ lazy các route còn lại (cần cờ phân loại trong generator).

**Test cần có:** factory trả `Promise<module>` → mount đúng; trả
`Promise<factory>` → mount đúng; trả View trực tiếp → **không đổi hành vi**
(regression guard cho toàn bộ app hiện tại); import fail → app còn sống;
navigate lần 2 vào cùng view lazy → không import lại (đếm bằng spy).

**Rủi ro:** `view()` là hot path — đổi sang async chạm mọi luồng mount/hydrate.
Giảm rủi ro: 2 call site đều async sẵn, và test regression "View trực tiếp"
ở trên chốt đúng hành vi cũ. Bắt buộc chạy full suite sau khi sửa.

**Ước lượng:** Phần A trung bình (1 hàm core + 2 call site + 5 test);
Phần B nhỏ-trung bình (generator + config flag), nhưng cần chốt điểm 7 trước.

---

### GAP-02 — Two-way binding (`@bind`/`@val`) · ✅ đã hoạt động, đã refactor cho sạch (2026-08-03)

**⚠️ Đính chính:** kết luận ban đầu ("chưa wire runtime") **SAI** — do chỉ
grep đúng 1 chuỗi (`data-binding`, từ `binding_directive_service.py`, hoá ra
là code CHẾT/legacy — cùng lớp với `class_binding_handler.py` đã gặp ở
`@class` trước đó) mà không kiểm tra tiếp đường dẫn compile THẬT
(`template_ast.py` dòng ~982, xử lý `@bind`/`@val` trực tiếp) lẫn phía client
(`Html.ts::setupTwoWayBinding`, đã tồn tại đầy đủ — xử lý đúng cả checkbox,
radio, select (defer 1 microtask vì `<option>` chưa append lúc constructor
chạy), number (`valueAsNumber` + fallback string khi input dở dang), có guard
chống vòng lặp state↔input, cleanup đúng qua `abortController`/`bindingUnsubscribes`).
Bài học: đừng dừng lại ở kết quả grep đầu tiên khi có nhiều lớp code
cũ/mới song song trong compiler (đã gặp 2 lần: `@class` và `@bind`).

**Vấn đề thật (không phải "chưa có" mà là thiết kế chưa sạch):** compiler cũ
nhét `@bind`/`@val` vào `attrs` bằng 2 marker boolean
(`attrs:{bind:{type:'static',value:true}, "<key>":{type:'static',value:true}}`),
client phải "đoán" key thật bằng cách quét `attrs` tìm entry `{type:'static',
value:true}` khác `bind` — dễ vỡ: nếu element có thêm 1 static boolean attr
thật (vd `@required` → `attrs.required={type:'static',value:true}`) đứng
trước state-key marker trong object, `Object.keys(attrs).find(...)` có thể
chọn nhầm `'required'` làm bind key.

**Đã sửa — cho `bind` một bucket riêng, ngang hàng `events` (đúng yêu cầu):**
1. Compiler: `HtmlElement` có field `bind_key` riêng
   (`template_ast.py:982-991`, không còn đụng `static_attrs`);
   `render_generator.py::_gen_options` emit `bind: { key: '...' }` như 1
   field riêng trong config object, ngang hàng `attrs`/`props`/`events`/`classes`.
2. Client: `ElementInterface.ts` thêm `SaoElementConfig.bind?: { key: string }`.
   `Html.ts::initializeAttributes()` bỏ hẳn logic quét `attrs` tìm bind key —
   đọc thẳng `this.config.bind?.key`, gọi `setupTwoWayBinding()` sau khi attrs
   đã apply xong (cần `el.type` có sẵn). `updateConfig()` cũng clear `bind`
   đúng cách khi re-render (trước đây thiếu trong danh sách field được clear
   tường minh — sửa luôn).
3. Test cập nhật theo contract mới: `compiler/tests/test_bind_props.py`
   (assert `bind:{key:'userName'}` xuất hiện, không rò rỉ vào `attrs`),
   `client/tests/contract/bind.contract.test.ts`,
   `client/tests/contract/bind-inputs.contract.test.ts`,
   `client/tests/elements/html-config-reconcile.test.ts`.

**Còn lại (không chặn, note để sau):** `@bind(user.name)` (dot-path nested
state) chưa có test end-to-end riêng dù `getStateByKey`/`updateStateAddressKey`
đã hỗ trợ dot-path sẵn — khả năng hoạt động đúng nhưng chưa verify.

---

### GAP-03 — Không có Error Boundary · **P0** ← ưu tiên cao nhất hiện tại

**Đã verify (2 đường):**
1. Toàn bộ `client/src`: **0 kết quả** cho
   `onError|errorCaptured|onErrorCaptured|errorBoundary`.
2. Liệt kê đầy đủ hook đang có qua `callHook()` trong `ViewController.ts` —
   **19 hook**: `mounting, mounted, unmounting, unmounted, starting, started,
   onMounted, pausing, paused, onPause, resuming, resumed, onResume, stopping,
   stopped, onDeactivated, destroying, onDestroy, destroyed`. Không có bất kỳ
   hook nào cho lỗi.

**Hành vi hiện tại khi có lỗi:** chỉ có try/catch ở cấp cao nhất của
`renderPageView` → `showError(message)` → **`container.innerHTML` bị ghi đè
bằng 1 khối "Error" đỏ**, tức là **mất trắng cả trang** (xem thêm GAP-07 —
chính hàm này còn có vấn đề an toàn). Một `@include` con lỗi hay một
`Reactive` re-render throw sau khi user bấm nút đều không có cách nào cô lập.

**Tác động:** đây là lý do tôi đề xuất **đảo thứ tự, làm GAP-03 TRƯỚC GAP-01**
(khác bản kế hoạch trước): GAP-01 hiện không làm hỏng gì (generator sinh eager
import, chạy đúng), còn GAP-03 nghĩa là *bất kỳ* exception runtime nào cũng
xoá sạch trang của người dùng. React (`componentDidCatch`) và Vue
(`errorCaptured`) đều coi đây là API bắt buộc.

**Kế hoạch:**

*Bước 1 — API:*
1. Thêm `onError` vào `ViewControllerConfig` + danh sách hook hợp lệ:
   `onError(err: unknown, info: { phase: 'render'|'update'|'hook'|'async', path: string }) => SaoChildrenFactoryOutput | void`.
   - Trả về children → dùng làm **fallback content** cho vùng lỗi.
   - Trả `void` → coi như "đã ghi nhận, không tự xử lý" → tiếp tục bubble lên trên.
2. Helper `findErrorBoundary(ctrl)`: đi lên theo `ctrl.parent` tìm controller
   gần nhất có `onError`. Không có → trả `null` (bubble như hiện tại).

*Bước 2 — chốt các điểm wrap (theo thứ tự giá trị):*
3. `Component.ts` (@include con) — giá trị cao nhất: cô lập nguyên 1 subtree
   con, đúng granularity của React/Vue.
4. `Reactive.ts` re-render — lỗi xảy ra SAU khi trang đã sống (user bấm nút,
   state đổi); hiện tại loại lỗi này đặc biệt nguy hiểm vì nó không nằm trong
   try/catch của `renderPageView` nữa.
5. `renderPageView` Case 2/3 — lỗi fetch async hiện chỉ `logger.error`;
   route vào boundary để view tự hiển thị trạng thái lỗi thay vì im lặng.

*Bước 3 — bất biến an toàn (dễ sai, phải test):*
6. `onError` của chính boundary throw → **không được lặp vô hạn**: bắt lần 2,
   bỏ qua boundary đó, bubble tiếp lên boundary cha.
7. Không có boundary nào trong chain → **giữ nguyên hành vi hôm nay**
   (bubble → `showError`) — bắt buộc có regression test, không được đổi ngầm.
8. Fallback content phải render đúng vào giữa cặp marker của element lỗi
   (dùng chung insertion model với Reactive/BlockManager), không append cuối
   parent.

**Test cần có:** `@include` con throw → chỉ subtree đó thành fallback, sibling
+ phần còn lại của trang vẫn tương tác được; reactive re-render throw sau khi
đổi state → vùng đó fallback, các vùng reactive khác vẫn chạy; boundary lồng
nhau → boundary GẦN NHẤT thắng; `onError` tự throw → bubble lên cha, không
treo; không có boundary → y như cũ.

**Ước lượng:** trung bình-lớn — API + 3 điểm wrap + 5 test, nhưng phần lớn rủi
ro nằm ở bất biến 6/7 nên phải làm test trước khi mở rộng phạm vi wrap.

---

### GAP-07 — `showError()` dựng HTML bằng nội suy chuỗi vào `innerHTML` · **P1** (mới, phát hiện 2026-08-03)

**Đã verify:** `ViewManager.ts:297-306` —
`this.container.innerHTML = \`...<p>${message}</p>...${JSON.stringify(details)}...\``.
Cả `message` lẫn `details` đều được nội suy thẳng vào chuỗi HTML.

**Vấn đề:**
- **An toàn:** đây là pattern không an toàn theo nguyên tắc. Hiện các nguồn
  đổ vào `message` chủ yếu là view path / route component (từ config server,
  không phải input người dùng trực tiếp) nên **chưa xác định được đường khai
  thác thực tế** — nhưng `details` có thể mang nội dung phản hồi từ server,
  và chỉ cần một lần ai đó truyền chuỗi có nguồn từ URL/API vào là thành lỗ
  hổng thật. Không nên để pattern này tồn tại trong đường xử lý lỗi.
- **UX:** ghi đè `container.innerHTML` = xoá sạch trang (liên quan trực tiếp
  GAP-03).

**Kế hoạch:** dựng bằng `document.createElement` + gán `textContent` (tự
escape) thay cho nội suy `innerHTML`; sau khi có GAP-03, `showError` chỉ còn
là **phương án cuối** khi không boundary nào xử lý. Rẻ, nên làm **chung PR với
GAP-03** vì cùng đụng đường xử lý lỗi.

**Ước lượng:** nhỏ (1 hàm, ~15 dòng) + 1 test (message chứa `<script>` →
hiển thị dạng text, không tạo element).

---

### GAP-04 — Computed/watch không có memoization · **P2**

**Đã verify:** grep `computed|useMemo|memo(` trong `ViewState.ts` +
`ViewStateInterface.ts` → **0 kết quả**. Derive dữ liệu hiện làm bằng closure
re-run mỗi lần reactive trigger (đúng, nhưng không cache). So Vue `computed`
(cache tới khi dep đổi) / React `useMemo`.

**Tác động:** thấp với UI thường; tính toán nặng (sort/filter list lớn) sẽ
chạy lại lãng phí mỗi lần bất kỳ state liên quan đổi, kể cả khi kết quả cuối
không đổi.

**Kế hoạch (additive, không chặn P0/P1):**
- `states.__.computed(key, fn, deps: string[])` — lazy-eval + cache giá trị,
  invalidate khi 1 trong `deps` đổi (tái dùng chính `subscribe(deps)` đã có).
- Đọc qua `getStateByKey(key)` như state thường → `Output`/`Reactive` dùng
  `stateKeys: [key]` không cần biết đó là computed. Hoàn toàn additive, không
  đụng API cũ → rủi ro thấp.
- Cần compiler hỗ trợ cú pháp (`@computed(...)`) mới dùng được từ `.sao`;
  nếu chỉ thêm phía runtime thì mới dùng được trong `<script setup>`.

---

### GAP-06 — Không có testing utilities cho end-user · **P2**

**Đã verify (2 đường):** `tests/helpers/harness.ts` (`mountView`, `nextFrame`,
`visibleText`) nằm trong `tests/`, không nằm trong `src/`; `package.json`
`exports` chỉ có `.`, `./plugins`, `./core` — **không có `./testing`**. Người
dùng `@saolabs/client` không có cách nào test component `.sao` của họ (không
tương đương `@testing-library/react` / `@vue/test-utils`).

**Kế hoạch:** chuyển `harness.ts` → `src/testing/index.ts`, thêm
`"./testing"` vào `exports` + `files`, viết doc ngắn. Logic đã chạy tốt suốt
276 test nội bộ nên effort thấp — chủ yếu là quyết định API công khai
(`mountView` hiện nhận `renderFn` kiểu compiled output, cần bọc lại cho thân
thiện hơn với người dùng cuối).

**Nâng P3 → P2:** không có công cụ test thì người dùng framework không thể
viết test hồi quy cho app của họ — ảnh hưởng trực tiếp khả năng dùng thật, và
chi phí lại thấp vì code đã có sẵn.

---

### GAP-05 — Không có DevTools · **P3**

Không có browser extension/inspector xem state tree, marker boundary,
time-travel debug. Là dự án riêng (browser extension), không phải patch
trong client runtime — roadmap dài hạn.

---

## 4. Thứ tự xử lý — bản 2026-08-03 (ĐÃ ĐẢO so với bản trước)

```
✅ GAP-02  two-way binding     ── xong; hoá ra đã hoạt động, chỉ refactor cho sạch

✅ GAP-03  error boundary      ── xong (§2.4) + vá luôn lỗ hổng mount-phase có sẵn
✅ GAP-07  showError innerHTML ── xong (§2.4)
✅ GAP-01  Phần A: runtime     ── xong (§2.5)  — lazy ở cấp route đã chạy
✅ GAP-01  Phần B: generator   ── xong (§2.5b) — opt-in, mặc định vẫn eager

✅ GAP-06  testing utilities   ── xong (§2.6)  — `@saolabs/client/testing`
✅ GAP-08  export ./core hỏng  ── xong (§2.6b) — xoá + `check-exports` chặn khi publish
✅ GAP-04  computed/watch      ── xong (§2.7)  — runtime
✅ GAP-04b cú pháp `@computed` ── xong (§2.7b) — compiler, dùng được ngay trong .sao

✅ GAP-09  listener nuốt lỗi   ── xong (§2.8)  — phát hiện khi rà soát lại GAP-03
✅ GAP-05  DevTools            ── xong (§2.9)  — hook + overlay (đổi phạm vi từ extension)
```

**Toàn bộ GAP đã xử lý xong.** Còn lại chỉ là 7 việc hoãn có chủ ý ở §1b
và các hạng mục backlog dài hạn (extension đóng gói, time-travel).

**Vì sao đảo GAP-03 lên trước GAP-01** (khác bản kế hoạch trước): sau khi
verify, GAP-01 **không làm hỏng gì hôm nay** — generator chỉ sinh eager
import và runtime xử lý eager đúng; đó là vấn đề quy mô (bundle size), có thể
chờ. Còn GAP-03 nghĩa là *bất kỳ* exception runtime nào — kể cả sau khi trang
đã sống, do user bấm nút — cũng ghi đè `container.innerHTML` và xoá sạch trang.
Rủi ro production cao hơn hẳn.

**Ghi chú thực thi:** mỗi đợt xong phải chạy đủ `npx tsc --noEmit` +
`npx vitest run` (hiện 30 file / 276 test) + `npm run build`, và cập nhật
trạng thái ngay trong file này.

---

## 5. Bài học từ phiên rà soát này (để lần sau không lặp lại)

- **Không tin docs cũ khi chưa đối chiếu code.** Nhiều claim trong
  `docs/HYDRATION.md`/`SYSTEM_FAMILIARIZATION.md` đã lỗi thời (vd "nested
  layout chưa hỗ trợ" — thực ra đã hỗ trợ) lẫn ngược lại (vd đọc docs tưởng
  đã xong nhưng thực ra vẫn còn bug) — luôn verify bằng compile thật/test
  thật trước khi kết luận.
- **Fix vội có thể sai theo hướng khác.** Bug "hydrate fetch lại dữ liệu" sửa
  lần đầu (bỏ hẳn `prerender()`) tưởng đúng nhưng làm mất block tĩnh —
  chỉ phát hiện nhờ người dùng hỏi lại "làm sao nhận diện block khai báo
  trong prerender?". Bài học: khi 1 hàm có NHIỀU side-effect (prerender()
  vừa tạo skeleton vừa đăng ký block tĩnh), tắt cả hàm để né 1 side-effect
  không mong muốn sẽ vô tình mất luôn các side-effect còn lại cần thiết.
- **Đừng dừng ở kết quả grep đầu tiên.** Kết luận GAP-02 ("two-way binding
  chưa wire runtime") sai vì chỉ grep 1 chuỗi (`data-binding`) trúng đúng
  code CHẾT (`binding_directive_service.py`, legacy). Compiler này đã có
  tiền lệ 2 lớp code song song cho cùng 1 tính năng (cũ chết, mới sống) —
  gặp lần đầu ở `@class` (`class_binding_handler.py` chết,
  `template_ast.py::_parse_class_binding` sống), lần 2 ở `@bind`
  (`binding_directive_service.py` chết, `template_ast.py` dòng ~982 sống).
  Khi 1 grep cho ra "chưa implement", luôn kiểm tra thêm ít nhất 1 đường dẫn
  compile khác trước khi kết luận — nhất là compiler này, nơi việc thay thế
  module cũ bằng module mới không luôn đi kèm xoá module cũ.
  → Đã thành **quy tắc 2 đường** ở đầu file.
- **"Không hoạt động" ≠ "đang gây hỏng".** Rà soát lại GAP-01 cho thấy tuy
  đường lazy-load thật sự sẽ vỡ nếu dùng, generator lại chưa bao giờ sinh ra
  dạng đó → app hiện tại chạy đúng. Xếp nó P0 như ban đầu là sai mức độ, làm
  lệch cả thứ tự ưu tiên (đẩy GAP-03 — thứ đang thực sự xoá trắng trang khi
  có lỗi — xuống sau). Bài học: luôn hỏi thêm "hôm nay có ai đang chạm vào
  đường này không?", đừng chấm mức độ chỉ dựa trên việc code có đúng hay không.
- **Rà soát rộng bắt được thứ rà soát hẹp bỏ sót.** GAP-07 (`showError` nội
  suy chuỗi vào `innerHTML`) chỉ lộ ra khi đọc cả luồng xử lý lỗi để lên kế
  hoạch GAP-03 — không nằm trong bất kỳ danh sách gap nào trước đó.
- **Viết test cho hành vi CŨ trước khi thêm hành vi mới.** 3 test "không có
  boundary → giữ hành vi cũ" fail ngay lần chạy đầu, và đó là cách phát hiện
  `activateRenderedChain` (phase mount) chưa từng nằm trong try/catch nào —
  lỗi `@include` lúc mount thoát hẳn ra ngoài `mountView` thành unhandled
  rejection, KHÔNG rơi vào `showError` như tôi vẫn tưởng khi lập kế hoạch.
  Giả định về hành vi cũ mà không có test chứng minh thì cũng chỉ là giả định.
- **`any` che call site khi đổi chữ ký hàm.** Đổi `view()` sang async, `tsc`
  chỉ bắt 2/4 call site — 2 chỗ còn lại (`Component.resolveChildView`,
  `ViewController.extendView`) gọi qua biến kiểu `any` nên lọt lưới, và cả hai
  lại nằm trong render tree đồng bộ (không await được). Khi đổi chữ ký, grep
  thêm theo TÊN hàm chứ đừng chỉ tin `tsc`.
- **"2 hệ song song, 1 hệ chết" — lần thứ 3 trong compiler này.** Gặp ở
  `@class` (`class_binding_handler.py` chết), `@bind` (`binding_directive_service.py`
  chết), và giờ cả CƠ CHẾ `@let`/`@const` (`directives_line`/
  `parse_let_directives` chết, `DeclarationTracker` mới là hệ sống). Dấu hiệu
  nhận biết: build không lỗi, `stateKeys` sinh đúng, nhưng RUNTIME báo
  `ReferenceError`. Compile thử + đọc code TIÊU THỤ giá trị (không chỉ code
  SINH ra nó) mới lộ — comment "handled in wrapper scope" ngay đầu hàm
  `generate_render_function` là manh mối bị bỏ sót ở lần đọc đầu.
  → Với compiler này cụ thể: khi nối 1 directive mới, luôn tìm xem có
  `DeclarationTracker`/`_generate_wrapper_declarations` xử lý sẵn loại tương
  tự chưa, ĐỪNG mặc định `parsers.py`/`directives_line` là đường sống chỉ vì
  code đó tồn tại và có vẻ liên quan.
- **"Chết" phải nói rõ chết ở KHÂU NÀO.** Ngay sau đó tôi lại viết trong tài
  liệu rằng *"toàn bộ `directives_line` mechanism chết"* — rà soát lại thì
  `let_declarations`/`const_declarations` vẫn sống cho khâu PHÂN TÍCH
  (`_calculate_prerender_need`, `_detect_state_keys`...), chỉ nhánh SINH CODE
  mới chết. Nếu tin lời mình mà đi xoá `parse_let_directives` thì đã phá
  `hasPrerender` — đúng thứ vừa fix ở §2.3. Kết luận "dead code" phải kèm
  phạm vi, và phải grep hết chỗ TIÊU THỤ trước khi xoá.
- **Sửa xong một lớp bug thì rà lại CẢ LỚP, đừng dừng ở các điểm đã liệt kê.**
  GAP-03 ban đầu bọc `Component`/`Reactive`/fetch async — đúng nhưng thiếu:
  còn cả nhóm `Output`/`TextElement`/`Html` binding chạy trong callback
  subscribe, nơi `flushChanges` đã nuốt lỗi sẵn (GAP-09, §2.8). Chỉ lộ ra khi
  rà soát lại bằng câu hỏi "còn ĐƯỜNG NÀO khác chạy code người dùng khi state
  đổi?" thay vì rà theo danh sách file đã sửa.

### Bổ sung sau phiên rà soát #2 (2026-08-04)

- **"Verify bằng đọc code" KHÔNG đủ cho code có trạng thái qua nhiều pass.**
  §2.1 ghi "SSR / Hydration / Reactive core — ✅ Đã verify đúng", verify bằng
  đọc code + compile thật `.sao`. GAP-10 nằm đúng trong vùng đó, và là kịch
  bản phổ biến nhất của app CRUD (refresh một list). Không đường nào trong hai
  đường đó bắt được, vì lỗi chỉ xuất hiện ở **pass thứ hai** của reconciler
  với object ref mới — pass đầu hoàn toàn đúng.
  → **Quy tắc 2 đường giờ có thêm đường thứ ba:** với reconciler, cache,
  lifecycle — bất cứ thứ gì mang trạng thái qua nhiều lần chạy — "verify"
  phải là **test chạy được**, không phải đọc hiểu. Đọc code cho bạn thấy pass
  đầu; chỉ test cho bạn thấy pass thứ hai.
- **Docstring có thể sai ngược 180° so với code — và nó sai một cách tự tin.**
  `ForeachSlotCache.store()` ghi *"slot cũ không được touch → prunePass sẽ
  destroy"*. Đọc dòng đó xong thì không ai đi kiểm `prunePass` có thấy slot ấy
  không nữa — mà đáp án là KHÔNG, vì `store()` đã gỡ nó khỏi `_map` rồi.
  Comment mô tả Ý ĐỊNH; chỉ test mới mô tả HÀNH VI. Comment càng khẳng định
  chắc nịch thì càng đáng kiểm — nó là chỗ người đọc ngừng suy nghĩ.
- **Chạy suite ngay khi thêm cảnh báo — dương tính giả lộ ra ở đó.** GAP-12
  bản đầu đặt cảnh báo ở `commitStateChange` cho mọi đường vào; suite hiện ra
  đúng 1 dòng cảnh báo sai. Truy ra thì có BA đường gọi tới đó và chỉ một là
  lỗi của dev (`setValue`), hai đường kia (`update$x()` init,
  `__UPDATE_DATA_TRAIT__` props) re-pass cùng ref là hợp lệ. Một cảnh báo hay
  báo động giả sẽ bị người ta học cách phớt lờ — tệ hơn là không có cảnh báo.
- **Comment kiến trúc cũng lỗi thời như docs.** `ViewController.ts` đầu file
  ghi *"Event delegation — addEventListener with centralized cleanup"*, nhưng
  thực tế là `addEventListener` trực tiếp từng element, dùng chung
  AbortController. Không phải bug (React 17+ cũng bỏ document-level
  delegation), nhưng nó nói SAI về kiến trúc của chính mình.
- **"2 hệ song song, 1 hệ chết" — lần thứ 4.** Thêm `@event`:
  `event_directive_processor.process_event_directive()` sinh
  `this.__addEventConfig(...)` — mà `__addEventConfig` **không tồn tại trong
  runtime**, 0 kết quả grep. Đường sống là `template_ast.py` (~dòng 1015) sinh
  thẳng `events: { click: [...] }`. Suýt nữa đã thêm modifier vào đúng hệ chết.
  Dấu hiệu nhận biết nhanh nhất: **grep tên hàm mà compiler sinh ra, ở phía
  runtime**. Không có ai gọi → đó là hệ chết.

### Bổ sung sau phiên rà soát #3 (2026-08-04)

- **Test hardcode giá trị sẽ KHOÁ luôn cái bug.** `test_foreach_key.py` khẳng
  định `'${__loopIndex + 1}'` — đúng con số sai. Test đó "pass" suốt trong khi
  mọi `@foreach` không `@key` hydrate lệch. Ý định cần khoá là *"hậu tố là chỉ
  số vòng lặp, và CÙNG gốc đếm với phía SSR"*, không phải một chuỗi cụ thể.
  Guard mới so **gốc đếm** hai phía (0-based vs 1-based) nên vẫn đúng dù sau
  này đổi tên biến.
- **Guard tồn tại không có nghĩa là vùng đó đã được phủ.** Có sẵn
  `test_loop_output_marker_sync.py` cho đúng chủ đề "id marker trong loop", tên
  nghe như đã bao hết. Nhưng fixture của nó chỉ có nhánh CÓ `@key`. Khi tin vào
  một guard, phải đọc FIXTURE của nó, không đọc tên nó.
- **Khi một test phải viết chú thích giải thích vì sao nó KHÔNG kiểm thứ nó định
  kiểm, đó là báo cáo lỗi.** Test `isViewMounted()` đã ghi rõ "view chưa có
  trong activeViews... Ta test getCurrentView() thay thế" — người viết đã nhìn
  thẳng vào lỗi và đi vòng qua nó. Chú thích kiểu đó đáng được coi là TODO có
  mức ưu tiên, không phải lời giải thích.
- **Triệu chứng của lỗi hydration không phải lúc nào cũng nhìn thấy ngay.**
  Lệch-1 KHÔNG làm DOM nhân đôi tại thời điểm hydrate — element thừa được tạo
  nhưng chưa chèn nên trang trông hoàn toàn bình thường. Nó chỉ nổ ở lần update
  kế tiếp. Test đo "DOM có đúng không" pass cả khi có bug; phải đo **element mồ
  côi** (`registry có, chưa gắn DOM`) mới phân biệt được. Với hydration, hãy
  kiểm bất biến CẤU TRÚC chứ đừng chỉ kiểm ảnh chụp DOM.
