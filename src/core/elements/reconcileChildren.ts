import { TextElement } from './TextElement.js';

/** Static compiler text has no lifecycle state; retain its existing Text node. */
export function reuseStaticText(previous: readonly any[], next: any[]): any[] {
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
export function placeChild(parent: Node, child: any, before: Node | null): Node | null {
    const first: Node | undefined = child instanceof Node ? child : child.element ?? child.openTag;
    const last: Node | undefined = child instanceof Node ? child : child.element ?? child.closeTag;
    if (!first || !last) return before;
    if (first.parentNode === parent && last.parentNode === parent && last.nextSibling === before) return first;
    const nodes: Node[] = [first];
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
        const moveBefore = (parent as any).moveBefore;
        if (typeof moveBefore === 'function' && node.isConnected && parent.isConnected) moveBefore.call(parent, node, before);
        else parent.insertBefore(node, before);
    }
    return first;
}

/** Reconcile Saola children by wrapper identity; factories refresh their config. */
export function reconcileChildren(
    parent: Node, previous: readonly any[], next: readonly any[],
    anchor: Node | null = null, refresh: (child: any) => boolean = () => true,
): void {
    const focused = parent.ownerDocument?.activeElement as HTMLElement | null;
    const containsFocus = focused && parent.contains(focused);
    const selection = containsFocus && 'selectionStart' in focused
        ? { start: (focused as HTMLInputElement).selectionStart, end: (focused as HTMLInputElement).selectionEnd,
            direction: (focused as HTMLInputElement).selectionDirection } : null;
    const nextSet = new Set(next);
    const oldSet = new Set(previous);
    for (const child of previous) {
        if (nextSet.has(child)) continue;
        if (typeof child.destroy === 'function') child.destroy();
        else if (child instanceof Node) child.parentNode?.removeChild(child);
    }
    let before = anchor;
    for (let i = next.length - 1; i >= 0; i--) before = placeChild(parent, next[i], before);
    for (const child of next) {
        if (!oldSet.has(child) || refresh(child)) child.render?.();
    }
    if (containsFocus && focused.isConnected && parent.ownerDocument?.activeElement !== focused) {
        focused.focus({ preventScroll: true });
        if (selection?.start != null && selection.end != null) {
            (focused as HTMLInputElement).setSelectionRange(selection.start, selection.end, selection.direction ?? undefined);
        }
    }
}
