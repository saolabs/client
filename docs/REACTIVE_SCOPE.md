# Reactive scope, DOM và dữ liệu bất đồng bộ

Cập nhật 01/10/2026. API thuộc `@saolabs/client`; compiler/builder/client mới dùng
output contract 2. Rebuild cả app và theme khi nâng cấp.

## Chọn đúng cơ chế

| Việc cần làm | Cơ chế |
|---|---|
| Hiển thị state | Nội suy, attribute/property binding trong template |
| Tính dữ liệu dẫn xuất | `@computed` hiện có: tính thuần, lazy, cache theo dependency |
| Lưu/xóa khi người dùng thao tác | Method/event handler |
| Đồng bộ timer, observer, socket hoặc request theo state | `this.watch(keys, callback)` |
| Đọc/đo DOM sau cập nhật | `this.afterDom(callback)` hoặc watch mặc định |
| Chia sẻ nghiệp vụ | Module/service nhận dữ liệu và scope tường minh |

Không cần thêm `useMemo` hoặc `useCallback`: computed và instance method đã đáp ứng
hai nhu cầu này. Watch không dùng để tính lại dữ liệu mà computed có thể biểu đạt.
Template tiếp tục mô tả giao diện; logic đặt trong script/module/service.

## Watch với dependency và cleanup tường minh

Đăng ký một lần trong `mounted()`; scope của view tự pause/resume/destroy.

```sao
@state(query: string = '', results: any[] = [], error: string = '')
<template>
    <input @bind(query)>
    <p>{{ error }}</p>
</template>
<script setup lang="ts">
export default {
    mounted() {
        this.watch(['query'], async ({ query }, run) => {
            try {
                const response = await fetch('/api/search?q=' + encodeURIComponent(query), {
                    signal: run.signal,
                });
                if (!response.ok) throw new Error('Không tải được kết quả');
                const data = await response.json();
                run.commit(() => { setResults(data); setError(''); });
            } catch (error) {
                run.commit(() => setError(String(error)));
            }
        });
    },
}
</script>
```

`run.commit()` trả `false` nếu run đã cũ, dependency đổi, scope pause/stop/destroy.
Nó kiểm tra version ngay lúc commit, kể cả khi DOM batch kế tiếp chưa chạy.
Luôn đặt ghi state sau `await` trong `commit`; request abort không tự ngăn mọi
promise/SDK tiếp tục trả kết quả. Callback nhận object giá trị của tất cả key đã
khai báo, gồm cả các key không đổi trong batch. Object bao ngoài chỉ đọc; các
object state bên trong không được deep-clone hoặc deep-freeze.

```ts
const stop = this.watch(['channel'], ({ channel }, run) => {
    const socket = openChannel(channel); // service của ứng dụng
    run.onCleanup(() => socket.close());
    // Hoặc return () => socket.close();
});
// Khi muốn kết thúc sớm:
stop();
```

Cleanup chạy theo thứ tự ngược trước run mới và khi run kết thúc. Cleanup trả về
từ promise đã cũ vẫn được dọn ngay khi promise hoàn tất. Hủy watch và destroy
scope là idempotent. Lỗi callback/cleanup được chuyển tới error boundary của view.
Side effect này chỉ chạy ở client active; SSR in dữ liệu ban đầu.

| Tùy chọn | Hành vi |
|---|---|
| `immediate: true` (mặc định) | Chạy một lần khi scope active, sau đó khi dependency đổi |
| `immediate: false` | Chờ dependency đổi |
| `flush: 'dom'` (mặc định) | Chạy sau binding và region của view; thay đổi cùng batch gom lại |
| `flush: 'state'` | Chạy trong dispatch state, trước region; phù hợp logic không đọc DOM |

Pause/stop hủy run và queue chờ. Resume chạy lại các watch cần cập nhật với giá
trị mới nhất; không đăng ký lại watch trong `resumed()`.
`this.$scope.defer(cleanup)` sở hữu tài nguyên tới destroy, **không** dọn khi pause;
chỉ dùng cho tài nguyên an toàn khi view nằm trong cache. Tài nguyên cần tạm ngừng
khi pause nên được tạo trong watch (có thể dùng `watch([], callback)`).

