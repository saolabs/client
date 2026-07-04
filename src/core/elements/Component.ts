import { InitMode, InitModes } from "../contracts/common";
import { ComponentInterface } from "../contracts/ComponentInterface";
import { HtmlInterface, SaoChildrenFactory } from "../contracts/ElementInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { ViewInterface } from "../contracts/ViewInterface";
import { generateUUID } from "../helpers/utils";
import { mountChildrenBeforeAnchor, hydrateElementList } from "../helpers/view";
import markerRegistry from "../services/MarkerRegistry";
import { SaoObjectType } from "../types/utils";

export class Component implements ComponentInterface {
    saoType: SaoObjectType = 'Component';
    ctx: ViewControllerInterface;
    parent: HtmlInterface | null;
    domChildren: Node[] = []; // For compatibility with HtmlInterface; Component itself doesn't have a single root element
    stateKeys: string[];
    data: Record<string, any>;
    openTag: Comment;
    closeTag: Comment;
    viewRef: ViewInterface | null = null;
    id: string;
    path: string | null = null; // For dynamic imports
    type: 'default' | 'if' | 'when' = 'default';
    condition: {stateKeys: string[], checker: () => any} | null = null; // For 'when' type components
    initMode: InitMode = InitModes.CREATE; // Default initialization mode
    subscribeFn: () => void = () => {};
    unsubscribeFn: () => void = () => {};
    dataFactory: ((parentElement: HtmlInterface | null) => Record<string, any>) | null = null; 

    constructor({
        ctx,
        parent = null,
        id = null,
        stateKeys = [],
        data = {},
        dataFactory = null,
        path = null,
        type = 'default',
        condition = null,
        initMode = InitModes.CREATE,
    }: {
        ctx: ViewControllerInterface;
        parent?: HtmlInterface | null;
        id?: string | null;
        stateKeys?: string[];
        data?: Record<string, any>;
        dataFactory?: ((parentElement: HtmlInterface | null) => Record<string, any>) | null;
        path?: string | null;
        type?: 'default' | 'if' | 'when';
        condition?: {stateKeys: string[], checker: () => any} | null;
        initMode?: InitMode;
    }) {
        this.ctx = ctx;
        this.parent = parent;
        this.stateKeys = stateKeys;
        this.data = data || {};
        // id khớp server: Blade emit @startMarker('component', '{hash}') →
        // <!--s:c:{parentViewId}-{hash}-s--> (MarkerRegistryDirectiveService)
        this.id = `${ctx.viewId}-${id ?? generateUUID(10)}`;
        this.dataFactory = dataFactory;
        this.path = path;
        this.type = type;
        this.condition = condition;
        this.initMode = initMode ?? InitModes.CREATE;

        if (this.initMode === InitModes.HYDRATE) {
            // ── Hydrate: claim cặp marker component server đã render ─────
            const claimed = this.claimSSRMarkers();
            if (claimed) {
                this.openTag = claimed.open;
                this.closeTag = claimed.close;
            } else {
                // Partial hydration fallback (server không render vùng này)
                this.openTag = markerRegistry.createMarkerStart('component', this.id);
                this.closeTag = markerRegistry.createMarkerEnd('component', this.id);
            }
        } else {
            // Format chuẩn s:c:{id}-s/-e — PHẢI khớp server để SSR/CSR cùng kết quả
            this.openTag = markerRegistry.createMarkerStart('component', this.id);
            this.closeTag = markerRegistry.createMarkerEnd('component', this.id);
        }
    }

    /**
     * Tìm cặp marker component từ server-rendered HTML (format chuẩn §5.1):
     *   open: s:c:{id}-s   close: s:c:{id}-e
     */
    private claimSSRMarkers(): { open: Comment; close: Comment } | null {
        const searchRoot = this.parent?.element ?? document.body;
        const walker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_COMMENT);

        const openText = markerRegistry.openComment('component', this.id);
        const closeText = markerRegistry.closeComment('component', this.id);
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

    mergeData(newData: Record<string, any>): void {
        this.data = { ...this.data, ...newData };
    }

    setDataFactory(factory: (parentElement: HtmlInterface | null) => Record<string, any>) {
        this.dataFactory = factory;
    }
    setCondition(condition: {stateKeys: string[], checker: () => any}) {
        this.condition = condition;
    }
    setStateKeys(stateKeys: string[]) {
        this.stateKeys = stateKeys;
    }
    setParentElement(parent: HtmlInterface | null): void {
        this.parent = parent;
    }

    setView(view: ViewInterface) {
        this.viewRef = view;
    }
    setParent(parent: HtmlInterface | null): void {
        this.parent = parent;
    }

    /** Registry guard */
    public __destroyed__: boolean = false;
    private _isStarted = false;
    private unsubscribeData: (() => void) | null = null;
    private unsubscribeCondition: (() => void) | null = null;
    /** 'when' type: trạng thái mounted hiện tại của child */
    private _childMounted = false;

