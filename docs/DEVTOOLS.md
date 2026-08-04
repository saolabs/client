# DevTools

> Xem cây view, state hiện tại, dòng sự kiện và highlight vùng DOM của từng
> view — ngay trong trang, không cần cài extension.

## Dùng nhanh

```ts
App.devtools.open();            // bật + mở panel
App.devtools.enableShortcut();  // sau đó Ctrl+Shift+D để bật/tắt
```

Hoặc từ console trình duyệt (hook luôn có mặt ở `window`):

```js
__SAOLA_DEVTOOLS__.enable();
```

**Tắt hoàn toàn mặc định.** `emit()` thoát ngay ở dòng đầu khi chưa bật, nên
production không trả phí gì ngoài vài hàm không bao giờ chạy — không cần
loại bỏ khỏi bundle bằng cờ build.

## Panel hiển thị gì

| Vùng | Nội dung |
|---|---|
| **Cây view** | layout chain (ngoài → trong) rồi tới page; mỗi node có `path`, `viewType`, `lifecycleState`, số element đang giữ trong registry |
| **State** | bấm vào một view để mở/đóng — giá trị hiện tại của mọi state key (kể cả `@computed`, được tính lại lúc đọc) |
| **Sự kiện** | 25 sự kiện gần nhất: `view:mounted`, `view:destroyed`, `state:changed` (kèm key nào đổi), `error` (kèm phase + message) |
| **Highlight** | rê chuột lên một view → tô vùng DOM tương ứng |

Highlight hoạt động bằng cách lấy bounding box của mọi node giữa cặp marker
`<!--s:v:{viewId}-s/-e-->` — view trong Saola không có element bọc ngoài
(kiến trúc marker, no-VDOM) nên không thể tô theo một element duy nhất.

**Dò rò rỉ:** cột `Nel` (element count) và `lifecycleState` là chỗ nhìn nhanh
nhất — view `destroyed` mà vẫn còn trong cây, hoặc element count tăng đều qua
mỗi lần điều hướng, là dấu hiệu rò rỉ.

## API

```ts
App.devtools.enable() / disable() / isEnabled()
App.devtools.open() / close() / toggle() / isOpen()
App.devtools.enableShortcut()          // Ctrl+Shift+D

App.devtools.getViewTree(): DevtoolsViewNode[]
App.devtools.getLog(): DevtoolsEvent[]  // vòng đệm 200 sự kiện
App.devtools.clearLog()
App.devtools.subscribe(fn): () => void  // nhận sự kiện realtime
```

Dùng bằng code (không cần panel) — ví dụ assert không rò rỉ trong test:

```ts
App.devtools.enable();
await router.navigate('/a');
await router.navigate('/b');
const alive = App.devtools.getViewTree();
expect(alive.every(v => v.lifecycleState === 'active')).toBe(true);
```

## Kiến trúc — vì sao overlay, không phải browser extension

Hook (`src/core/devtools/hook.ts`) **tách hẳn** khỏi UI: runtime chỉ phát sự
kiện và cho đọc snapshot, không biết gì về cách hiển thị. Inspector overlay
(`inspector.ts`) chỉ là một *consumer* của hook.

Chọn overlay trước vì: extension cần scaffolding riêng (manifest, content
script, bridge, publish store) mà vẫn hiển thị **đúng dữ liệu này**; overlay
chạy ngay ở mọi môi trường kể cả máy khác và webview mobile, với chi phí nhỏ
hơn nhiều.

**Extension vẫn dựng được sau này** trên cùng nguồn dữ liệu: cắm
`window.__SAOLA_DEVTOOLS_HOOK__` **trước khi app boot** (content script inject
sớm), hook sẽ tự bật và đẩy sự kiện sang:

```js
window.__SAOLA_DEVTOOLS_HOOK__ = {
    onEvent(e) { /* chuyển sang devtools panel */ },
};
// sau khi app boot, hook gắn ngược lại 2 hàm để panel gọi:
//   __SAOLA_DEVTOOLS_HOOK__.getViewTree()
//   __SAOLA_DEVTOOLS_HOOK__.getLog()
```

## Ghi chú an toàn

Panel dựng **toàn bộ** bằng `createElement` + `textContent`. State và thông
báo lỗi có thể chứa dữ liệu do người dùng nhập, nội suy vào `innerHTML` ở đây
là đường tiêm HTML — đúng lỗi đã vá ở
[GAPS_AND_ROADMAP.md](GAPS_AND_ROADMAP.md) §2.4 (GAP-07). Có test riêng cho
việc này (`tests/devtools/devtools.test.ts`).

Snapshot state đi qua JSON round-trip để cắt tham chiếu DOM/hàm/vòng lặp —
devtools không giữ sống object của app, và không nổ khi state có cấu trúc
vòng (giá trị hiển thị `[không serialize được]`).

## Chưa có

- Time-travel (tua lại state) — cần ghi toàn bộ lịch sử state, chi phí bộ nhớ
  lớn; chưa làm.
- Sửa state trực tiếp từ panel (hiện chỉ đọc).
- Browser extension đóng gói sẵn — hook đã sẵn sàng, xem mục kiến trúc ở trên.
