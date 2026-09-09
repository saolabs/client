import { InitModes } from "../contracts/common.js";
import { generateUUID } from "../helpers/utils.js";
import { activateView, claimHydratedView, commitView, mountChildrenBeforeAnchor } from "../helpers/view.js";
import markerRegistry from "../services/MarkerRegistry.js";
export class Component {
    constructor({ ctx, parent = null, id = null, stateKeys = [], data = {}, dataFactory = null, path = null, type = 'default', condition = null, initMode = InitModes.CREATE, listeners = {}, }) {
        this.saoType = 'Component';
        this.domChildren = []; // For compatibility with HtmlInterface; Component itself doesn't have a single root element
        this.viewRef = null;
        this.path = null; // For dynamic imports
        this.type = 'default';
        this.condition = null; // For 'when' type components
        this.initMode = InitModes.CREATE; // Default initialization mode
        this.subscribeFn = () => { };
        this.unsubscribeFn = () => { };
        /**
         * Listener khai báo tại thẻ cha: `<mycomp @edit(openEditor(event))>`.
         *
         * Con gọi `emit('edit', payload)` → ViewController.emit tra Ở ĐÂY, không đi
         * qua event bus: không rò sang instance khác, không phải gỡ đăng ký.
         *
         * Đọc lúc phát chứ không copy vào data con: mỗi lần cha render lại,
         * `ViewController.include()` thay bảng này bằng closure mới, nên handler
         * luôn nhìn thấy biến vòng lặp / prop của LƯỢT RENDER hiện tại — kể cả khi
         * component không có prop reactive nào để kích hoạt updateData.
         */
        this.listeners = {};
        this.dataFactory = null;
        /** Registry guard */
        this.__destroyed__ = false;
        this._isStarted = false;
        this.unsubscribeData = null;
        this.unsubscribeCondition = null;
        /** 'when' type: trạng thái mounted hiện tại của child */
        this._childMounted = false;
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
        this.listeners = listeners || {};
        this.initMode = initMode ?? InitModes.CREATE;
        if (this.initMode === InitModes.HYDRATE) {
            // ── Hydrate: claim cặp marker component server đã render ─────
            const claimed = this.claimSSRMarkers();
            if (claimed) {
                this.openTag = claimed.open;
                this.closeTag = claimed.close;
            }
            else {
                // Partial hydration fallback (server không render vùng này)
                this.openTag = markerRegistry.createMarkerStart('component', this.id);
                this.closeTag = markerRegistry.createMarkerEnd('component', this.id);
            }
        }
        else {
            // Format chuẩn s:c:{id}-s/-e — PHẢI khớp server để SSR/CSR cùng kết quả
            this.openTag = markerRegistry.createMarkerStart('component', this.id);
            this.closeTag = markerRegistry.createMarkerEnd('component', this.id);
        }
    }
    /**
     * Tìm cặp marker component từ server-rendered HTML (format chuẩn §5.1):
     *   open: s:c:{id}-s   close: s:c:{id}-e
     */
    claimSSRMarkers() {
        return markerRegistry.claim('component', this.id, this.parent?.element ?? null);
    }
    mergeData(newData) {
        this.data = { ...this.data, ...newData };
    }
    setDataFactory(factory) {
        this.dataFactory = factory;
    }
    setCondition(condition) {
        this.condition = condition;
    }
    setStateKeys(stateKeys) {
        this.stateKeys = stateKeys;
    }
    setListeners(listeners) {
        this.listeners = listeners || {};
    }
    setParentElement(parent) {
        this.parent = parent;
    }
    setView(view) {
        this.viewRef = view;
    }
    setParent(parent) {
        this.parent = parent;
    }
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
    render() {
        if (this.__destroyed__)
            return;
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
                    const viewManager = this.ctx.App?.View;
                    if (!viewManager?.exists?.(this.path ?? '')) {
                        this.initMode = InitModes.CREATE;
                        return;
                    }
                }
                this.guardChildMount(() => this.hydrateChild());
                this.initMode = InitModes.CREATE; // re-render sau này dùng CSR flow
                return;
            }
            // Partial hydration fallback: server không render component này → CSR
            this.initMode = InitModes.CREATE;
        }
        // 1. Markers
        if (!this.openTag.parentNode) {
            const parentEl = this.parent?.element;
            if (!parentEl)
                return;
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
            const viewManager = this.ctx.App?.View;
            if (!viewManager?.exists?.(this.path ?? '')) {
                return; // @includeIf: view không tồn tại → bỏ qua, không lỗi
            }
        }
        this.guardChildMount(() => this.mountChild());
    }
    /**
     * Error boundary cho subtree con (@include). Boundary được tìm từ ctx —
     * controller CHỨA @include này, không phải view con — nên onError của một
     * view không bắt lỗi render của chính nó (giống React ErrorBoundary).
     * Không boundary nào xử lý → rethrow, giữ nguyên hành vi cũ (bubble lên
     * try/catch của renderPageView).
     */
    guardChildMount(mount) {
        try {
            mount();
        }
        catch (err) {
            const result = this.ctx.handleError(err, { phase: 'render', path: this.path ?? '' });
            if (!result.handled)
                throw err;
            this.mountFallback(result.fallback);
        }
    }
    /** Dọn DOM dở dang của lần render lỗi rồi chèn fallback giữa cặp marker. */
    mountFallback(fallback) {
        let current = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next = current.nextSibling;
            current.parentNode?.removeChild(current);
            current = next;
        }
        if (fallback === null || fallback === undefined)
            return;
        mountChildrenBeforeAnchor(this.closeTag, Array.isArray(fallback) ? fallback : [fallback], this.parent);
    }
    /**
     * Discover viewId server đã dùng cho child view: quét comment giữa cặp
     * marker component, tìm marker view mở đầu tiên <!--s:v:{id}-s-->.
     */
    discoverChildViewId() {
        let current = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            if (current.nodeType === Node.COMMENT_NODE) {
                const parsed = markerRegistry.parseComment(current.nodeValue ?? '');
                if (parsed && parsed.tag === 'view' && !parsed.isClose)
                    return parsed.id;
            }
            else if (current.nodeType === Node.ELEMENT_NODE) {
                const walker = document.createTreeWalker(current, NodeFilter.SHOW_COMMENT);
                let node;
                while ((node = walker.nextNode())) {
                    const parsed = markerRegistry.parseComment(node.nodeValue ?? '');
                    if (parsed && parsed.tag === 'view' && !parsed.isClose)
                        return parsed.id;
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
    hydrateChild() {
        if (this._childMounted && this.viewRef)
            return;
        // Không có marker view của server giữa cặp marker component → server
        // KHÔNG render view con ở đây. Hydrate tiếp thì child giữ viewId do
        // client sinh ('c…'), rồi đi tìm class "{c…}-{id}" và marker
        // "s:v:c…" không tồn tại → dựng cây mới CẠNH cây server, tức nhân đôi
        // DOM. Dọn phần server bỏ lại rồi đi đường CSR — giống nhánh
        // "partial hydration fallback" ở render() khi marker component vắng.
        const ssrViewId = this.discoverChildViewId();
        if (!ssrViewId) {
            this.unmountChild();
            this.mountChild();
            return;
        }
        const childView = this.resolveChildView();
        if (!childView)
            return;
        const childCtrl = childView.__ctrl__;
        // Ghi đè viewId = viewId server (trước render — Wrapper/Html/Output của
        // child claim theo marker/class prefix bằng viewId này)
        childCtrl.viewId = ssrViewId;
        // Commit state TRƯỚC render (factory @if/@foreach sinh đúng cây khớp SSR);
        // flush ngay khi chưa subscribe → discard pending, không phá DOM claim.
        childCtrl.initMode = InitModes.HYDRATE;
        commitView(childCtrl, true);
        const wrapper = childCtrl.render();
        if (wrapper && typeof wrapper === 'object' && 'openTag' in wrapper && this.parent) {
            claimHydratedView(childCtrl, this.parent, wrapper);
        }
        childCtrl.initMode = InitModes.CREATE;
        this.finishChildMount(childCtrl);
    }
    /** Tạo + mount child view giữa markers (nếu chưa có) */
    mountChild() {
        if (this._childMounted && this.viewRef)
            return;
        const childView = this.resolveChildView();
        if (!childView)
            return;
        const childCtrl = childView.__ctrl__;
        // Render child tree giữa markers
        const wrapper = childCtrl.render();
        if (wrapper && typeof wrapper === 'object' && 'openTag' in wrapper) {
            const insertBeforeClose = (node) => {
                this.closeTag.parentNode?.insertBefore(node, this.closeTag);
            };
            insertBeforeClose(wrapper.openTag);
            insertBeforeClose(wrapper.closeTag);
            // Wrapper render idempotent qua mountChildrenBeforeAnchor
            mountChildrenBeforeAnchor(wrapper.closeTag, wrapper.render(), this.parent);
        }
        // mount(): nội dung child đã nằm giữa markers → fire mounting/mounted + acquire asset
        childCtrl.mount();
        commitView(childCtrl);
        this.markChildMounted(childCtrl);
    }
    /** Resolve one child instance and establish ownership before either DOM strategy. */
    resolveChildView() {
        const viewManager = this.ctx.App?.View;
        if (!viewManager || !this.path) {
            console.error(`[Component] Không resolve được view "${this.path}" — App.View chưa sẵn sàng.`);
            return null;
        }
        const data = this.dataFactory ? this.dataFactory(this.parent) : this.data;
        // Sync: render tree không await được (xem ViewManager.resolveViewSync).
        const childView = viewManager.resolveViewSync(this.path, data ?? {}, false);
        if (!childView) {
            console.error(`[Component] View "${this.path}" không tồn tại trong registry.`);
            return null;
        }
        this.viewRef = childView;
        const childCtrl = childView.__ctrl__;
        childCtrl.ownerComponent = this;
        childCtrl.setParent(this.ctx);
        this.ctx.addChild(childCtrl);
        childCtrl.setParentElement(this.parent);
        return childView;
    }
    /** Hydration mounts after commit/claim; CSR commits immediately after mount. */
    finishChildMount(childCtrl) {
        childCtrl.mount();
        this.markChildMounted(childCtrl);
    }
    markChildMounted(childCtrl) {
        this._childMounted = true;
        if (this._isStarted)
            activateView(childCtrl);
    }
    /** Gỡ child (when=false hoặc destroy) */
    unmountChild() {
        if (this.viewRef) {
            this.viewRef.__ctrl__.destroy();
            this.viewRef = null;
        }
        // Clear mọi node giữa markers
        let current = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next = current.nextSibling;
            current.remove();
            current = next;
        }
        this._childMounted = false;
    }
    /**
     * Start — kích hoạt child + subscribe:
     *   - stateKeys: props reactive — đổi → dataFactory mới → child.updateData()
     *   - condition (type 'when'): đổi → mount/unmount child
     */
    start() {
        if (this._isStarted || this.__destroyed__)
            return;
        this._isStarted = true;
        if (this.viewRef) {
            activateView(this.viewRef.__ctrl__);
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
    stop() {
        if (!this._isStarted)
            return;
        this._isStarted = false;
        if (this.unsubscribeData) {
            this.unsubscribeData();
            this.unsubscribeData = null;
        }
        if (this.unsubscribeCondition) {
            this.unsubscribeCondition();
            this.unsubscribeCondition = null;
        }
        this.viewRef?.__ctrl__.stop();
    }
    destroy() {
        if (this.__destroyed__)
            return;
        this.stop();
        this.__destroyed__ = true;
        this.ctx.releaseElement?.(this);
        this.unmountChild();
        this.openTag.remove();
        this.closeTag.remove();
        this.parent = null;
    }
    get isSaoElement() {
        return true;
    }
    set isSaoElement(value) {
        // No-op, just for type compatibility
    }
    get isOneComponent() {
        return true;
    }
    set isOneComponent(value) {
        // No-op, just for type compatibility
    }
}
//# sourceMappingURL=Component.js.map