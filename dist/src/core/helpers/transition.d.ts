/**
 * Transition enter/leave cho element — `@transition('fade')`.
 *
 * # Quy ước class (giống Vue, để người dùng không phải học lại)
 *   enter: `{n}-enter-from` `{n}-enter-active` → frame sau → `{n}-enter-to`
 *   leave: `{n}-leave-from` `{n}-leave-active` → frame sau → `{n}-leave-to`
 * `-active` có mặt suốt quá trình (chỗ đặt `transition:`), `-from`/`-to` là
 * hai đầu giá trị.
 *
 * # Vì sao dùng `getAnimations()` chứ không nghe `transitionend`
 * `transitionend` bắn MỘT lần cho MỖI property, không bắn nếu giá trị không
 * đổi, và không phân biệt transition của element với của con nó — nên cách
 * làm kinh điển phải parse `transition-duration` + hẹn giờ dự phòng.
 * `element.getAnimations()` trả thẳng mọi animation/transition đang chạy trên
 * element kèm promise `.finished`, xử lý đúng cả trường hợp nhiều property và
 * bị huỷ giữa chừng. Không có animation nào → resolve ngay → hành vi y hệt
 * lúc chưa có transition (đây cũng là đường chạy trong jsdom).
 *
 * # Vì sao cần `isLeaving()`
 * Element rời đi phải NẰM LẠI DOM tới khi animation xong, trong khi
 * `Reactive.clearContent()`/`_cleanOrphanNodes()` quét sạch mọi node giữa cặp
 * marker. Hai vòng quét đó phải bỏ qua node đang leave, nếu không node bị giật
 * đi ngay và animation không bao giờ thấy được.
 */
/** True khi node đang chạy leave và chưa được gỡ. */
export declare function isLeaving(node: Node): boolean;
/** Chạy enter. Bị enter/leave khác chen ngang → thoát, không đụng DOM nữa. */
export declare function runEnter(el: Element, name: string): Promise<void>;
/**
 * Chạy leave rồi GỠ node. Trả promise resolve sau khi node đã rời DOM.
 * Element được đánh dấu leaving ngay lập tức để không ai giật mất giữa chừng.
 */
export declare function runLeave(el: Element, name: string): Promise<void>;
//# sourceMappingURL=transition.d.ts.map