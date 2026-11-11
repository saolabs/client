/**
 * Dọn một nhánh DOM mà GỐC đã bị gỡ khỏi tài liệu.
 *
 * Khi `Html.destroy()` gỡ element của nó, mọi node bên dưới đi theo. Con cháu
 * vì vậy không cần tự gọi `remove()` cho từng node — việc đó từng là phần lớn
 * chi phí khi xoá một danh sách dài (mỗi dòng hàng chục lượt gỡ node lẻ).
 *
 * So bằng `contains()` chứ không dùng cờ toàn cục: hook `destroyed()` của người
 * dùng chạy NGAY trong lúc dọn và có thể huỷ thứ nằm ngoài nhánh này; thứ đó
 * vẫn phải được gỡ khỏi DOM như thường.
 */
let discardedRoot = null;
/** Chạy `run` trong lúc `root` (đã rời DOM) đang bị dọn. */
export function discarding(root, run) {
    const previous = discardedRoot;
    discardedRoot = root;
    try {
        run();
    }
    finally {
        discardedRoot = previous;
    }
}
/** `node` nằm trong nhánh đang bị vứt bỏ — khỏi cần gỡ riêng. */
export function isDiscarded(node) {
    return discardedRoot !== null && node != null && discardedRoot.contains(node);
}
//# sourceMappingURL=teardown.js.map