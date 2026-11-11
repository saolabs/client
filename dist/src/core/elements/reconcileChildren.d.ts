/** Static compiler text has no lifecycle state; retain its existing Text node. */
export declare function reuseStaticText(previous: readonly any[], next: any[]): any[];
/**
 * Gỡ node KHÔNG thuộc child nào trong khoảng [start, end) của `parent`.
 *
 * Tiền đề: `children` đã nằm đúng thứ tự trong DOM (vừa qua reconcileChildren),
 * nên một lượt đi song song là đủ — không cần dựng Set mọi node hợp lệ rồi
 * chép cả childNodes ra mảng như trước.
 */
export declare function removeUnmanagedNodes(parent: Node, start: Node | null, end: Node | null, children: readonly any[], keep?: (node: Node) => boolean): void;
/** Place an element or marker range without touching nodes already in order. */
export declare function placeChild(parent: Node, child: any, before: Node | null): Node | null;
/** Reconcile Saola children by wrapper identity; factories refresh their config. */
export declare function reconcileChildren(parent: Node, previous: readonly any[], next: readonly any[], anchor?: Node | null, refresh?: (child: any) => boolean): void;
//# sourceMappingURL=reconcileChildren.d.ts.map