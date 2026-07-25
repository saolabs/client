# Saola Client Lifecycle Plan

Tài liệu này khóa contract vận hành tối thiểu cho Page, Layout và Component trong
CSR, SPA navigation và hydration. Mục tiêu là sửa các điểm không nhất quán đang có,
không tạo thêm abstraction hoặc hook nếu runtime chưa cần.

## 1. Phạm vi và nguyên tắc

- Laravel/Blade vẫn là nguồn HTML đầu tiên khi SSR; client phải claim DOM, không render
  lại toàn trang.
- Page là đơn vị route và cache. Layout sở hữu các block outlet dùng chung. Component
  là child view có owner rõ ràng và phải đi theo lifecycle của owner.
- `mount/unmount` mô tả sự hiện diện trong DOM; `start/stop` mô tả subscription;
  `pause/resume` mô tả PageCache; `destroy` là kết thúc vĩnh viễn.
- Lifecycle hook của user là đồng bộ và không chặn navigation. Promise trả về từ hook
  không được await, nhưng rejection luôn được runtime bắt và log.
- Không thêm `computed`, hook hay lớp điều phối mới chỉ để làm đẹp API.

## 2. State machine công khai

```text
created --start--> active --pause--> paused --resume--> active
   |                 |                  |
   +-----------------+------------------+----destroy--> destroyed
```

`mount` xảy ra trước `start` ở lần render đầu. `stop` có thể xảy ra trước `destroy`,
nhưng không tạo thêm public state. Mọi transition phải idempotent: gọi lặp lại không
được nhân đôi hook, listener hoặc subscription.

## 3. Thứ tự hook đã hỗ trợ

### CSR lần đầu

1. `mounting`
2. Gắn/nhận DOM và acquire asset
3. `mounted`
4. `starting`
5. Start element tree và child component
6. `started`, sau đó `onMounted` (legacy)

### Hydration

1. Tạo view với `viewId` từ server
2. Commit state trước render để điều kiện/loop khớp Blade
3. Claim marker và element hiện có
4. Chạy cùng chuỗi `mounting → mounted → starting → started`

Hydration không được append bản sao của node server. Vùng không có SSR marker mới
được fallback sang CSR cục bộ.

### PageCache

- Pause: `pausing` ở owner → flush pending update → pause child theo thứ tự trong-ra
  ngoài → pause state/release asset → `paused`, `onPause`.
- Resume: `resuming` ở owner → resume state/acquire asset → resume child theo thứ tự
  ngoài-vào trong → `resumed`, `onResume`.
- Owner chỉ resume các child mà chính nó đã pause.

### Destroy

1. `destroying`
2. Nếu đang start: `stopping → stop tree → stopped → onDeactivated`
3. Abort event; nếu đã mount thì gọi `unmounting`
4. Hủy tree và child theo ownership; sau đó gọi `unmounted` nếu đã mount
5. Hủy state, block/outlet, registry và liên kết parent/child
6. `onDestroy → destroyed`

## 4. Ownership giữa Page, Layout và Component

- Page không layout: controller sở hữu root tree trực tiếp.
- Page có layout: Page sở hữu block content; Layout sở hữu DOM shell/outlet. Không giả
  định Page luôn có `_rootTree`.
- `@include` tạo Component element; child `ViewController` đăng ký đúng một lần vào
  `parent.children` và tự tháo khỏi parent khi destroy.
- Pause/resume/destroy của owner phải lan truyền tới child. Child đã destroy không được
  giữ lại trong registry của owner.
- Layout dùng chung không được destroy chỉ vì Page con đổi route; phần block thuộc Page
  cũ phải được unmount riêng qua BlockManager.

## 5. Kế hoạch triển khai

### Phase 1 — ổn định lifecycle hiện tại

- [x] Idempotent `start/stop/mount/unmount/destroy`.
- [x] Sửa destroy để không bỏ qua stop hooks.
- [x] Lan truyền pause/resume tới child controller.
- [x] Dọn liên kết parent/child khi child destroy.
- [x] Theo dõi chính xác DOM event callback để cleanup từng element.
- [x] Bắt rejection từ async hook mà không block navigation.
- [x] Test state transition và component ownership.

### Phase 2 — hợp nhất orchestration CSR/hydration

- [x] Dùng chung helper nội bộ cho commit, flush, activate và claim Wrapper hydration.
- [x] Component hydration và route hydration dùng cùng thao tác claim DOM.
- [x] Chặn async prerender cũ ghi đè DOM sau khi navigation mới bắt đầu.
- [x] Cancel fetch `await` của navigation cũ trước khi render/mount DOM.
- [x] CSR và hydration dùng chung một bước commit active Page/Layout chain.
- [x] Render lỗi/cancel dọn controller chưa mount và không biến cancel thành error UI.
- [x] Skeleton prerender tham gia đầy đủ start/pause/destroy lifecycle.
- [x] Tách một pipeline nội bộ dùng chung: create controller → prepare data →
  render/claim → mount → start.
- [x] ViewManager dùng một post-render transaction với hai DOM strategy nhỏ:
  `create` và `hydrate`.
- [x] Đưa Component mount/hydrate vào cùng transaction mà vẫn giữ marker insertion
  riêng của `@include`.
- [x] Test cùng compiled view fixture cho Blade HTML, CSR DOM và hydrated DOM có
  cấu trúc semantic tương đương.

### Phase 3 — navigation + Layout contract

- [x] Router chỉ commit history, `currentRoute` và `afterEach` sau khi
  ViewManager xác nhận Page/Layout chain đích đã active.
- [x] Navigation mới hủy fetch/render cũ; chỉ request mới nhất được
  commit DOM/history.
- [x] Standalone page cũ giữ active trong lúc prepare; render lỗi không làm
  mất DOM. Page trong Layout detach sớm do BlockManager ownership dùng chung,
  nhưng transaction rollback đúng page + block content nếu prepare thất bại.
- [x] Reuse Layout theo cùng instance/path; Layout khác được pause/cache
  hoặc destroy theo config hiện có.
- [x] Hỗ trợ chain `root Layout → nested Layout → Page`: mount/hydrate
  ngoài-vào-trong, lifecycle đủ từng controller, reuse common prefix và
  PageCache lưu/khôi phục toàn chain.
- [x] BlockManager mount block theo owner `viewId` và track children theo outlet
  identity; nested Layout có thể trùng tên outlet mà không mount nhầm tầng.
- [x] Nested hydration map Layout `viewId` từ Blade `view-data` metadata
  (`data-view-name` + `data-view-id`), giữ marker scan làm fallback một tầng.
- [x] Chuẩn hóa click nội bộ: không chặn modified click/download/external,
  giữ query + fragment, push/replace scroll top và pop dùng PageCache scroll.
- [x] Test guard, cancelled navigation, fetch URL trước history commit, render
  failure rollback, PageCache, pop và đổi/reuse Layout. Không thêm hook
  công khai hay redirect abstraction khi chưa có case runtime yêu cầu.

## 6. Tiêu chí hoàn tất

- Không duplicate DOM sau hydration.
- Không child controller, listener, subscription, block hoặc asset ref-count bị giữ
  lại sau destroy.
- Mỗi transition fire đúng một lần, đúng thứ tự.
- CSR và hydration đi tới cùng trạng thái `active` và dùng cùng public hooks.
- Laravel/Blade có thể render độc lập khi JavaScript chưa chạy hoặc hydration lỗi cục bộ.
