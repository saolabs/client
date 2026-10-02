/** Static compiler text has no lifecycle state; retain its existing Text node. */
export declare function reuseStaticText(previous: readonly any[], next: any[]): any[];
/** Place an element or marker range without touching nodes already in order. */
export declare function placeChild(parent: Node, child: any, before: Node | null): Node | null;
/** Reconcile Saola children by wrapper identity; factories refresh their config. */
export declare function reconcileChildren(parent: Node, previous: readonly any[], next: readonly any[], anchor?: Node | null, refresh?: (child: any) => boolean): void;
//# sourceMappingURL=reconcileChildren.d.ts.map