import { InitMode, InitModes } from "../contracts/common";
import type { HtmlInterface, SaoChildrenFactoryOutput, SaoElementChildren } from "../contracts/ElementInterface";
import type { MarkerModelInterface } from "../contracts/MarkerInterface";
import type { ReactiveInterface, ReactiveChildrenFactory, ReactiveRenderFn } from "../contracts/ReactiveInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { generateUUID } from "../helpers/utils";
import { mountChildrenBeforeAnchor } from "../helpers/view";
import markerRegistry from "../services/MarkerRegistry";
import type { SaoObjectType } from "../types/utils";
import { ForeachSlotCache } from "./ForeachSlotCache";
import { isLeaving } from "../helpers/transition";

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
export class Reactive implements ReactiveInterface {
    static class = 'Reactive';
    saoType: SaoObjectType = 'Reactive';
    public id: string; // Unique ID for debugging and marker registry
    public type: string; // Custom type for different reactive behaviors (e.g. 'if', 'list')
    public openTag: Comment;
    public closeTag: Comment;
    public parentElement: HtmlInterface | null;
    public parentReactive: ReactiveInterface | null;
    public parent: HtmlInterface | null = null; // Alias for parentReactive to satisfy SaoNodeInterface

    public ctx: ViewControllerInterface;
    public childrenFactory: ReactiveChildrenFactory;
    public children: SaoElementChildren = [];
    private mounted: boolean = false;
    public stateKeys: string[];
    public unsubscribe: () => void = () => { };
    private _isStarted = false;
    /** Marker model (hydration) — gán bởi BlockManager/SSR khi cần; mặc định null. */
    marker: MarkerModelInterface | null = null;
    /** Key trả về bởi markerRegistry.register — destroy() dùng để gỡ lại */
    private markerKey: string | null = null;



    domChildren: Node[] = []; // For compatibility with HtmlInterface; Reactive itself doesn't have a single root element
    initMode: InitMode = InitModes.CREATE;

    /**
     * Slot cache cho @foreach reconciliation (Phase 5).
     * Được tạo khi type === 'foreach', null cho tất cả các type khác.
     * Cache maps item ref → Saola elements — cho phép reuse elements
     * khi item object reference không thay đổi.
     */
    private _foreachCache: ForeachSlotCache | null = null;
    constructor({
        type = 'reactive',
        id = null,
        ctx,
        parentElement = null,
        parentReactive = null,
        stateKeys = [],
        childrenFactory = () => [],
        initMode = InitModes.CREATE,
    }: {
        id?: string | null;
        type?: string;
        ctx: ViewControllerInterface;
        parentElement?: HtmlInterface | null;
        parentReactive?: ReactiveInterface | null;
        stateKeys?: string[];
        childrenFactory: ReactiveChildrenFactory;
        initMode?: InitMode;
    }) {
        this.ctx = ctx;
        this.parentElement = parentElement;
        this.parentReactive = parentReactive;
        this.id = id ? id : `${ctx.viewId}-${generateUUID(5)}`;
        this.type = type;
        this.childrenFactory = childrenFactory;
        this.stateKeys = stateKeys;
        this.initMode = initMode;

        // foreach type: khởi tạo slot cache để hỗ trợ identity-keyed reconciliation
        if (type === 'foreach') {
            this._foreachCache = new ForeachSlotCache();
        }

        if (this.initMode === InitModes.CREATE) {
            this.markerKey = markerRegistry.register('reactive', this.id, {
                type: this.type,
                stateKeys: this.stateKeys,
                viewID: this.ctx.viewId,
            });

            this.openTag = markerRegistry.createMarkerStart('reactive', this.id);
            this.closeTag = markerRegistry.createMarkerEnd('reactive', this.id);
        }
        else {
            // ── Hydrate: tìm markers SSR trong DOM ──────────────────────
            // Scan parent element cho cặp comment <!--r:id--> ... <!--/r:id-->
            // (MarkerRegistry format). Fallback tạo mới nếu không tìm thấy.
            const claimed = this.claimSSRMarkers();
            if (claimed) {
                this.openTag = claimed.open;
                this.closeTag = claimed.close;
            } else {
                this.openTag = markerRegistry.createMarkerStart('reactive', this.id);
                this.closeTag = markerRegistry.createMarkerEnd('reactive', this.id);
            }
        }
    }

