import { InitModes } from "../contracts/common.js";
import { generateUUID } from "../helpers/utils.js";
import markerRegistry from "../services/MarkerRegistry.js";
export class YieldElement {
    constructor({ ctx, name = '', initMode = InitModes.CREATE, id = null, defaultValue = '' }) {
        this.saoType = "Yield";
        this.initMode = InitModes.CREATE;
        this.domChildren = [];
        this.parent = null;
        this.defaultValue = '';
        /** Registry guard — thiếu field này thì aliveFromRegistry tái dùng Yield đã destroy */
        this.__destroyed__ = false;
        this.ctx = ctx;
        this.name = name;
        this.initMode = initMode;
        // Marker id đầy đủ = {viewId}-{hash} — khớp quy ước server (HYDRATION.md §5.1),
        // giống Component.ts. Trước đây thiếu prefix viewId → hydrate không tìm đúng marker.
        const rawId = id && id.length > 0 ? id : generateUUID();
        this.id = `${ctx.viewId}-${rawId}`;
        this.defaultValue = defaultValue;
        // Claim marker server qua index O(1) của MarkerRegistry — giống Reactive/
        // Output/Component. Bản cũ duyệt TOÀN BỘ comment của tài liệu cho mỗi @yield.
        const claimed = (this.initMode === InitModes.HYDRATE)
            ? markerRegistry.claim('yield', this.id)
            : null;
        if (claimed) {
            this.openTag = claimed.open;
            this.closeTag = claimed.close;
            for (let node = claimed.open.nextSibling; node && node !== claimed.close; node = node.nextSibling) {
                this.domChildren.push(node);
            }
        }
        else {
            this.createMarkers();
        }
    }
    createMarkers() {
        markerRegistry.register('yield', this.id, { name: this.name });
        this.openTag = markerRegistry.createMarkerStart('yield', this.id);
        this.closeTag = markerRegistry.createMarkerEnd('yield', this.id);
    }
    setParentElement(parent) {
        this.parent = parent;
    }
    /** Idempotent: markers already in DOM (hydrate claim, or same-layout reuse) → keep as-is. */
    render() {
        if (this.openTag.parentNode)
            return;
        if (!this.parent?.element)
            return;
        const parentEl = this.parent.element;
        parentEl.appendChild(this.openTag);
        parentEl.appendChild(this.closeTag);
    }
    destroy() {
        this.__destroyed__ = true;
        this.ctx.releaseElement?.(this);
        this.openTag?.remove();
        this.closeTag?.remove();
        this.domChildren = [];
        this.parent = null;
    }
    get isSaoElement() { return true; }
    set isSaoElement(_) { }
    get isOneYield() { return true; }
    set isOneYield(_) { }
}
//# sourceMappingURL=Yield.js.map