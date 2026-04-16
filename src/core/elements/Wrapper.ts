import { InitMode, InitModes } from "../contracts/common";
import type { FragmentInterface, HtmlInterface, OneChildrenFactory, OneChildrenFactoryOutput, OneElementChildren, WrapperInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { generateUUID } from "../hellpers/utils";
import type { OneObjectType } from "../types/utils";

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
    oneType: OneObjectType = 'Wrapper';
    public parent: HtmlInterface | null;
    public nodes: Node[] = [];
    /** Tracked child element wrappers (Html, Output, Reactive, TextElement, etc.) */
    public children: OneElementChildren = [];
    private ctx: ViewControllerInterface;
    private childrenFactory: OneChildrenFactory;
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
        childrenFactory: OneChildrenFactory
    }) {
        this.ctx = ctx;
        this.parent = parentElement;
        this.childrenFactory = childrenFactory;
        this.id = ctx.viewId;
        this.initMode = initMode;

        this.openTag = document.createComment('wrapper-start');
        this.closeTag = document.createComment('wrapper-end');

    }
    setParentElement(parent: HtmlInterface | null): void {
        this.parent = parent;
    }
    render(): void {
        
    }

    setChildrenFactory(factory: OneChildrenFactory): void {
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

    destroy(): void {
        this.clear();
        this.openTag.remove();
        this.closeTag.remove();
        this.parent = null;
    }

    get isOneElement(): boolean {
        return true;
    }
    set isOneElement(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for Fragment elements
    }

    get isOneFragment(): boolean {
        return true;
    }
    set isOneFragment(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for Fragment elements
    }
}
