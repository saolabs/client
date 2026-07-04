/**
 * ForeachSlotCache — keyed slot manager cho @foreach reconciliation.
 *
 * # Cơ chế
 * Mỗi item trong list được identify bằng **object reference** (identity keying).
 * Khi list thay đổi, cache cho phép tái sử dụng Saola elements của item đã tồn tại,
 * chỉ destroy/create elements cho items mới/xoá.
 *
 * # Tại sao identity keying?
 * Compiler output hiện tại đóng gói `item` trực tiếp vào closure:
 *   `this.output('id', p, true, [], () => item.name)`
 * Khi object reference không đổi → closure vẫn trỏ đúng data → reuse an toàn.
 * Khi object reference thay đổi → closure cũ trỏ object cũ → phải recreate.
 *
 * # Giới hạn
 * - Mutation-in-place (cùng ref, đổi thuộc tính) sẽ KHÔNG trigger recreate.
 *   Đây là hành vi đúng nếu dùng immutable data (mỗi update tạo object mới).
 * - Keyed reconciliation theo field (e.g. `@key="id"`) cần compiler hỗ trợ
 *   __foreachKeyed() — sẽ implement ở Phase 5b.
 *
 * # Quan hệ với Reactive
 * Reactive với type === 'foreach' giữ một ForeachSlotCache instance.
 * Khi re-render, Reactive gọi renderForeach() thay cho clearContent() + factory.
 *
 * @see Reactive.renderForeach()
 * @see ViewController.__foreach()
 */
/** Một slot tương ứng với một item trong foreach list. */
export interface ForeachSlot {
    /** Reference tới item gốc (dùng làm cache key) */
    item: any;
    /** Saola elements sinh ra bởi item factory — Html, Output, Reactive, ... */
    elements: any[];
}
export declare class ForeachSlotCache {
    /** Map từ item reference → slot */
    private _map;
    /**
     * Số slot hiện có (= số item đã cache).
     * Dùng để phát hiện trường hợp list rỗng nhanh.
     */
    get size(): number;
    /**
     * Lấy slot đã cache cho một item ref.
     * Trả về null nếu item chưa được cache (item mới).
     */
    get(item: any): ForeachSlot | null;
    /**
     * Lưu slot mới cho một item ref.
     * Gọi bởi __foreach() sau khi tạo elements cho item chưa có trong cache.
     */
    set(item: any, elements: any[]): ForeachSlot;
    /**
     * Xoá slot khỏi cache (sau khi item bị removed khỏi list).
     * Caller chịu trách nhiệm gọi destroy() trên các elements trước khi remove.
     */
    remove(item: any): boolean;
    /**
     * Snapshot toàn bộ entries hiện tại — dùng để so sánh old vs new.
     * Trả về Map copy (không phải reference trực tiếp).
     */
    snapshot(): Map<any, ForeachSlot>;
    /**
     * Xoá toàn bộ cache — dùng khi Reactive bị destroy.
     * KHÔNG tự gọi destroy() trên elements — caller phải làm trước.
     */
    clear(): void;
    /**
     * Trả về true nếu item đã có trong cache.
     */
    has(item: any): boolean;
}
//# sourceMappingURL=ForeachSlotCache.d.ts.map