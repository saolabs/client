import type { BlockOutletInterface } from "../contracts/BlockInterface";
import { InitMode, InitModes } from "../contracts/common";
import type { HtmlInterface } from "../contracts/ElementInterface";
import { MarkerModelInterface } from "../contracts/MarkerInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { generateUUID } from "../helpers/utils";
import { MarkerModel } from "../services/MarkerModel";
import markerRegistry from "../services/MarkerRegistry";
import type { SaoObjectType } from "../types/utils";

export class BlockOutlet implements BlockOutletInterface {
    saoType: SaoObjectType = 'BlockOutlet';
    id: string;
    name: string;
    openTag: Comment;
    closeTag: Comment;
    parent: HtmlInterface | null = null;
    parentElement: HtmlInterface | null = null;
    ctx: ViewControllerInterface;
    initMode: InitMode = InitModes.CREATE;
    marker: MarkerModelInterface | null = null;
    constructor({ ctx, parentElement = null, name, id = null, initMode = InitModes.CREATE }: { ctx: ViewControllerInterface, parentElement?: HtmlInterface | null, name: string, id?: string | null, initMode?: InitMode }) {
        this.id = id ?? generateUUID(10); // Unique ID for debugging
        this.ctx = ctx;
        this.name = name;
        this.parent = parentElement;
        this.parentElement = parentElement;
        this.initMode = initMode;

        if (this.initMode === InitModes.HYDRATE) {
            // Claim cặp marker server <!--s:bo:{id}-s--> ... <!--s:bo:{id}-e-->
            // bằng fresh TreeWalker (tránh exhaust walker dùng chung của SaoMarker).
            const claimed = this.claimSSRMarkers();
            if (claimed) {
                this.openTag = claimed.open;
                this.closeTag = claimed.close;
            } else {
                this.openTag = markerRegistry.createMarkerStart('blockoutlet', this.id);
                this.closeTag = markerRegistry.createMarkerEnd('blockoutlet', this.id);
                this.markerKey = markerRegistry.register('blockoutlet', this.id, { name, viewId: ctx.viewId });
            }
        }
        else {
            this.openTag = markerRegistry.createMarkerStart('blockoutlet', this.id);
            this.closeTag = markerRegistry.createMarkerEnd('blockoutlet', this.id);
            this.markerKey = markerRegistry.register('blockoutlet', this.id, { name, viewId: ctx.viewId }); // Register this outlet in the MarkerRegistry
            this.marker = new MarkerModel({
                tagName: "s:bo",
                name: "blockoutlet",
                markerID: this.id,
                openTag: this.openTag,
                closeTag: this.closeTag,
                children: [],
                attributes: {}
            });
        }

    }

    /**
     * Tìm cặp marker outlet từ server-rendered HTML (format chuẩn §5.1):
     *   open:  s:bo:{id}-s   close: s:bo:{id}-e
     * Quét trong parentElement (fallback document.body) bằng fresh TreeWalker.
     */
    private claimSSRMarkers(): { open: Comment; close: Comment } | null {
        const searchRoot = this.parentElement?.element ?? document.body;
        const walker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_COMMENT);

        const openText = markerRegistry.openComment('blockoutlet', this.id);
        const closeText = markerRegistry.closeComment('blockoutlet', this.id);
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

    hydrate(): void {
        // Hydration logic if needed (e.g. reattach event listeners)
    }

    /** Registry guard */
    public __destroyed__: boolean = false;
    /** Key trả về bởi markerRegistry.register — destroy() dùng để gỡ lại */
    private markerKey: string | null = null;

    /** Render — idempotent: markers đã trong DOM thì giữ nguyên (same-layout reuse) */
    render(): void {
        if (this.__destroyed__) return;
        if (this.openTag.parentNode) return; // đã đặt — không đặt lại

        if (!this.parentElement || !this.parentElement.element) return;
        const parentEl = this.parentElement.element;
        parentEl.appendChild(this.openTag);
        parentEl.appendChild(this.closeTag);
    }

    destroy(): void {
        this.__destroyed__ = true;
        this.ctx.releaseElement?.(this);
        if (this.markerKey) {
            markerRegistry.remove(this.markerKey);
            this.markerKey = null;
        }
        // Clear nội dung giữa markers (block content nếu còn)
        let current: Node | null = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next: Node | null = current.nextSibling;
            (current as ChildNode).remove();
            current = next;
        }
        // Remove markers from DOM
        this.openTag.remove();
        this.closeTag.remove();
    }

    start(): void {
        // Placeholder for any setup needed when the outlet becomes active
    }

    stop(): void {
        // Placeholder for any cleanup needed when the outlet becomes inactive
    }

    setParentElement(parentElement: HtmlInterface | null): void {
        this.parent = parentElement;
        this.parentElement = parentElement;
    }

    get isSaoElement(): boolean {
        return true;
    }

    set isSaoElement(value: boolean) {
        // No-op setter to satisfy OneElement interface
    }

    get isOneBlockOutlet(): boolean {
        return true;
    }

    set isOneBlockOutlet(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for BlockOutlet elements
    }
}