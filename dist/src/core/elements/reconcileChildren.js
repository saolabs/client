import { TextElement } from './TextElement.js';
/** Static compiler text has no lifecycle state; retain its existing Text node. */
export function reuseStaticText(previous, next) {
    return next.map((child, index) => {
        const old = previous[index];
        if (old instanceof TextElement && child instanceof TextElement && old !== child
            && old.isStatic && child.isStatic && !old.__destroyed__) {
            old.replaceStaticText(child.text);
            child.destroy();
            return old;
        }
        return child;
    });
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
/** Reconcile Saola children by wrapper identity; factories refresh their config. */
export function reconcileChildren(parent, previous, next, anchor = null, refresh = () => true) {
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
    let before = anchor;
    for (let i = next.length - 1; i >= 0; i--)
        before = placeChild(parent, next[i], before);
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