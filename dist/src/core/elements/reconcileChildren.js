import { TextElement } from './TextElement.js';
/** Static compiler text has no lifecycle state; retain its existing Text node. */
export function reuseStaticText(previous, next) {
    if (previous.length === 0)
        return next;
    for (let index = 0; index < next.length; index++) {
        const child = next[index];
        const old = previous[index];
        if (old !== child && old instanceof TextElement && child instanceof TextElement
            && old.isStatic && child.isStatic && !old.__destroyed__) {
            if (old.text !== child.text)
                old.replaceStaticText(child.text);
            child.destroy();
            next[index] = old;
        }
    }
    return next;
}
/**
 * Gỡ node KHÔNG thuộc child nào trong khoảng [start, end) của `parent`.
 *
 * Tiền đề: `children` đã nằm đúng thứ tự trong DOM (vừa qua reconcileChildren),
 * nên một lượt đi song song là đủ — không cần dựng Set mọi node hợp lệ rồi
 * chép cả childNodes ra mảng như trước.
 */
export function removeUnmanagedNodes(parent, start, end, children, keep) {
    let node = start;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const first = child instanceof Node ? child : child.element ?? child.openTag;
        const last = child instanceof Node ? child : child.element ?? child.closeTag;
        if (!first || !last || first.parentNode !== parent)
            continue;
        while (node && node !== end && node !== first) {
            const next = node.nextSibling;
            if (!keep || !keep(node))
                parent.removeChild(node);
            node = next;
        }
        if (node !== first)
            return; // thứ tự DOM lệch tiền đề — dừng, không xoá oan
        node = last.nextSibling;
    }
    while (node && node !== end) {
        const next = node.nextSibling;
        if (!keep || !keep(node))
            parent.removeChild(node);
        node = next;
    }
}
/** Place an element or marker range without touching nodes already in order. */
export function placeChild(parent, child, before) {
    const first = child instanceof Node ? child : child.element ?? child.openTag;
    const last = child instanceof Node ? child : child.element ?? child.closeTag;
    if (!first || !last)
        return before;
    if (first.parentNode === parent && last.parentNode === parent && last.nextSibling === before)
        return first;
    const nodes = [first];
    if (first !== last) {
        let current = first.nextSibling;
        while (current && current !== last) {
            nodes.push(current);
            current = current.nextSibling;
        }
        nodes.push(last);
    }
    for (const node of nodes) {
        // State-preserving native moves where available; detached/new nodes use
        // normal insertion. Older browsers use the focus restoration below.
        const moveBefore = parent.moveBefore;
        if (typeof moveBefore === 'function' && node.isConnected && parent.isConnected)
            moveBefore.call(parent, node, before);
        else
            parent.insertBefore(node, before);
    }
    return first;
}
/**
 * Đánh dấu các vị trí trong `next` mà child giữ nguyên thứ tự tương đối so với
 * `previous` (dãy con tăng dài nhất của chỉ số cũ) — những child đó không cần
 * di chuyển trong DOM.
 */
function longestStableRun(previous, next) {
    const oldIndex = new Map();
    for (let i = 0; i < previous.length; i++)
        oldIndex.set(previous[i], i);
    const n = next.length;
    const seq = new Int32Array(n);
    const link = new Int32Array(n);
    const tails = [];
    for (let i = 0; i < n; i++) {
        const value = oldIndex.get(next[i]);
        seq[i] = value === undefined ? -1 : value;
        if (value === undefined)
            continue;
        let lo = 0, hi = tails.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (seq[tails[mid]] < value)
                lo = mid + 1;
            else
                hi = mid;
        }
        link[i] = lo > 0 ? tails[lo - 1] : -1;
        tails[lo] = i;
    }
    const stay = new Uint8Array(n);
    for (let i = tails.length > 0 ? tails[tails.length - 1] : -1; i >= 0; i = link[i])
        stay[i] = 1;
    return stay;
}
/** Reconcile Saola children by wrapper identity; factories refresh their config. */
export function reconcileChildren(parent, previous, next, anchor = null, refresh = () => true) {
    // Ca phổ biến nhất khi state đổi: cùng đúng dãy wrapper, không thêm/bớt/đổi
    // chỗ. Không có gì để huỷ hay di chuyển nên cũng không cần chụp focus.
    if (previous.length === next.length) {
        let same = true;
        for (let i = 0; i < next.length; i++)
            if (previous[i] !== next[i]) {
                same = false;
                break;
            }
        if (same) {
            let before = anchor;
            for (let i = next.length - 1; i >= 0 && same; i--) {
                const child = next[i];
                const first = child instanceof Node ? child : child.element ?? child.openTag;
                const last = child instanceof Node ? child : child.element ?? child.closeTag;
                if (!first || !last)
                    continue;
                if (first.parentNode !== parent || last.nextSibling !== before)
                    same = false;
                else
                    before = first;
            }
            if (same) {
                for (let i = 0; i < next.length; i++)
                    if (refresh(next[i]))
                        next[i].render?.();
                return;
            }
        }
    }
    const focused = parent.ownerDocument?.activeElement;
    const containsFocus = focused && parent.contains(focused);
    const selection = containsFocus && 'selectionStart' in focused
        ? { start: focused.selectionStart, end: focused.selectionEnd,
            direction: focused.selectionDirection } : null;
    const nextSet = new Set(next);
    const oldSet = new Set(previous);
    for (const child of previous) {
        if (nextSet.has(child))
            continue;
        if (typeof child.destroy === 'function')
            child.destroy();
        else if (child instanceof Node)
            child.parentNode?.removeChild(child);
    }
    // Chỉ di chuyển những child nằm NGOÀI dãy con tăng dài nhất theo vị trí cũ.
    // Trước đây đổi chỗ hai hàng đầu/cuối làm mọi hàng ở giữa bị insertBefore
    // lại (đo: ~1000 lượt di chuyển cho một lần swap trên list 1000).
    const stay = previous.length > 0 ? longestStableRun(previous, next) : null;
    let before = anchor;
    for (let i = next.length - 1; i >= 0; i--) {
        const child = next[i];
        if (stay && stay[i]) {
            const first = child instanceof Node ? child : child.element ?? child.openTag;
            if (first && first.parentNode === parent) {
                before = first;
                continue;
            }
        }
        before = placeChild(parent, child, before);
    }
    for (const child of next) {
        if (!oldSet.has(child) || refresh(child))
            child.render?.();
    }
    if (containsFocus && focused.isConnected && parent.ownerDocument?.activeElement !== focused) {
        focused.focus({ preventScroll: true });
        if (selection?.start != null && selection.end != null) {
            focused.setSelectionRange(selection.start, selection.end, selection.direction ?? undefined);
        }
    }
}
//# sourceMappingURL=reconcileChildren.js.map