import type { BlockOutletInterface } from "../contracts/BlockInterface";
import { InitMode } from "../contracts/common";
import type { HtmlInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { generateUUID } from "../helpers/utils";
import markerRegistry  from "../services/MarkerRegistry";
import type { OneObjectType } from "../types/utils";

export class BlockOutlet implements BlockOutletInterface {
    oneType: OneObjectType = 'BlockOutlet';
    id: string;
    name: string;
    openTag: Comment;
    closeTag: Comment;
    parent: HtmlInterface | null = null;
    parentElement: HtmlInterface | null = null;
    ctx: ViewControllerInterface;
    initMode: InitMode = 'create';
    constructor({ ctx, parentElement = null, name, id = null, initMode = 'create' }: { ctx: ViewControllerInterface, parentElement?: HtmlInterface | null, name: string, id?: string | null, initMode?: InitMode }) {
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

    get isOneElement(): boolean {
        return true;
    }

    set isOneElement(value: boolean) {
        // No-op setter to satisfy OneElement interface
    }

    get isOneBlockOutlet(): boolean {
        return true;
    }

    set isOneBlockOutlet(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for BlockOutlet elements
    }
}