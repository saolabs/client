import type { LoopContextInterface } from "../contracts/LoopContextInterface";
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
export declare class LoopContext implements LoopContextInterface {
    index: number;
    iteration: number;
    count: number;
    remaining: number;
    first: boolean;
    last: boolean;
    odd: boolean;
    even: boolean;
    depth: number;
    parent: LoopContext | null;
    private type;
    constructor(parent?: LoopContext | null);
    setType(type: 'increment' | 'decrement'): void;
    setCount(count: number): void;
    setCurrentTimes(index: number): void;
    next(): void;
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
    snapshot(): LoopContextInterface;
    reset(): void;
    private increment;
    private decrement;
}
//# sourceMappingURL=LoopContext.d.ts.map