## Sau cập nhật DOM

```ts
setMessage('Đã lưu');
const cancel = this.afterDom(() => {
    // Đọc DOM đã nhận state/binding/region của view này.
    const bounds = panel.getBoundingClientRect(); // element handle của ứng dụng
    positionWidget(bounds);
});
```

Callback chạy một lần, trả hàm hủy và tự bị hủy khi pause/stop/destroy.
Callback đăng ký từ callback khác đợi lượt tiếp theo. `afterDom` bảo đảm DOM queue
của view đã flush; nó không bảo đảm browser đã paint hoặc tất cả component tải
bất đồng bộ trong toàn app đã hoàn tất. Tránh đọc layout xen giữa nhiều DOM write.

## HTTP cancellation

HttpService xác định request theo method và URL cuối cùng, gồm query. Hai page
khác nhau không tự hủy nhau. Cùng identity mặc định hủy request trước.

```ts
http.get('/items', { page: 1 }, { signal: run.signal });
http.get('/items', { page: 2 }, { signal: run.signal });

// Cùng URL nhưng cần cho phép nhiều request sống đồng thời:
http.get('/items', {}, { dedupe: 'parallel' });

// Cùng một luồng tìm kiếm: kết quả mới nhất thay request cũ dù query khác:
http.get('/search', { q: query }, { requestKey: 'search', signal: run.signal });
http.cancelKey('search');
```

`signal` của caller được kết hợp với controller nội bộ; không thay thế nó.
`cancel(url, method?)` nhận URL có query của request cần hủy; `cancelAll()` hủy cả
request đang đợi interceptor. Timeout bao phủ pipeline. Mỗi request chỉ gỡ ownership
của chính nó khi kết thúc, nên cleanup request cũ không làm mất request mới.
Trong watcher vẫn dùng `run.commit()` để bảo vệ bước ghi kết quả.

## List và form

Khai báo `@key(item.id)` cho danh sách refresh từ API. Cùng key giữ row node và
component con qua immutable update; config/data/handler/index nhận dữ liệu mới.
Compiler tự tạo row scope; người viết template không quản lý registry hay closure.
Key cần duy nhất và ổn định. Khi không khai báo key, runtime dùng item reference:
reorder cùng reference giữ identity, object mới không có bảo đảm giữ row.
Thứ tự không đổi không gây childList mutation trong fixture hồi quy; reorder dùng
`moveBefore` khi browser hỗ trợ, fallback giữ focus/caret của phần tử còn sống.

`@bind` không ghi `.value` nếu giá trị không đổi. Với input/textarea, composition
IME chưa hoàn tất không ghi ngược state và không bị state→DOM chen ngang;
compositionend commit nội dung hoàn chỉnh. Binding hai chiều tiếp nhận input đã
sửa trước hydration, giữ default của SSR; select multiple đồng bộ bằng array.

Trong `<textarea>`/`<title>`, SSR in nội suy trực tiếp, client cập nhật property,
không có comment marker trong nội dung. Textarea bound rỗng được compiler thêm
nội suy; textarea chỉ có `{{ value }}` không tự được thêm `@bind`. Nội dung đã viết
được giữ nguyên. Script/style không có output marker và không tự thực thi lại
script khi state đổi; CSS động nên dùng style binding/CSS variable.

## Kiểm tra mutation khi phát triển

Production không quét/clone tất cả object state khi primitive khác đổi.
Observation/setter vẫn đánh dấu key liên quan. Trong browser, chẩn đoán mutation
ngoài luồng mặc định tắt; bật riêng lúc debug qua
`this.__ctrl__.states.__.setMutationDiagnostics(true)`.
Đây là tùy chọn debug có chi phí snapshot, không phải API cần dùng trong view thường.
