# Baseline test — Phase 0 (2026-06-12)

> **Cập nhật sau Phase 1 + 2 (cùng ngày): 43/43 passed.** Toàn bộ 9 bug dưới đây đã sửa,
> kèm thêm: pause/resume + dirty tracking (`tests/view/lifecycle.test.ts`),
> PageCache LRU+TTL (`tests/services/pagecache.test.ts`),
> mountView standalone tích hợp cache (`tests/view/mountview.test.ts`),
> commitData/updateData không còn rỗng. Bảng dưới giữ làm hồ sơ baseline gốc.

Kết quả gốc: **11 passed / 9 failed (20 tests)**. Mỗi test đỏ = 1 bug đã biết, là định nghĩa "done" cho Phase 1.

## Cách chạy

```bash
# Máy dev (khuyến nghị): vitest thật
npm install && npm test

# Môi trường offline (không cài được vitest):
npx tsc -p tests/_runner/tsconfig.test.json
node tests/_runner/run-lite.cjs
# (cần jsdom resolve được — NODE_PATH trỏ tới node_modules có jsdom nếu thiếu)
```

## 9 test đỏ — bug tracker Phase 1

| # | Test | Bug | File cần sửa |
|---|---|---|---|
| 1 | Html attrs `type: 'static'` | Html chỉ xử lý `'value'`, compiler emit `'static'` → attr tĩnh bị bỏ qua | `Html.ts` (contract §1.1) |
| 2 | `this.text()` static text | Trả raw Text node (không saoType) → `mountElementList`/`Reactive.render` drop → **text tĩnh biến mất** | `ViewController.text()` hoặc `helpers/view.ts` |
| 3 | Output không double-escape | `escapeHTML()` + `createTextNode` → hiển thị `&lt;b&gt;` literal | `Output.ts`, `TextElement.ts` (contract §3) |
| 4 | Output raw `{!! !!}` | Raw HTML cũng đi qua text node → không render được HTML | `Output.ts` (contract §3) |
| 5 | Reactive toggle render content | Toggle @if ra nội dung nhưng text con biến mất (hệ quả bug #2 trong nhánh re-render) | `Reactive.render()` |
| 6 | Output trong reactive re-render sai vị trí | Marker-based children tự append cuối parent thay vì giữa markers → `"tail inner"` thay vì `"inner tail"` | `Reactive.render()` + insertion model (contract §2) |
| 7 | Children re-render không được start() | Output/Reactive tạo trong re-render mất subscription | `Reactive.render()` |
| 8 | @foreach update | List re-render ra `<li>` rỗng (hệ quả #2) + cần insertion đúng | `Reactive.render()`, `__foreach` |
| 9 | `ctrl.start()` no-op | `_rootTree` không bao giờ được gán → start/stop theo controller không hoạt động (ViewManager đang phải gọi wrapper.start() tay) | `ViewController.render()` |

## Ghi chú thêm (không phải test fail nhưng phát hiện khi compile)

- `SaoChildrenFactory`/`SaoChildrenFactoryOutput` type quá hẹp — không chấp nhận `SaoNodeInterface`/`OutputInterface` mà code thực tế vẫn truyền → sửa type khi chuẩn hoá contract.
- `src/core/services/SectionManager.ts` + `src/core/view/Section.ts` có lỗi type sẵn (import member không tồn tại trong `contracts/views`).
- `tests/_runner/` là shim chạy offline; **không phải** test runner chính thức. Khi vitest cài được, xoá được toàn bộ `_runner` mà không ảnh hưởng test.
