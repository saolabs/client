import { InitModes } from "../contracts/common";
import { generateUUID } from "../helpers/utils";
import { mountChildrenBeforeAnchor } from "../helpers/view";
export class Component {
    constructor({ ctx, parent = null, id = null, stateKeys = [], data = {}, dataFactory = null, path = null, type = 'default', condition = null, initMode = InitModes.CREATE, }) {
        this.saoType = 'Component';
        this.domChildren = []; // For compatibility with HtmlInterface; Component itself doesn't have a single root element
        this.viewRef = null;
        this.path = null; // For dynamic imports
        this.type = 'default';
        this.condition = null; // For 'when' type components
        this.initMode = InitModes.CREATE; // Default initialization mode
        this.subscribeFn = () => { };
        this.unsubscribeFn = () => { };
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
        this.openTag = document.createComment(`component-start`);
        this.closeTag = document.createComment(`component-end`);
        this.id = `${ctx.viewId}-${id ?? generateUUID(10)}`; // Unique ID for debugging
        this.dataFactory = dataFactory;
        this.path = path;
        this.type = type;
        this.condition = condition;
        this.initMode = initMode ?? InitModes.CREATE;
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
     */
    render() {
        if (this.__destroyed__)
            return;
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
        this.mountChild();
    }
    /** Tạo + mount child view giữa markers (nếu chưa có) */
    mountChild() {
        if (this._childMounted && this.viewRef)
            return;
        const viewManager = this.ctx.App?.View;
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
        childCtrl.commitData();
        this._childMounted = true;
        // Nếu component đang active (mount trong re-render) → start child ngay
        if (this._isStarted) {
            childCtrl.start();
            childCtrl.active();
        }
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
        this.__destroyed__ = true;
        this.stop();
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