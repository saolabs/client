import type { BlockOutletInterface } from "../contracts/BlockInterface";
import { InitMode, InitModes } from "../contracts/common";
import type { HtmlInterface } from "../contracts/ElementInterface";
import { MarkerModelInterface } from "../contracts/MarkerInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { generateUUID } from "../helpers/utils";
import { MarkerModel } from "../services/MarkerModel";
import markerRegistry from "../services/MarkerRegistry";
import { SaoMarker } from "../services/MarkerService";
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
            let marker = SaoMarker.first('blockoutlet', this.id);
            if (marker) {
                this.marker = marker;
                this.openTag = marker.openTag as Comment;
                this.closeTag = marker.closeTag as Comment;
            } else {
                this.openTag = markerRegistry.createMarkerStart('blockoutlet', this.id);
                this.closeTag = markerRegistry.createMarkerEnd('blockoutlet', this.id);
                markerRegistry.register('blockoutlet', this.id, { name, viewId: ctx.viewId }); // Register this outlet in the MarkerRegistry
                this.marker = new MarkerModel({
                    tagName: "s:bo",
                    name: "blockoutlet",
                    markerID: this.id,
                    openTag: this.openTag,
                    closeTag: this.closeTag,
                    children: [],
                    attributes: {}
                })
            }
        }
        else {
            this.openTag = markerRegistry.createMarkerStart('blockoutlet', this.id);
            this.closeTag = markerRegistry.createMarkerEnd('blockoutlet', this.id);
            markerRegistry.register('blockoutlet', this.id, { name, viewId: ctx.viewId }); // Register this outlet in the MarkerRegistry
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

    hydrate(): void {
        // Hydration logic if needed (e.g. reattach event listeners)
    }

    render(): void {
        if (!this.parentElement || !this.parentElement.element) return;

        const parentEl = this.parentElement.element;

        // Place markers
        parentEl.appendChild(this.openTag);
        // Register this outlet in the MarkerRegistry for block mounting
        parentEl.appendChild(this.closeTag);

    }

    destroy(): void {
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