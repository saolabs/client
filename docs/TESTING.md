# Test component `.sao` — `@saolabs/client/testing`

> Tiện ích mount view trong môi trường DOM giả lập để viết test hồi quy cho
> component của bạn. Không phụ thuộc test runner nào — dùng được với Vitest,
> Jest, hay bất kỳ runner nào có DOM (jsdom / happy-dom).

## Cài đặt

Đã nằm sẵn trong `@saolabs/client`, chỉ cần một môi trường DOM:

```bash
npm i -D vitest jsdom
```

```ts
// vitest.config.ts
export default { test: { environment: 'jsdom' } };
```

## Dùng nhanh

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { mount, nextFrame, type Harness } from '@saolabs/client/testing';
import Counter from './views/counter.js'; // view .sao đã compile

let c: Harness | null = null;
afterEach(() => { c?.destroy(); c = null; }); // luôn destroy để không rò rỉ giữa các test

it('bấm nút thì tăng', async () => {
    c = mount(Counter, { start: 1 });

    c.container.querySelector('button')!.click();
    await nextFrame();          // state gom theo RAF — phải chờ trước khi assert

    expect(c.text()).toContain('2');
});
```

**Quan trọng:** mọi cập nhật state được gom (batch) theo `requestAnimationFrame`.
Sau khi đổi state (click, `setState`) phải `await nextFrame()` rồi mới assert DOM,
nếu không sẽ đọc trúng DOM cũ.

## API

### `mount(factory, data?) => Harness`
Mount một view **đã compile** (factory compiler sinh ra, cũng chính là thứ nằm
trong registry). `data` là props/vars truyền vào view.

### `mountView(renderFn, options?) => Harness`
Mount từ render function viết tay, **không cần compile** — dùng khi muốn test
riêng một element/lifecycle mà không dựng cả file `.sao`.

```ts
const h = mountView(function () {
    return this.wrapper((parent: any) => [
        this.html('el', 'p', parent, {}, () => [this.text('hi')]),
    ]);
}, { states: { count: 0 } });
```

`options`: `states` (khởi tạo state), `methods` (như `<script setup>`),
`path`, `styles`, `scripts`.

### `nextFrame() => Promise<void>`
Chờ qua một batch RAF flush (state → DOM).

### `Harness`
| Field | Ý nghĩa |
|---|---|
| `container` | element chứa view, đã gắn vào `document.body` |
| `text()` | `textContent` của container, đã trim (bỏ qua comment marker) |
| `setState(key, value)` | đổi state như user thao tác |
| `getState(key)` | đọc state hiện tại |
| `view` / `ctrl` | View instance + ViewController (khi cần đụng sâu) |
| `destroy()` | destroy view + gỡ container — **luôn gọi trong `afterEach`** |

## Test error boundary

`onError` là config của view, nên test được trực tiếp:

```ts
it('con lỗi thì chỉ vùng đó hiện fallback', () => {
    c = mount(PageWithBrokenChild);
    expect(c.text()).toContain('FALLBACK');
    expect(c.text()).toContain('phần còn lại vẫn hiển thị');
});
```

Xem thêm `client/tests/view/error-boundary.test.ts` trong repo để tham khảo
các tình huống: boundary lồng nhau, `onError` tự throw, lỗi fetch async.

## Ghi chú

- Test nội bộ của framework (`client/tests/`) dùng **chính** module này
  (`tests/helpers/harness.ts` chỉ re-export), nên API luôn được kiểm chứng
  bằng ~300 test mỗi lần chạy CI.
- Chưa có: tiện ích giả lập router/navigation và tiện ích fire event cấp cao
  (hiện dùng DOM API trực tiếp: `el.click()`, `el.dispatchEvent(...)`).