    /**
     * Tìm cặp comment markers từ server-rendered HTML.
     * Format MarkerRegistry: open = `r:id`, close = `/r:id`
     * (r = shortcut cho 'reactive').
     */
    private claimSSRMarkers(): { open: Comment; close: Comment } | null {
        const searchRoot = this.parentElement?.element ?? document.body;
        const walker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_COMMENT);

        const openText = markerRegistry.openComment('reactive', this.id);
        const closeText = markerRegistry.closeComment('reactive', this.id);
        let openNode: Comment | null = null;

        let node: Comment | null;
        while ((node = walker.nextNode() as Comment | null)) {
            const value = node.nodeValue?.trim() ?? '';
            if (!openNode && value === openText) {
                openNode = node;
                continue;
            }
            if (openNode && value === closeText) {
                return { open: openNode, close: node };
            }
        }
        return null;
    }

    setParentElement(parent: HtmlInterface | null): void {
        this.parentElement = parent;
    }

    setChildrenFactory(factory: ReactiveChildrenFactory): void {
        this.childrenFactory = factory;
    }

    setStateKeys(stateKeys: string[]): void {
        this.stateKeys = stateKeys;
        // If already started, we need to resubscribe with new keys
        if (this._isStarted) {
            this.stop();
            this.start();
        }
    }

    /** Registry guard — element đã destroy không được reuse */
    public __destroyed__: boolean = false;

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
    render(): void {
        try {
            this._render();
        } catch (err) {
            // Lỗi ở vùng reactive thường xảy ra SAU khi trang đã sống (state đổi do
            // user tương tác) — ngoài mọi try/catch của renderPageView. 'render' cho
            // lần đầu, 'update' cho re-render.
            const phase = this.mounted ? 'update' : 'render';
            const result = this.ctx.handleError(err, { phase, path: this.ctx.path });
            if (!result.handled) throw err;
            this.clearContent();
            if (result.fallback !== null && result.fallback !== undefined) {
                mountChildrenBeforeAnchor(
                    this.closeTag,
                    Array.isArray(result.fallback) ? result.fallback : [result.fallback],
                    this.parentElement,
                );
            }
        }
    }

    private _render(): void {
        if (this.__destroyed__) return;

        // ── Hydrate mode: markers đã trong DOM từ SSR ────────────────
        // Tiền đề: ViewManager.hydrateView() đã gọi commitData() TRƯỚC bước này,
        // nên closure state (vd `show`) đã có giá trị = trạng thái server.
        // → childrenFactory sinh đúng element tree khớp với SSR DOM.
        // _hydrateChildren tạo JS objects (Html claim DOM, Output claim markers)
        // mà KHÔNG insert node mới — giữ nguyên DOM server-rendered.
        if (this.initMode === InitModes.HYDRATE && this.openTag.parentNode) {
            this._hydrateChildren();
            this.mounted = true;
            // Chuyển sang CREATE: re-render sau này (do state đổi) dùng CSR flow.
            this.initMode = InitModes.CREATE;
            return;
        }

        if (!this.openTag.parentNode) {
            // ── Lần đầu mount: đặt markers vào DOM ───────────────────────────
            const target = this.getInsertionTarget();
            if (!target) return;
            if (this.parentReactive && this.parentReactive.closeTag.parentNode === target) {
                target.insertBefore(this.openTag, this.parentReactive.closeTag);
                target.insertBefore(this.closeTag, this.parentReactive.closeTag);
            } else {
                target.appendChild(this.openTag);
                target.appendChild(this.closeTag);
            }
            this.mounted = true;

            // Initial render — _renderChildren tự mở cửa sổ cache quanh factory call
            this._renderChildren();
        } else if (this._foreachCache) {
            // ── Re-render @foreach: dùng reconciler ──────────────────────────
            this.renderForeach();
        } else {
            // ── Re-render các type khác: clear + factory ──────────────────────
            this.clearContent();
            this._renderChildren();
        }
    }

    /**
     * Phần render nội bộ: chạy childrenFactory, insert children vào DOM.
     * Dùng cho initial render (mọi type) và re-render non-foreach.
     * Precondition: markers đã trong DOM.
     */
    private _renderChildren(): void {
        // Cửa sổ cache chỉ mở quanh factory call — KHÔNG mở trong child.render()
        // phía dưới, tránh nested @foreach (chạy lúc render con) ghi nhầm entry
        // vào cache của loop ngoài rồi bị prunePass destroy oan ở pass sau.
        const output = this._runFactoryWithCache();
        const newChildren: any[] = [];

        for (const child of output) {
            if (child === null || child === undefined) continue;
            if (typeof child === 'string' || typeof child === 'number') {
                const textNode = document.createTextNode(String(child));
                this.insertBeforeClose(textNode);
                this.children.push(textNode);
            } else if (child instanceof Node) {
                this.insertBeforeClose(child);
                this.children.push(child as any);
            } else if (typeof child === 'object') {
                if ('element' in child && (child as any).element) {
                    // Html, TextElement — single root element
                    this.insertBeforeClose((child as any).element);
                    this.children.push(child);
                    newChildren.push(child);
                    child.render();
                } else if ('openTag' in child) {
                    // Marker-based: Output, nested Reactive, Fragment...
                    this.insertBeforeClose((child as any).openTag);
                    this.insertBeforeClose((child as any).closeTag);
                    this.children.push(child);
                    newChildren.push(child);
                    child.render();
                }
            }
        }

        // Vùng active: children mới cần start() ngay (có subscription/event)
        if (this._isStarted) {
            for (const child of newChildren) {
                if (typeof (child as any).start === 'function') {
                    (child as any).start();
                }
            }
        }
    }

    /**
     * Chạy childrenFactory với cửa sổ cache foreach (nếu có) mở đúng quanh
     * factory call. beginPass reset occurrence counters + touched set.
     */
    private _runFactoryWithCache(): SaoChildrenFactoryOutput {
        if (!this._foreachCache) {
            return this.childrenFactory(this, this.parentElement);
        }
        this._foreachCache.beginPass();
        this.ctx._currentForeachCache = this._foreachCache;
        try {
            return this.childrenFactory(this, this.parentElement);
        } finally {
            this.ctx._currentForeachCache = null;
        }
    }

    /**
     * Hydrate children — tạo JS element objects từ factory nhưng KHÔNG insert DOM.
     * Html children đã claim server DOM nodes trong constructor.
     * Output/Reactive children gọi render() để claim markers.
     * Sau hydrate, re-render tiếp theo dùng flow CSR bình thường.
     */
    private _hydrateChildren(): void {
        const output = this._runFactoryWithCache();

        for (const child of output) {
            if (child === null || child === undefined) continue;
            if (typeof child === 'string' || typeof child === 'number') continue;
            if (child instanceof Node) continue;

            if (typeof child === 'object') {
                if ('element' in child && (child as any).element) {
                    this.children.push(child);
                    child.render();
                } else if ('openTag' in child) {
                    if (typeof (child as any).setParentElement === 'function') {
                        (child as any).setParentElement(this.parentElement);
                    }
                    this.children.push(child);
                    child.render();
                }
            }
        }
    }

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
    private renderForeach(): void {
        // ── Step 1: Ghi nhớ children đang hiển thị (phân biệt reuse/new) ─────
        const cache = this._foreachCache!;
        const prevChildren = new Set(this.children); // old Saola elements

        // ── Step 2: Chạy factory với cache active (beginPass + claim/store) ──
        const output = this._runFactoryWithCache();

        // Flatten output thành danh sách children mới
        const newChildren: any[] = [];
        for (const child of output) {
            if (child === null || child === undefined) continue;
            if (typeof child === 'object') {
                newChildren.push(child);
            }
        }

        // ── Step 3: Destroy slot không được claim/store trong pass ───────────
        // = item đã rời list, hoặc bị thay bằng ref mới (key trùng nhưng ref đổi).
        cache.prunePass((slot) => {
            for (const el of slot.elements) {
                if (el && typeof el.destroy === 'function') {
                    el.destroy();
                }
            }
        });

        // ── Step 4: Reorder DOM ───────────────────────────────────────────────
        // insertBefore(closeTag) cho từng element mới:
        //   - Cached elements: DOM MOVE (đã có trong DOM, di chuyển đến vị trí đúng)
        //   - New elements: chạy render() + insert
        const trulyNew: any[] = [];
        for (const child of newChildren) {
            if ('element' in child && (child as any).element) {
                if (prevChildren.has(child)) {
                    // Reused — chỉ move DOM
                    this.insertBeforeClose((child as any).element);
                } else {
                    // New — render + insert
                    this.insertBeforeClose((child as any).element);
                    child.render();
                    trulyNew.push(child);
                }
            } else if ('openTag' in child) {
                if (prevChildren.has(child)) {
                    // Reused marker-based: move openTag + closeTag + nội dung giữa
                    this._moveMarkerBlock(child as any);
                } else {
                    // New marker-based: insert markers, render
                    this.insertBeforeClose((child as any).openTag);
                    this.insertBeforeClose((child as any).closeTag);
                    child.render();
                    trulyNew.push(child);
                }
            }
        }

        // ── Step 5: Cleanup orphan DOM nodes ──────────────────────────────────
        // Sau khi reorder, các DOM nodes của items đã destroyed còn "trôi nổi"
        // giữa openTag và đầu tiên của new children → phải xoá.
        this._cleanOrphanNodes(newChildren);

        // ── Step 6: Cập nhật children list ────────────────────────────────────
        this.children = newChildren;

        // ── Step 7: Start new elements nếu vùng đang active ──────────────────
        if (this._isStarted) {
            for (const child of trulyNew) {
                if (typeof child.start === 'function') {
                    child.start();
                }
            }
        }
    }

    /**
     * Di chuyển một khối marker-based (openTag ... closeTag) đến trước closeTag của Reactive.
     * Dùng khi reuse một slot đã có trong DOM nhưng cần thay đổi vị trí (reorder).
     */
    private _moveMarkerBlock(child: { openTag: Comment; closeTag: Comment }): void {
        const parent = this.closeTag.parentNode;
        if (!parent) return;

        // Thu thập tất cả nodes từ child.openTag → child.closeTag (inclusive)
        const nodes: Node[] = [];
        let current: Node | null = child.openTag;
        while (current && current !== child.closeTag) {
            nodes.push(current);
            current = current.nextSibling;
        }
        if (current) nodes.push(current); // closeTag

        // Move toàn bộ block về vị trí mới (trước this.closeTag)
        for (const node of nodes) {
            parent.insertBefore(node, this.closeTag);
        }
    }

    /**
     * Xoá các DOM nodes "mồ côi" giữa openTag và closeTag của Reactive.
     * Orphan = nodes không thuộc bất kỳ child nào trong newChildren.
     *
     * Build tập hợp "expected nodes" từ newChildren, sau đó scan DOM
     * và remove nodes không nằm trong tập đó.
     */
    private _cleanOrphanNodes(newChildren: any[]): void {
        // Thu thập tất cả DOM nodes hợp lệ (thuộc new children)
        const validNodes = new Set<Node>();
        for (const child of newChildren) {
            if ('element' in child && (child as any).element) {
                validNodes.add((child as any).element);
            } else if ('openTag' in child) {
                // Marker-based: collect tất cả nodes trong block
                let node: Node | null = (child as any).openTag;
                while (node && node !== (child as any).closeTag) {
                    validNodes.add(node);
                    node = node.nextSibling;
                }
                if (node) validNodes.add(node); // closeTag
            }
        }

        // Scan từ openTag → closeTag, remove nodes không hợp lệ.
        // Node đang chạy leave PHẢI nằm lại tới khi animation xong — nó tự gỡ.
        let current = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next = current.nextSibling;
            if (!validNodes.has(current) && !isLeaving(current)) {
                current.remove();
            }
            current = next;
        }
    }

    /** Schedule a re-render through the ViewController */
    update(): void {
        this.ctx.scheduleUpdate(this);
    }

    /** Clear all DOM nodes between the open and close markers */
    private clearContent(): void {
        // Destroy managed children first
        for (const child of this.children) {
            if (child && typeof child === 'object' && 'destroy' in child) {
                child.destroy();
            }
        }
        this.children = [];

        // Remove DOM nodes between markers — trừ node đang leave (child.destroy()
        // phía trên vừa khởi động animation cho chúng; tự gỡ khi xong).
        let current = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next = current.nextSibling;
            if (!isLeaving(current)) current.remove();
            current = next;
        }
    }

    /** Insert a node just before the close marker */
    private insertBeforeClose(node: Node): void {
        this.closeTag.parentNode?.insertBefore(node, this.closeTag);
    }

    /** Determine the actual DOM element to insert into */
    private getInsertionTarget(): HTMLElement | null {
        if (this.parentElement) {
            return this.parentElement.element;
        }
        return null;
    }

    /** Start — subscribe to stateKeys and recursively start children.
     * Called during START phase of view lifecycle. */
    start(): void {
        if (this._isStarted) return;
        this._isStarted = true;

        // Subscribe to state changes → schedule re-render
        if (this.stateKeys.length > 0) {
            this.unsubscribe = this.ctx.states.__.subscribe(
                this.stateKeys,
                () => this.update()
            );
        }

        // Recursively start children
        for (const child of this.children) {
            if (child && typeof child === 'object' && 'start' in child && typeof (child as any).start === 'function') {
                (child as any).start();
            }
        }
    }

    /** Stop — unsubscribe and recursively stop children. */
    stop(): void {
        if (!this._isStarted) return;
        this._isStarted = false;

        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = () => { };
        }

        // Recursively stop children
        for (const child of this.children) {
            if (child && typeof child === 'object' && 'stop' in child && typeof (child as any).stop === 'function') {
                (child as any).stop();
            }
        }
    }

    destroy(): void {
        this.__destroyed__ = true;
        this.ctx.releaseElement?.(this);
        // MarkerRegistry là singleton TOÀN CỤC (sống qua navigate). Reactive trong
        // loop có id kèm item (`{viewId}-{hash}-${item.id}`) → không gỡ thì mỗi
        // trang/mỗi lần refresh để lại một record vĩnh viễn.
        if (this.markerKey) {
            markerRegistry.remove(this.markerKey);
            this.markerKey = null;
        }
        this.stop();
        this.clearContent();
        // Giải phóng cache — clearContent() đã destroy các elements
        if (this._foreachCache) {
            this._foreachCache.clear();
        }
        this.openTag.remove();
        this.closeTag.remove();
        this.mounted = false;
        this.parentElement = null;
        this.parentReactive = null;
    }

    get isOneReactive(): boolean {
        return true;
    }
    set isOneReactive(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for Reactive elements
    }
    set isSaoElement(value: boolean) {
        // No-op setter to satisfy the Interface; Reactive is a type of OneElement
    }
    get isSaoElement(): boolean {
        return true;
    }
}