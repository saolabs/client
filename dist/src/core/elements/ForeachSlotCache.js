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
export class ForeachSlotCache {
    constructor() {
        /** Map key → danh sách slot theo occurrence (duplicate keys) */
        this._map = new Map();
        /** Occurrence counter của pass hiện tại */
        this._passOcc = new Map();
        /** Slots được claim-hit hoặc store trong pass hiện tại */
        this._touched = new Set();
        /** Slots bị store() ghi đè trong pass hiện tại — prunePass destroy rồi clear */
        this._evicted = [];
    }
    /** Tổng số slot đang cache (mọi occurrence). */
    get size() {
        let n = 0;
        for (const slots of this._map.values())
            n += slots.length;
        return n;
    }
    /** Bắt đầu một chu kỳ render — reset counters + touched set. */
    beginPass() {
        this._passOcc = new Map();
        this._touched = new Set();
        this._evicted = [];
    }
    /**
     * Claim slot cho (key, item) theo thứ tự list.
     * Trả slot khi reuse được (key khớp + ref không đổi); ngược lại slot=null
     * và caller phải store(key, occ, ...) sau khi tạo elements.
     */
    claim(key, item) {
        const occ = this._passOcc.get(key) ?? 0;
        this._passOcc.set(key, occ + 1);
        const slot = this._map.get(key)?.[occ] ?? null;
        if (slot && slot.item === item) {
            this._touched.add(slot);
            return { slot, occ };
        }
        return { slot: null, occ };
    }
    /**
     * Lưu slot mới tại (key, occ) — ghi đè slot cũ nếu ref đã đổi.
     * Slot bị ghi đè KHÔNG còn nằm trong `_map` nên prunePass duyệt `_map` sẽ
     * không thấy nó nữa → phải chuyển sang `_evicted` để vẫn được destroy.
     */
    store(key, occ, item, elements) {
        const slot = { item, elements };
        let slots = this._map.get(key);
        if (!slots) {
            slots = [];
            this._map.set(key, slots);
        }
        const evicted = slots[occ];
        if (evicted && !this._touched.has(evicted)) {
            this._evicted.push(evicted);
        }
        slots[occ] = slot;
        this._touched.add(slot);
        return slot;
    }
    /**
     * Kết thúc pass: mọi slot không được touch = item đã rời list (hoặc bị
     * thay bằng ref mới) → gọi onRemove(slot) để destroy elements, gỡ khỏi cache.
     */
    prunePass(onRemove) {
        // Slot bị ghi đè: đã rời `_map` lúc store() nên chỉ cần destroy.
        for (const slot of this._evicted)
            onRemove(slot);
        this._evicted = [];
        for (const [key, slots] of this._map) {
            let hasRemoval = false;
            for (const slot of slots) {
                if (slot && !this._touched.has(slot)) {
                    onRemove(slot);
                    hasRemoval = true;
                }
            }
            if (hasRemoval) {
                const kept = slots.filter(s => s && this._touched.has(s));
                if (kept.length) {
                    this._map.set(key, kept);
                }
                else {
                    this._map.delete(key);
                }
            }
        }
    }
    /**
     * Xoá toàn bộ cache — dùng khi Reactive bị destroy.
     * KHÔNG tự gọi destroy() trên elements — caller phải làm trước.
     */
    clear() {
        this._map.clear();
        this._passOcc = new Map();
        this._touched = new Set();
        this._evicted = [];
    }
}
//# sourceMappingURL=ForeachSlotCache.js.map