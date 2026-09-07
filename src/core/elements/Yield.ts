import { InitMode, InitModes } from "../contracts/common.js";
import { HtmlInterface, YieldInterface } from "../contracts/ElementInterface.js";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface.js";
import { generateUUID } from "../helpers/utils.js";
import markerRegistry from "../services/MarkerRegistry.js";
import { SaoObjectType } from "../types/utils.js";

export class YieldElement implements YieldInterface{
    saoType: SaoObjectType = "Yield";
    ctx: ViewControllerInterface;
    name: string
    id: string;
    openTag!: Comment;
    closeTag!: Comment;
    initMode: InitMode = InitModes.CREATE
    domChildren: Node[] = [];
    parent: HtmlInterface | null = null;
    defaultValue: string = '';
    /** Registry guard — thiếu field này thì aliveFromRegistry tái dùng Yield đã destroy */
    public __destroyed__: boolean = false;
    constructor({ctx, name = '', initMode = InitModes.CREATE, id = null, defaultValue = ''} : {ctx: ViewControllerInterface, name: string, initMode?: InitMode, id?: string | null, defaultValue?: string}) {
        this.ctx = ctx;
        this.name = name;
        this.initMode = initMode;
        // Marker id đầy đủ = {viewId}-{hash} — khớp quy ước server (HYDRATION.md §5.1),
        // giống Component.ts. Trước đây thiếu prefix viewId → hydrate không tìm đúng marker.
        const rawId = id && id.length > 0 ? id : generateUUID();
        this.id = `${ctx.viewId}-${rawId}`;
        this.defaultValue = defaultValue;

        // Claim marker server qua index O(1) của MarkerRegistry — giống Reactive/
        // Output/Component. Trước dùng SaoMarker.first(), tức duyệt TOÀN BỘ comment
        // của tài liệu cho mỗi @yield.
        const claimed = (this.initMode === InitModes.HYDRATE)
            ? markerRegistry.claim('yield', this.id)
            : null;

        if (claimed) {
            this.openTag = claimed.open;
            this.closeTag = claimed.close;
            for (let node = claimed.open.nextSibling; node && node !== claimed.close; node = node.nextSibling) {
                this.domChildren.push(node);
            }
        } else {
            this.createMarkers();
        }
        
    }
    private createMarkers(){
        markerRegistry.register('yield', this.id, {name: this.name});
        this.openTag = markerRegistry.createMarkerStart('yield', this.id);
        this.closeTag = markerRegistry.createMarkerEnd('yield', this.id);
    }

    setParentElement(parent: HtmlInterface | null): void {
        this.parent = parent;
    }

    /** Idempotent: markers already in DOM (hydrate claim, or same-layout reuse) → keep as-is. */
    render(): void {
        if (this.openTag.parentNode) return;
        if (!this.parent?.element) return;

        const parentEl = this.parent.element;
        parentEl.appendChild(this.openTag);
        parentEl.appendChild(this.closeTag);
    }

    destroy(): void {
        this.__destroyed__ = true;
        this.ctx.releaseElement?.(this);
        this.openTag?.remove();
        this.closeTag?.remove();
        this.domChildren = [];
        this.parent = null;
    }

    get isSaoElement(): boolean { return true; }
    set isSaoElement(_: boolean) {}
    get isOneYield(): boolean { return true; }
    set isOneYield(_: boolean) {}
}