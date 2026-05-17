import { generateUUID } from "../hellpers/utils";
import markerRegistry from "../services/MarkerRegistry";
export class BlockOutlet {
    constructor({ ctx, parentElement = null, name, id = null, initMode = 'create' }) {
        this.saoType = 'BlockOutlet';
        this.parent = null;
        this.parentElement = null;
        this.initMode = 'create';
        this.id = `${ctx.viewId}-${id ?? generateUUID(10)}`; // Unique ID for debugging
        this.ctx = ctx;
        this.name = name;
        this.parent = parentElement;
        this.parentElement = parentElement;
        this.initMode = initMode;
        markerRegistry.register('blockoutlet', this.id, { name, viewId: ctx.viewId }); // Register this outlet in the MarkerRegistry
        this.openTag = markerRegistry.createMarkerStart('blockoutlet', this.id);
        this.closeTag = markerRegistry.createMarkerEnd('blockoutlet', this.id);
    }
    hydrate() {
        // Hydration logic if needed (e.g. reattach event listeners)
    }
    render() {
        if (!this.parentElement || !this.parentElement.element)
            return;
        const parentEl = this.parentElement.element;
        // Place markers
        parentEl.appendChild(this.openTag);
        // Register this outlet in the MarkerRegistry for block mounting
        parentEl.appendChild(this.closeTag);
    }
    destroy() {
        // Remove markers from DOM
        this.openTag.remove();
        this.closeTag.remove();
    }
    start() {
        // Placeholder for any setup needed when the outlet becomes active
    }
    stop() {
        // Placeholder for any cleanup needed when the outlet becomes inactive
    }
    setParentElement(parentElement) {
        this.parent = parentElement;
        this.parentElement = parentElement;
    }
    get isSaoElement() {
        return true;
    }
    set isSaoElement(value) {
        // No-op setter to satisfy OneElement interface
    }
    get isOneBlockOutlet() {
        return true;
    }
    set isOneBlockOutlet(value) {
        // No-op setter to satisfy the Interface; this property is always true for BlockOutlet elements
    }
}
//# sourceMappingURL=BlockOutlet.js.map