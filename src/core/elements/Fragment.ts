import { InitMode, InitModes } from "../contracts/common";
import type { FragmentInterface, HtmlInterface, SaoChildrenFactory, SaoChildrenFactoryOutput, SaoElementChildren } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { generateUUID } from "../helpers/utils";
import type { SaoObjectType } from "../types/utils";

/**
 * Fragment — renders multiple root nodes into a parent without a wrapping tag.
 * 
 * Use case: when a ViewController's render() returns multiple sibling elements
 * (e.g. `<h1>` + `<p>` + `<div>`) without a single root wrapper.
 * 
 * Fragment uses open/close Comment markers to track its region in the DOM,
 * similar to Reactive but without the reactivity overhead.
 */
export class Fragment implements FragmentInterface {
    saoType: SaoObjectType = 'Fragment';
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

    domChildren: Node[] = []; // For compatibility with HtmlInterface; Fragment itself doesn't have a single root element

    constructor({
        ctx, 
        id = null, 
        initMode = InitModes.CREATE, 
        parentElement = null, 
        childrenFactory
    }: {
        ctx: ViewControllerInterface, 
        id?: string | null, 
        initMode?: InitMode, 
        parentElement?: HtmlInterface | null, 
        childrenFactory: SaoChildrenFactory
    }) {
        this.ctx = ctx;
        this.parent = parentElement;
        this.childrenFactory = childrenFactory;
        this.openTag = document.createComment('fragment-start');
        this.closeTag = document.createComment('fragment-end');
        this.id = `${ctx.viewId}-${id ?? generateUUID(10)}`; // Unique ID for debugging
        this.initMode = initMode;
    }
    setParentElement(parent: HtmlInterface | null): void {
        this.parent = parent;
    }
    /** Registry guard — element đã destroy không được reuse */
    public __destroyed__: boolean = false;

    /**
     * Render — idempotent + position-aware (RUNTIME_CONTRACT.md §2),
     * cùng pattern với Reactive.render().
     */
    render(): void {
        if (this.__destroyed__) return;

        if (!this.openTag.parentNode) {
            if (!this.parent || !this.parent.element) return;
            const parentEl = this.parent.element;
            parentEl.appendChild(this.openTag);
            parentEl.appendChild(this.closeTag);
        } else {
            this.clear(false);
        }

        // Build children — compiled output uses (parentElement) => [...] signature
        const output: SaoChildrenFactoryOutput = this.childrenFactory(this.parent);
        const insertBeforeClose = (node: Node) => {
            this.closeTag.parentNode?.insertBefore(node, this.closeTag);
        };

        for (const child of output) {
            if (child === null || child === undefined) continue;
            if (typeof child === 'string' || typeof child === 'number') {
                const textNode = document.createTextNode(String(child));
                insertBeforeClose(textNode);
                this.nodes.push(textNode);
            } else if (child instanceof Node) {
                insertBeforeClose(child);
                this.nodes.push(child);
            } else if (typeof child === 'object') {
                if ('element' in child && (child as any).element) {
                    insertBeforeClose((child as any).element);
                    this.nodes.push((child as any).element);
                    this.children.push(child);
                    child.render();
                } else if ('openTag' in child) {
                    // Marker-based: đặt markers đúng vị trí trước, render sau
                    if ('parent' in child) {
                        (child as any).parent = this.parent;
                    }
                    if ('parentElement' in child) {
                        (child as any).parentElement = this.parent;
                    }
                    insertBeforeClose((child as any).openTag);
                    insertBeforeClose((child as any).closeTag);
                    this.children.push(child);
                    child.render();
                }
            }
        }
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
    clear(_destroyChildren: boolean = true): void {
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