    /**
     * Render — @include (RUNTIME_CONTRACT.md §2):
     *   1. Đặt component markers (idempotent — caller có thể đã đặt đúng vị trí)
     *   2. Resolve child view từ registry (App.View)
     *   3. Render child wrapper GIỮA markers, liên kết parent ↔ child
     *   4. commitData cho child (start sẽ do lifecycle cascade gọi)
     *
     * Hydrate mode (markers claim được từ SSR): child view được tạo với đúng
     * viewId server đã dùng (discover từ marker view bên trong) → toàn bộ cây
     * con CLAIM DOM server thay vì tạo mới — SSR/CSR cho cùng kết quả.
     */
    render(): void {
        if (this.__destroyed__) return;

        // ── Hydrate path: markers đã có trong SSR DOM ──────────────────
        if (this.initMode === InitModes.HYDRATE) {
            if (this.openTag.parentNode) {
                // Điều kiện đánh giá với state ĐÃ commit (hydrateView commit trước
                // render) → kết quả khớp server-rendered output.
                if (this.type === 'when' && this.condition && !this.condition.checker()) {
                    this.initMode = InitModes.CREATE;
                    return; // server cũng không render child (điều kiện falsy)
                }
                if (this.type === 'if') {
                    const viewManager = (this.ctx as any).App?.View;
                    if (!viewManager?.exists?.(this.path ?? '')) {
                        this.initMode = InitModes.CREATE;
                        return;
                    }
                }
                this.hydrateChild();
                this.initMode = InitModes.CREATE; // re-render sau này dùng CSR flow
                return;
            }
            // Partial hydration fallback: server không render component này → CSR
            this.initMode = InitModes.CREATE;
        }

        // 1. Markers
        if (!this.openTag.parentNode) {
            const parentEl = this.parent?.element;
            if (!parentEl) return;
            parentEl.appendChild(this.openTag);
            parentEl.appendChild(this.closeTag);
        }

        // 2. Điều kiện theo type
        if (this.type === 'when' && this.condition) {
            const shouldMount = !!this.condition.checker();
            if (!shouldMount) {
                this.unmountChild();
                return;
            }
        }
        if (this.type === 'if') {
            const viewManager = (this.ctx as any).App?.View;
            if (!viewManager?.exists?.(this.path ?? '')) {
                return; // @includeIf: view không tồn tại → bỏ qua, không lỗi
            }
        }

        this.mountChild();
    }

