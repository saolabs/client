/**
 * LoopContext — provides loop metadata for @foreach, @for, @while directives.
 *
 * Available properties inside loops:
 *   $loop.index      — 0-based index
 *   $loop.iteration  — 1-based iteration count
 *   $loop.count      — total items (or -1 for @while)
 *   $loop.remaining  — items left
 *   $loop.first      — is first iteration
 *   $loop.last       — is last iteration
 *   $loop.odd        — is odd iteration (1-based)
 *   $loop.even       — is even iteration (1-based)
 *   $loop.depth      — nesting depth (starts at 1)
 *   $loop.parent     — parent LoopContext (for nested loops)
 */
export class LoopContext {
    constructor(parent = null) {
        this.index = 0;
        this.iteration = 0;
        this.count = 0;
        this.remaining = -1;
        this.first = false;
        this.last = false;
        this.odd = true;
        this.even = false;
        this.depth = 1;
        this.type = 'increment';
        this.parent = parent;
        if (parent) {
            this.depth = parent.depth + 1;
        }
    }
    setType(type) {
        if (type === 'increment' || type === 'decrement') {
            this.type = type;
        }
    }
    setCount(count) {
        this.count = count;
        if (count === -1) {
            // Unknown count (@while) — remaining/last unreliable
            this.remaining = -1;
            this.last = false;
        }
        else {
            this.remaining = count;
        }
    }
    setCurrentTimes(index) {
        this.index = index;
        this.iteration = index + 1;
        this.first = index === 0;
        this.last = this.count > 0 ? index === this.count - 1 : false;
        this.odd = this.iteration % 2 === 1;
        this.even = !this.odd;
        if (this.count > 0) {
            this.remaining = this.count - this.iteration;
        }
    }
    next() {
        if (this.type === 'increment') {
            this.increment();
        }
        else {
            this.decrement();
        }
    }
    /**
     * Bản chụp BẤT BIẾN của trạng thái hiện tại — dùng cho `loop` mà template
     * nhìn thấy trong `@foreach`.
     *
     * Vì sao cần: LoopContext là MỘT object dùng chung, bị mutate qua từng vòng
     * (`setCurrentTimes`). Trong khi đó element con được tạo bởi
     * `childrenFactory` — closure chạy MUỘN (lúc Html.renderChildren), SAU khi
     * vòng lặp đã kết thúc. Closure bắt `loop` theo THAM CHIẾU nên mọi hàng đọc
     * ra cùng một giá trị: trạng thái CUỐI cùng.
     * Đo được: list 6 phần tử, `@click(remove(loop.index))` ở mọi hàng đều nhận
     * index = 5 → bấm hàng nào cũng xoá phần tử cuối, rồi tắc hẳn.
     * `__loopIndex` không dính vì nó là tham số theo từng lần gọi callback (mỗi
     * closure một binding riêng), không phải object chia sẻ.
     *
     * `parent` cũng chụp đệ quy: loop lồng nhau có cùng vấn đề ở mức ngoài.
     * Trả về plain object đã freeze — chỉ đọc, không có `next()` (không ai gọi
     * `next()` trên `loop` của `@foreach`; `@for`/`@while` vẫn nhận context
     * MUTABLE vì codegen của chúng cần `setCurrentTimes`/`next`).
     */
    snapshot() {
        return Object.freeze({
            index: this.index,
            iteration: this.iteration,
            count: this.count,
            remaining: this.remaining,
            first: this.first,
            last: this.last,
            odd: this.odd,
            even: this.even,
            depth: this.depth,
            parent: this.parent ? this.parent.snapshot() : null,
            next() {
                console.warn('[LoopContext] `loop` trong @foreach là bản chụp chỉ đọc — next() không có tác dụng.');
            },
        });
    }
    reset() {
        this.iteration = 0;
        this.index = 0;
        this.remaining = -1;
        this.count = 0;
        this.first = false;
        this.last = false;
        this.odd = true;
        this.even = false;
    }
    increment() {
        this.iteration++;
        this.index = this.iteration - 1;
        if (this.remaining !== -1) {
            this.remaining--;
        }
        this.first = this.index === 0;
        this.last = this.count > 0 ? this.index === this.count - 1 : false;
        this.odd = this.iteration % 2 === 1;
        this.even = !this.odd;
    }
    decrement() {
        this.iteration--;
        this.index = this.iteration - 1;
        if (this.remaining !== -1) {
            this.remaining++;
        }
        this.last = this.count > 0 ? this.index === this.count - 1 : false;
        this.odd = this.iteration % 2 === 1;
        this.even = !this.odd;
    }
}
//# sourceMappingURL=LoopContext.js.map