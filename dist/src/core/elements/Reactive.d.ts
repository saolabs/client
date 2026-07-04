import { InitMode } from "../contracts/common";
import type { HtmlInterface, SaoElementChildren } from "../contracts/ElementInterface";
import type { MarkerModelInterface } from "../contracts/MarkerInterface";
import type { ReactiveInterface, ReactiveChildrenFactory } from "../contracts/ReactiveInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { SaoObjectType } from "../types/utils";
/**
 * Reactive — a region in the DOM bounded by comment markers that
 * can re-render its content when reactive dependencies change.
 *
 * Use cases:
 *   - o-if / o-show conditional rendering
 *   - o-for list rendering
 *   - @useBlock(name) slot mounting
 *   - Any expression binding that affects DOM structure
 *
 * The open/close comment markers stay in place; only the content
 * between them is replaced on re-render. This avoids the need to
 * scan/diff the entire DOM tree.
 */
export declare class Reactive implements ReactiveInterface {
    static class: string;
    saoType: SaoObjectType;
    id: string;
    type: string;
    openTag: Comment;
    closeTag: Comment;
    parentElement: HtmlInterface | null;
    parentReactive: ReactiveInterface | null;
    parent: HtmlInterface | null;
    ctx: ViewControllerInterface;
    childrenFactory: ReactiveChildrenFactory;
    children: SaoElementChildren;
    private mounted;
    stateKeys: string[];
    unsubscribe: () => void;
    private _isStarted;
    /** Marker model (hydration) — gán bởi BlockManager/SSR khi cần; mặc định null. */
    marker: MarkerModelInterface | null;
    domChildren: Node[];
    initMode: InitMode;
    /**
     * Slot cache cho @foreach reconciliation (Phase 5).
     * Được tạo khi type === 'foreach', null cho tất cả các type khác.
     * Cache maps item ref → Saola elements — cho phép reuse elements
     * khi item object reference không thay đổi.
     */
    private _foreachCache;
    constructor({ type, id, ctx, parentElement, parentReactive, stateKeys, childrenFactory, initMode, }: {
        id?: string | null;
        type?: string;
        ctx: ViewControllerInterface;
        parentElement?: HtmlInterface | null;
        parentReactive?: ReactiveInterface | null;
        stateKeys?: string[];
        childrenFactory: ReactiveChildrenFactory;
        initMode?: InitMode;
    });
    /**
     * Tìm cặp comment markers từ server-rendered HTML.
     * Format MarkerRegistry: open = `r:id`, close = `/r:id`
     * (r = shortcut cho 'reactive').
     */
    private claimSSRMarkers;
    setParentElement(parent: HtmlInterface | null): void;
    setChildrenFactory(factory: ReactiveChildrenFactory): void;
    setStateKeys(stateKeys: string[]): void;
    /** Registry guard — element đã destroy không được reuse */
    __destroyed__: boolean;
    /**
     * Render — idempotent + position-aware (RUNTIME_CONTRACT.md §2):
     *   - Markers chưa trong DOM → đặt markers (trước closeTag của parentReactive
     *     nếu có, ngược lại append vào parentElement — đường mountElementList
     *     duyệt tuần tự nên vị trí đúng).
     *   - Markers đã trong DOM → chỉ thay nội dung GIỮA markers.
     * Children loại marker-based (Output, nested Reactive, Fragment) được CALLER
     * đặt markers vào đúng vị trí trước, rồi mới gọi child.render() — FIX(baseline#6).
     * Children sinh ra khi đang active được start() ngay — FIX(baseline#7).
     */
    render(): void;
    /**
     * Phần render nội bộ: chạy childrenFactory, insert children vào DOM.
     * Dùng cho initial render (mọi type) và re-render non-foreach.
     * Precondition: markers đã trong DOM.
     */
    private _renderChildren;
    /**
     * Hydrate children — tạo JS element objects từ factory nhưng KHÔNG insert DOM.
     * Html children đã claim server DOM nodes trong constructor.
     * Output/Reactive children gọi render() để claim markers.
     * Sau hydrate, re-render tiếp theo dùng flow CSR bình thường.
     */
    private _hydrateChildren;
    /**
     * renderForeach — identity-keyed reconciliation cho @foreach (Phase 5).
     *
     * # Thuật toán
     * 1. Snapshot cache hiện tại (prevSlots) — biết item nào đang hiển thị
     * 2. Chạy childrenFactory với cache active → __foreach trả về:
     *    - cached elements nếu item ref giống (no DOM create)
     *    - elements mới nếu item mới (và lưu vào cache)
     * 3. Diff: items nào KHÔNG xuất hiện trong kết quả mới → destroy + xoá cache
     * 4. Reorder DOM: insertBefore(closeTag) cho tất cả elements mới (move hoặc append)
     * 5. Cleanup orphan DOM nodes (nodes còn sót từ destroyed items)
     * 6. Start elements mới nếu vùng đang active
     *
     * # Complexity
     * - O(n) forEach pass trong __foreach
     * - O(n) destroy pass cho removed items
     * - O(n) DOM move pass (insertBefore là O(1) mỗi node)
     * → Tổng O(n) so với O(2n) của clear+recreate, nhưng tiết kiệm DOM create/destroy
     *   cho unchanged items.
     */
    private renderForeach;
    /**
     * Di chuyển một khối marker-based (openTag ... closeTag) đến trước closeTag của Reactive.
     * Dùng khi reuse một slot đã có trong DOM nhưng cần thay đổi vị trí (reorder).
     */
    private _moveMarkerBlock;
    /**
     * Xoá các DOM nodes "mồ côi" giữa openTag và closeTag của Reactive.
     * Orphan = nodes không thuộc bất kỳ child nào trong newChildren.
     *
     * Build tập hợp "expected nodes" từ newChildren, sau đó scan DOM
     * và remove nodes không nằm trong tập đó.
     */
    private _cleanOrphanNodes;
    /** Schedule a re-render through the ViewController */
    update(): void;
    /** Clear all DOM nodes between the open and close markers */
    private clearContent;
    /** Insert a node just before the close marker */
    private insertBeforeClose;
    /** Determine the actual DOM element to insert into */
    private getInsertionTarget;
    /** Start — subscribe to stateKeys and recursively start children.
     * Called during START phase of view lifecycle. */
    start(): void;
    /** Stop — unsubscribe and recursively stop children. */
    stop(): void;
    /** Remove content but keep markers (for hide/show scenarios) */
    hide(): void;
    /** Re-render content (for show after hide) */
    show(): void;
    destroy(): void;
    get isOneReactive(): boolean;
    set isOneReactive(value: boolean);
    set isSaoElement(value: boolean);
    get isSaoElement(): boolean;
}
//# sourceMappingURL=Reactive.d.ts.map