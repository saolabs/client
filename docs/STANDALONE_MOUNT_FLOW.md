# Phân tích Luồng mountView khi Không có superView & Hoàn thiện các Element

Tài liệu này chi tiết luồng hoạt động của phương thức `ViewManager.mountView()` cho **Standalone View** (trang không dùng layout), các lỗi/lỗ hổng hiện tại, và phương án hoàn thiện nốt việc xử lý các element còn lại (`Reactive`, `Block`, `BlockOutlet`, `Output`, `Fragment`, `Component`, `Yield`) trong hàm helper `mountElementList` và `mountElementListBefore`.

---

## 1. Luồng Hoạt động Thực tế Hiện tại (Trace Flow)

Khi điều hướng đến trang standalone (ví dụ: `/login`):

```
Router.handleRoute('/login')
  │
  ▼
1. ViewManager.mountView('web.login', data, route)
  │
  ├── [Phase 1: Load View]
  │   └── Gọi this.view('web.login', data, true) -> trả về instance LoginView
  │
  ├── [Phase 2: Render Chain Resolution]
  │   └── Gọi this.renderPageView(loginView, data)
  │       └── ctrl.render() -> trả về Wrapper (saoType = 'Wrapper') trực tiếp
  │       └── Dừng đệ quy ngay (do hasSuperView = false)
  │
  └── [Phase 3: DOM Mounting cho Standalone]
      └── Đi vào nhánh if (!hasSuperView):
          ├── Reset currentLayoutView & currentLayoutPath = null
          ├── pageView.__ctrl__.setParentElement(rootElement)
          └── pageView.__ctrl__.mainElement.mountTo(rootElement)
              ├── Clear innerHTML của rootElement (xóa DOM cũ)
              └── Wrapper.appendTo() -> Gọi render() -> mountElementList()
```

---

## 2. Phân tích các Element chưa hoàn thiện

Khi `Wrapper.render()` sinh ra danh sách phần tử con và chuyển vào [mountElementList](file:///Users/doanln/Desktop/2026/Projects/saolabs/client/src/core/helpers/view.ts#L11), hàm này đang bỏ trống (không xử lý/mount) các loại element sau:

| Class | `saoType` | Vai trò trong hệ thống | Trạng thái hiện tại |
|---|---|---|---|
| **`Reactive`** | `'Reactive'` | Chứa cấu trúc điều khiển (`@if`, `@foreach`) | Không render, không mount markers |
| **`Block`** | `'Block'` | Nội dung để đẩy vào layout | Không render |
| **`BlockOutlet`** | `'BlockOutlet'` | Vùng nhận nội dung block của layout | Không render, không mount markers |
| **`Output`** | `'Output'` | Interpolation hiển thị dữ liệu `{{ $expr }}` | Không render, không mount markers |
| **`Fragment`** | `'Fragment'` | Nhóm các sibling nodes không tag bao | Không render, không mount markers/con |
| **`Component`** | `'Component'` | Nhúng component/view con | Không render |
| **`Yield`** | `'Yield'` | Vùng template yield | Không render |

### Lỗi bổ sung: Thiếu `appendChild` cho String/Number thô
Trong `mountElementList`:
```typescript
if (typeof element === 'string' || typeof element === 'number') {
    const el = document.createTextNode(element.toString());
    mountedNodes.push(el);
    // Không có lệnh append vào rootElement!
}
```
Điều này khiến chuỗi hoặc số thô được đưa vào element list nhưng không hiển thị trên DOM.

---

## 3. Đề xuất Phương án Triển khai (Kế hoạch Chi tiết)

Chúng ta sẽ hoàn thiện hàm `mountElementList` và `mountElementListBefore` trong [view.ts](file:///Users/doanln/Desktop/2026/Projects/saolabs/client/src/core/helpers/view.ts):

### Bước 1: Sửa lỗi thiếu append cho String/Number
Bổ sung `rootElement.appendChild(el)` khi gặp kiểu string/number:
```typescript
if (typeof element === 'string' || typeof element === 'number') {
    const el = document.createTextNode(element.toString());
    rootElement.appendChild(el); // <-- Sửa lỗi
    mountedNodes.push(el);
}
```

### Bước 2: Hoàn thiện các cases còn thiếu trong switch statement
Với tất cả các SaoElement còn lại, chúng ta cần:
1. Thiết lập `parent` hoặc `parentElement` chỉ tới `root`.
2. Gọi hàm `.render()` của chính element đó để nó thực hiện việc tự chèn markers/nội dung vào DOM.
3. Đẩy các markers (`openTag`, `closeTag`) và các DOM nodes thực (trong trường hợp `Fragment`) vào mảng `mountedNodes`.

```typescript
case 'Reactive':
case 'Output':
case 'Fragment':
case 'BlockOutlet':
case 'Block':
case 'Component':
case 'Yield':
    const saoNode = saoEl as any;
    // Thiết lập parent thích hợp qua setter hoặc property
    if (typeof saoNode.setParentElement === 'function') {
        saoNode.setParentElement(root);
    } else {
        if ('parent' in saoNode) saoNode.parent = root;
        if ('parentElement' in saoNode) saoNode.parentElement = root;
    }
    
    // Gọi phương thức tự render của phần tử
    saoNode.render();
    
    // Thu thập các node/markers đã render
    if (saoNode.openTag) mountedNodes.push(saoNode.openTag);
    if (saoEl.saoType === 'Fragment' && Array.isArray(saoNode.nodes)) {
        saoNode.nodes.forEach((node: Node) => {
            mountedNodes.push(node);
        });
    }
    if (saoNode.closeTag) mountedNodes.push(saoNode.closeTag);
    break;
```

---

## 4. Kế hoạch Kiểm thử & Xác minh

### 1. Kiểm thử Unit Test độc lập
- Tạo mock `root` (Html element giả lập).
- Tạo danh sách gồm nhiều kiểu element khác nhau: `Reactive` (chứa html con), `Output`, `Fragment`, string thô.
- Chạy `mountElementList` và kiểm tra cấu trúc DOM bên trong `root.element`:
  - Đảm bảo string thô được thêm vào DOM.
  - Đảm bảo các marker comment như `<!--reactive-start-->`, `<!--fragment-start-->` xuất hiện đúng vị trí và có chứa các element con tương ứng bên trong.

### 2. Kiểm thử Tích hợp (Integration Test)
- Render thử một trang Standalone có chứa biểu thức `@if` hoặc `@foreach` ở cấp cao nhất (root wrapper).
- Xác minh xem chúng có được vẽ đầy đủ lên trình duyệt thay vì bị biến mất như trước.
