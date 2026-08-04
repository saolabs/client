import { InitModes } from "../contracts/common";
import { generateUUID } from "../helpers/utils";
import { MarkerModel } from "../services/MarkerModel";
import markerRegistry from "../services/MarkerRegistry";
import { SaoMarker } from "../services/MarkerService";
/**
 * Block — a named mounting slot used in layout views.
 *
 * In a layout (super view), you declare blocks like `@useBlock('content')`.
 * Each block is a Reactive region that mounts/unmounts page view content.
 *
 * Key behaviors:
 *   - Only active when the layout view is active
 *   - Caches previously mounted view content (DOM nodes) so that
 *     navigating back doesn't re-render and lose user state
 *   - Tracks which viewId is currently active in this slot
 *
 * Flow:
 *   1. Layout declares: `@useBlock('content')` → creates Block('content')
 *   2. Router navigates to page → BlockManager.mount('content', viewId, factory)
 *   3. Block caches old content, mounts new content
 *   4. Browser back → BlockManager restores cached content without re-render
 */
export class Block {
    constructor({ ctx, name, viewId = null, contentRenderFactory = (parentElement) => [], id = null, initMode = 'create' }) {
        this.saoType = 'Block';
        this.viewId = null;
        /** Key trả về bởi markerRegistry.register — destroy() dùng để gỡ lại */
        this.markerKey = null;
        this.fragment = null;
        this.contentRenderFactory = null;
        this.marker = null;
        this.domChildren = [];
        this.parentElement = null;
        this.isOneBlock = true;
        this.isSaoElement = false;
        this.id = id ?? generateUUID(10); // Unique ID for debugging
        this.ctx = ctx;
        this.name = name;
        this.viewId = viewId ?? ctx.viewId; // Associate block with current viewId
        this.initMode = initMode;
        this.contentRenderFactory = contentRenderFactory || ((parentElement) => []);
        if (this.initMode === InitModes.HYDRATE) {
            let marker = SaoMarker.first('block', this.id);
            if (marker) {
                this.marker = marker;
                this.openTag = marker.openTag;
                this.closeTag = marker.closeTag;
            }
            else {
                this.openTag = markerRegistry.createMarkerStart('block', this.id);
                this.closeTag = markerRegistry.createMarkerEnd('block', this.id);
                this.markerKey = markerRegistry.register('block', this.id, { name, viewId }); // Register block in marker registry
                this.marker = new MarkerModel({
                    tagName: "s:b",
                    name: "block",
                    markerID: this.id,
                    openTag: this.openTag,
                    closeTag: this.closeTag,
                    children: [],
                    attributes: {}
                });
            }
        }
        else {
            this.openTag = markerRegistry.createMarkerStart('block', this.id);
            this.closeTag = markerRegistry.createMarkerEnd('block', this.id);
            this.markerKey = markerRegistry.register('block', this.id, { name, viewId }); // Register block in marker registry
            this.marker = new MarkerModel({
                tagName: "s:b",
                name: "block",
                markerID: this.id,
                openTag: this.openTag,
                closeTag: this.closeTag,
                children: [],
                attributes: {}
            });
        }
    }
    /** Initialize the block */
    init() {
        if (this.initMode === 'hydrate') {
            // Hydration logic here
        }
        else {
            // Creation logic here
        }
    }
    /** Render the block's content into the parent element */
    render() {
        if (!this.contentRenderFactory)
            return;
        // Generate content using the factory
        const content = this.contentRenderFactory(this.parentElement);
    }
    mount(mountCtx, parentElement) {
        if (this.fragment) {
            this.fragment.parent = parentElement;
            this.fragment.render();
        }
    }
    unmount() {
        // Unmount logic (e.g. hide or remove DOM nodes, stop reactions)
    }
    destroy() {
        // MarkerRegistry là singleton toàn cục — không gỡ thì record sống qua navigate.
        if (this.markerKey) {
            markerRegistry.remove(this.markerKey);
            this.markerKey = null;
        }
    }
    update() {
        // Update logic (e.g. re-render content on state change)
    }
    /** Set the block's parent element (used for mounting) */
    setParentElement(parentElement) {
        this.parentElement = parentElement;
    }
}
//# sourceMappingURL=Block.js.map