import { InitMode, InitModes } from "../contracts/common";
import type { DOMElement, FragmentInterface, HtmlInterface, SaoChildrenFactory, SaoChildrenFactoryOutput, SaoElement, SaoElementChildren, WrapperInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { app } from "../helpers/app";
import { generateUUID } from "../helpers/utils";
import { mountElementList } from "../helpers/view";
import { MarkerRegistryService } from "../services";
import type { SaoObjectType } from "../types/utils";
import { Html } from "./Html";
import { TextElement } from "./TextElement";

/**
 * Wrapper — renders multiple root nodes into a parent without a wrapping tag.
 * 
 * Use case: when a ViewController's render() returns multiple sibling elements
 * (e.g. `<h1>` + `<p>` + `<div>`) without a single root wrapper.
 * 
 * Wrapper uses open/close Comment markers to track its region in the DOM,
 * similar to Reactive but without the reactivity overhead.
 */
export class Wrapper implements WrapperInterface {
    saoType: SaoObjectType = 'Wrapper';
    public parent: HtmlInterface | null;
    public nodes: Node[] = [];
    /** Tracked child element wrappers (Html, Output, Reactive, TextElement, etc.) */
    public children: SaoElementChildren = [];
    private ctx: ViewControllerInterface;
    private childrenFactory: SaoChildrenFactory;
    public openTag: Comment;
    public closeTag: Comment;
    public id: string; // Unique ID for debugging and marker registry
    public initMode: InitMode = InitModes.CREATE;

    domChildren: Node[] = []; // For compatibility with HtmlInterface; Wrapper itself doesn't have a single root element

    constructor({
        ctx,
        initMode = InitModes.CREATE,
        parentElement = null,
        childrenFactory
    }: {
        ctx: ViewControllerInterface,
        initMode?: InitMode,
        parentElement?: HtmlInterface | null,
        childrenFactory: SaoChildrenFactory
    }) {
        this.ctx = ctx;
        this.parent = parentElement;
        this.childrenFactory = childrenFactory;
        this.id = ctx.viewId;
        this.initMode = initMode;

        this.init();
        const registry = app<MarkerRegistryService>("Registry");
        if (this.initMode === InitModes.HYDRATE) {
            // ── Hydrate: tìm view markers SSR trong DOM ─────────────────
            // Format MarkerRegistry: open = `v:id`, close = `/v:id`
            // (v = shortcut cho 'view'). Nếu không có (vd partial hydration
            // khi root element CHÍNH là boundary của view) → tạo markers mới,
            // không cảnh báo vì đây là trường hợp hợp lệ.
            const claimed = this.claimSSRMarkers(registry);
            if (claimed) {
                this.openTag = claimed.open;
                this.closeTag = claimed.close;
            } else {
                this.openTag = registry.createMarkerStart('view', this.id);
                this.closeTag = registry.createMarkerEnd('view', this.id);
            }
        }
        else {
            this.openTag = registry.createMarkerStart('view', this.id);
            this.closeTag = registry.createMarkerEnd('view', this.id);
        }

    }

    /**
     * Tìm cặp view markers từ server-rendered HTML.
     * Format MarkerRegistry: open = `v:id`, close = `/v:id`.
     * Quét comment nodes trong parent element (fallback document.body).
     */
    private claimSSRMarkers(
        registry: MarkerRegistryService
    ): { open: Comment; close: Comment } | null {
        const searchRoot = this.parent?.element ?? document.body;
        const walker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_COMMENT);

        const openText = registry.openComment('view', this.id);
        const closeText = registry.closeComment('view', this.id);
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

    init() {

    }


    setParentElement(parent: HtmlInterface | null): void {
        this.parent = parent;
    }
    render(): SaoElementChildren {
        this.children = [];
        const children = this.childrenFactory(this.parent);
        this.children = children
            .filter((child): child is NonNullable<typeof child> => child !== null && child !== undefined)
            .map((child) => {
                if (typeof child === 'string' || typeof child === 'number') {
                    return new TextElement({ ctx: this.ctx, parent: this.parent, stateKeys: [], generateText: () => String(child) });
                }
                return child;
            });
        return this.children;
    }
    appendTo(parent: HtmlInterface): void {
        this.parent = parent;
        this.parent.appendElement(this.openTag);
        mountElementList(this.parent, this.render());
        this.parent.appendElement(this.closeTag);
    }

    mountTo(parent: HtmlInterface): void {
        parent.clearHTML();
        this.appendTo(parent);
    }

    setChildrenFactory(factory: SaoChildrenFactory): void {
        this.childrenFactory = factory;
    }

    /** Hydrate lifecycle — reattach event listeners or perform other setup */

    hydrate(): void {
        for (const child of this.children) {
            if ('hydrate' in child && typeof (child as any).hydrate === 'function') {
                (child as any).hydrate();
            }
        }
    }

    /** Start lifecycle — recursively activate children's reactive subscriptions */
    start(): void {
        for (const child of this.children) {
            if ('start' in child && typeof (child as any).start === 'function') {
                (child as any).start();
            }
        }
    }

    /** Stop lifecycle — recursively deactivate children's reactive subscriptions */
    stop(): void {
        for (const child of this.children) {
            if ('stop' in child && typeof (child as any).stop === 'function') {
                (child as any).stop();
            }
        }
    }

    /** Remove all nodes between markers from the DOM */
    clear(): void {
        // Destroy managed children first
        for (const child of this.children) {
            if ('destroy' in child && typeof child.destroy === 'function') {
                child.destroy();
            }
        }
        this.children = [];

        // Remove remaining DOM nodes between markers
        let current = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next = current.nextSibling;
            current.remove();
            current = next;
        }
        this.nodes = [];
    }

    /** Registry guard — wrapper đã destroy không được reuse (ViewController.wrapper) */
    public __destroyed__: boolean = false;

    destroy(): void {
        this.__destroyed__ = true;
        this.clear();
        this.openTag.remove();
        this.closeTag.remove();
        this.parent = null;
    }

    get isSaoElement(): boolean {
        return true;
    }
    set isSaoElement(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for Fragment elements
    }

    get isSaoFragment(): boolean {
        return true;
    }
    set isSaoFragment(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for Fragment elements
    }
}
