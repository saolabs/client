/**
 * ForeachSlotCache — keyed slot manager cho @foreach reconciliation.
 *
 * # Cơ chế
 * Mỗi item được identify bằng một cache key:
 *   - Có @key(expr)   → key = giá trị expr (field keying, vd `item.id`)
 *   - Không có @key   → key = object reference của item (identity keying)
 * Duplicate keys (primitive lists `['a','b','a']`, refs lặp) được phân biệt
 * bằng occurrence index trong pass — key thứ n trùng nhau map vào slot thứ n.
 *
 * # Reuse contract
 * Slot chỉ được REUSE khi cache key khớp VÀ item ref không đổi
 * (`slot.item === item`). Ref đổi → recreate, vì compiled output đóng gói
 * `item` trực tiếp vào closure (`() => item.name`) — reuse với ref cũ sẽ
 * hiển thị data cũ. Field key vì vậy chủ yếu mang lại: bookkeeping đúng cho
 * duplicate/primitive items + ý định tường minh của developer.
 *
 * # Pass protocol (một chu kỳ render)
 *   1. `beginPass()`  — reset occurrence counters + tập slot touched
 *   2. `claim(key, item)` mỗi item theo thứ tự list:
 *        hit  (slot.item === item) → dùng lại, slot được mark touched
 *        miss → caller tạo elements rồi `store(key, occ, item, elements)`
 *   3. `prunePass(onRemove)` — slot KHÔNG được touch trong pass = item đã rời
 *      list → callback destroy + gỡ khỏi cache. (Trước đây bước này là dead
 *      code — cache không bao giờ gỡ entry → element của item bị xoá leak.)
 *      Slot bị `store()` GHI ĐÈ (cùng key, ref mới) cũng đi qua đây: nó rơi khỏi
 *      `_map` ngay lúc ghi đè nên prunePass không còn thấy → phải giữ tạm trong
 *      `_evicted`. Thiếu bước này thì refresh list từ server (`@key` giữ nguyên,
 *      ref đổi) KHÔNG destroy elements cũ → view con của @include bị tái dùng
 *      trong DOM đã detach và biến mất khỏi trang.
 *
 * # Quan hệ với Reactive
 * Reactive type 'foreach' giữ một instance; cửa sổ `_currentForeachCache`
 * chỉ mở quanh CHÍNH childrenFactory call (không mở trong child.render() —
 * tránh nested @foreach ghi nhầm vào cache của loop ngoài).
 *
 * @see Reactive.renderForeach()
 * @see ViewController.__foreach()
 */
/** Một slot tương ứng với một item trong foreach list. */
export interface ForeachSlot {
    /** Reference tới item gốc — điều kiện reuse là ref không đổi */
    item: any;
    /** Saola elements sinh ra bởi item factory — Html, Output, Reactive, ... */
    elements: any[];
}
/** Kết quả claim: slot khi reuse được, occ để store khi phải tạo mới. */
export interface ForeachClaim {
    slot: ForeachSlot | null;
    occ: number;
}
export declare class ForeachSlotCache {
    /** Map key → danh sách slot theo occurrence (duplicate keys) */
    private _map;
    /** Occurrence counter của pass hiện tại */
    private _passOcc;
    /** Slots được claim-hit hoặc store trong pass hiện tại */
    private _touched;
    /** Slots bị store() ghi đè trong pass hiện tại — prunePass destroy rồi clear */
    private _evicted;
    /** Tổng số slot đang cache (mọi occurrence). */
    get size(): number;
    /** Bắt đầu một chu kỳ render — reset counters + touched set. */
    beginPass(): void;
    /**
     * Claim slot cho (key, item) theo thứ tự list.
     * Trả slot khi reuse được (key khớp + ref không đổi); ngược lại slot=null
     * và caller phải store(key, occ, ...) sau khi tạo elements.
     */
    claim(key: any, item: any): ForeachClaim;
    /**
     * Lưu slot mới tại (key, occ) — ghi đè slot cũ nếu ref đã đổi.
     * Slot bị ghi đè KHÔNG còn nằm trong `_map` nên prunePass duyệt `_map` sẽ
     * không thấy nó nữa → phải chuyển sang `_evicted` để vẫn được destroy.
     */
    store(key: any, occ: number, item: any, elements: any[]): ForeachSlot;
    /**
     * Kết thúc pass: mọi slot không được touch = item đã rời list (hoặc bị
     * thay bằng ref mới) → gọi onRemove(slot) để destroy elements, gỡ khỏi cache.
     */
    prunePass(onRemove: (slot: ForeachSlot) => void): void;
    /**
     * Xoá toàn bộ cache — dùng khi Reactive bị destroy.
     * KHÔNG tự gọi destroy() trên elements — caller phải làm trước.
     */
    clear(): void;
}
//# sourceMappingURL=ForeachSlotCache.d.ts.map