    /**
     * Discover viewId server đã dùng cho child view: quét comment giữa cặp
     * marker component, tìm marker view mở đầu tiên <!--s:v:{id}-s-->.
     */
    private discoverChildViewId(): string | null {
        let current: Node | null = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            if (current.nodeType === Node.COMMENT_NODE) {
                const parsed = markerRegistry.parseComment(current.nodeValue ?? '');
                if (parsed && parsed.tag === 'view' && !parsed.isClose) return parsed.id;
            } else if (current.nodeType === Node.ELEMENT_NODE) {
                const walker = document.createTreeWalker(current, NodeFilter.SHOW_COMMENT);
                let node: Comment | null;
                while ((node = walker.nextNode() as Comment | null)) {
                    const parsed = markerRegistry.parseComment(node.nodeValue ?? '');
                    if (parsed && parsed.tag === 'view' && !parsed.isClose) return parsed.id;
                }
            }
            current = current.nextSibling;
        }
        return null;
    }

    /**
     * Hydrate child view — thứ tự chuẩn hydration (như ViewManager.hydrateView):
     * discover viewId → tạo instance → commit state → flush discard →
     * render claim DOM → mount() (hook + asset). KHÔNG chèn node mới.
     */
    private hydrateChild(): void {
        if (this._childMounted && this.viewRef) return;

        const viewManager = (this.ctx as any).App?.View;
        if (!viewManager || !this.path) {
            console.error(`[Component] Không resolve được view "${this.path}" — App.View chưa sẵn sàng.`);
            return;
        }

        const data = this.dataFactory ? this.dataFactory(this.parent) : this.data;
        const childView = viewManager.view(this.path, data ?? {}, false);
        if (!childView) {
            console.error(`[Component] View "${this.path}" không tồn tại trong registry.`);
            return;
        }
        this.viewRef = childView;

        const childCtrl = childView.__ctrl__;
        childCtrl.setParent(this.ctx);
        this.ctx.addChild(childCtrl);
        childCtrl.setParentElement(this.parent);

        // Ghi đè viewId = viewId server (trước render — Wrapper/Html/Output của
        // child claim theo marker/class prefix bằng viewId này)
        const ssrViewId = this.discoverChildViewId();
        if (ssrViewId) {
            childCtrl.viewId = ssrViewId;
        }

        // Commit state TRƯỚC render (factory @if/@foreach sinh đúng cây khớp SSR);
        // flush ngay khi chưa subscribe → discard pending, không phá DOM claim.
        childCtrl.initMode = InitModes.HYDRATE;
        childCtrl.commitData();
        childCtrl.states.__.flushNow();

        const wrapper = childCtrl.render();
        if (wrapper && typeof wrapper === 'object' && 'openTag' in wrapper && this.parent) {
            hydrateElementList(this.parent, (wrapper as any).render());
        }

        childCtrl.initMode = InitModes.CREATE;
        childCtrl.mount(); // DOM đã ở real DOM — fire mounting/mounted + acquire asset
        this._childMounted = true;

        if (this._isStarted) {
            childCtrl.start();
            childCtrl.active();
        }
    }

    /** Tạo + mount child view giữa markers (nếu chưa có) */
    private mountChild(): void {
        if (this._childMounted && this.viewRef) return;

        const viewManager = (this.ctx as any).App?.View;
        if (!viewManager || !this.path) {
            console.error(`[Component] Không resolve được view "${this.path}" — App.View chưa sẵn sàng.`);
            return;
        }

        const data = this.dataFactory ? this.dataFactory(this.parent) : this.data;
        const childView = viewManager.view(this.path, data ?? {}, false);
        if (!childView) {
            console.error(`[Component] View "${this.path}" không tồn tại trong registry.`);
            return;
        }
        this.viewRef = childView;

        // Liên kết parent ↔ child
        const childCtrl = childView.__ctrl__;
        childCtrl.setParent(this.ctx);
        this.ctx.addChild(childCtrl);

        // Render child tree giữa markers
        childCtrl.setParentElement(this.parent);
        const wrapper = childCtrl.render();
        if (wrapper && typeof wrapper === 'object' && 'openTag' in wrapper) {
            const insertBeforeClose = (node: Node) => {
                this.closeTag.parentNode?.insertBefore(node, this.closeTag);
            };
            insertBeforeClose(wrapper.openTag);
            insertBeforeClose(wrapper.closeTag);
            // Wrapper render idempotent qua mountChildrenBeforeAnchor
            mountChildrenBeforeAnchor(wrapper.closeTag, wrapper.render(), this.parent);
        }

        // mount(): nội dung child đã nằm giữa markers → fire mounting/mounted + acquire asset
        childCtrl.mount();
        childCtrl.commitData();
        this._childMounted = true;

        // Nếu component đang active (mount trong re-render) → start child ngay
        if (this._isStarted) {
            childCtrl.start();
            childCtrl.active();
        }
    }

    /** Gỡ child (when=false hoặc destroy) */
    private unmountChild(): void {
        if (this.viewRef) {
            this.viewRef.__ctrl__.destroy();
            this.viewRef = null;
        }
        // Clear mọi node giữa markers
        let current: Node | null = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next: Node | null = current.nextSibling;
            (current as ChildNode).remove();
            current = next;
        }
        this._childMounted = false;
    }

    /**
     * Start — kích hoạt child + subscribe:
     *   - stateKeys: props reactive — đổi → dataFactory mới → child.updateData()
     *   - condition (type 'when'): đổi → mount/unmount child
     */
    start(): void {
        if (this._isStarted || this.__destroyed__) return;
        this._isStarted = true;

        if (this.viewRef) {
            this.viewRef.__ctrl__.start();
            this.viewRef.__ctrl__.active();
        }

        if (this.stateKeys.length > 0) {
            this.unsubscribeData = this.ctx.states.__.subscribe(this.stateKeys, () => {
                if (this.viewRef && this.dataFactory) {
                    this.viewRef.__ctrl__.updateData(this.dataFactory(this.parent));
                }
            });
        }

        if (this.type === 'when' && this.condition && this.condition.stateKeys.length > 0) {
            this.unsubscribeCondition = this.ctx.states.__.subscribe(this.condition.stateKeys, () => {
                this.render(); // re-evaluate checker → mount/unmount
            });
        }
    }

    stop(): void {
        if (!this._isStarted) return;
        this._isStarted = false;

        if (this.unsubscribeData) { this.unsubscribeData(); this.unsubscribeData = null; }
        if (this.unsubscribeCondition) { this.unsubscribeCondition(); this.unsubscribeCondition = null; }
        this.viewRef?.__ctrl__.stop();
    }

    destroy(): void {
        if (this.__destroyed__) return;
        this.__destroyed__ = true;
        this.stop();
        this.unmountChild();
        this.openTag.remove();
        this.closeTag.remove();
        this.parent = null;
    }
    get isSaoElement(): boolean {
        return true;
    }
    set isSaoElement(value: boolean) {
        // No-op, just for type compatibility
    }
    get isOneComponent(): boolean {
        return true;
    }
    set isOneComponent(value: boolean) {
        // No-op, just for type compatibility
    }
}