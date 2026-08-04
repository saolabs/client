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

/** Node đang chạy leave — vòng quét DOM giữa marker phải BỎ QUA. */
const leavingNodes = new WeakSet<Node>();

/** Sequence hiện tại của mỗi element — chống enter/leave chồng nhau (reorder). */
const generation = new WeakMap<Element, number>();

/** True khi node đang chạy leave và chưa được gỡ. */
export function isLeaving(node: Node): boolean {
    return leavingNodes.has(node);
}

function bump(el: Element): number {
    const next = (generation.get(el) ?? 0) + 1;
    generation.set(el, next);
    return next;
}

const isCurrent = (el: Element, token: number) => generation.get(el) === token;

/** Đợi sang frame kế — để trình duyệt kịp áp `-from` trước khi đổi sang `-to`. */
function nextFrame(): Promise<void> {
    return new Promise(resolve => {
        if (typeof requestAnimationFrame !== 'function') return resolve();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
}

/**
 * Đợi mọi animation/transition trên element kết thúc.
 * `allSettled` vì `.finished` REJECT khi animation bị huỷ — với ta thì huỷ
 * cũng là xong, không phải lỗi.
 *
 * ponytail: animation vô hạn (`animation-iteration-count: infinite`) trên
 * element đang leave sẽ giữ node lại mãi. Thêm timeout trần nếu gặp thật.
 */
async function whenAnimationsDone(el: Element): Promise<void> {
    const getAnimations = (el as any).getAnimations;
    if (typeof getAnimations !== 'function') return;   // jsdom / browser cũ
    const running = getAnimations.call(el) as Animation[];
    if (!running || running.length === 0) return;
    await Promise.allSettled(running.map(a => a.finished));
}

const classesOf = (name: string, phase: 'enter' | 'leave') => ({
    from: `${name}-${phase}-from`,
    active: `${name}-${phase}-active`,
    to: `${name}-${phase}-to`,
});

/** Gỡ mọi class transition của cả 2 phase — dùng khi bị huỷ giữa chừng. */
function clearClasses(el: Element, name: string): void {
    for (const phase of ['enter', 'leave'] as const) {
        const c = classesOf(name, phase);
        el.classList.remove(c.from, c.active, c.to);
    }
}

/** Chạy enter. Bị enter/leave khác chen ngang → thoát, không đụng DOM nữa. */
export async function runEnter(el: Element, name: string): Promise<void> {
    const token = bump(el);
    const c = classesOf(name, 'enter');

    clearClasses(el, name);
    el.classList.add(c.from, c.active);

    await nextFrame();
    if (!isCurrent(el, token)) return;

    el.classList.remove(c.from);
    el.classList.add(c.to);

    await whenAnimationsDone(el);
    if (!isCurrent(el, token)) return;

    el.classList.remove(c.active, c.to);
}

/**
 * Chạy leave rồi GỠ node. Trả promise resolve sau khi node đã rời DOM.
 * Element được đánh dấu leaving ngay lập tức để không ai giật mất giữa chừng.
 */
export async function runLeave(el: Element, name: string): Promise<void> {
    const token = bump(el);
    const c = classesOf(name, 'leave');

    leavingNodes.add(el);
    clearClasses(el, name);
    el.classList.add(c.from, c.active);

    await nextFrame();
    if (!isCurrent(el, token)) { leavingNodes.delete(el); return; }

    el.classList.remove(c.from);
    el.classList.add(c.to);

    await whenAnimationsDone(el);
    if (!isCurrent(el, token)) { leavingNodes.delete(el); return; }

    leavingNodes.delete(el);
    el.classList.remove(c.active, c.to);
    (el as ChildNode).remove();
}
