import { InitMode, InitModes } from "../contracts/common";
import type { HtmlInterface, OneChildrenFactoryOutput, OneElementChildren } from "../contracts/ElementInterface";
import type { ReactiveInterface, ReactiveChildrenFactory, ReactiveRenderFn } from "../contracts/ReactiveInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { generateUUID } from "../hellpers/utils";
import markerRegistry from "../services/MarkerRegistry";
import type { OneObjectType } from "../types/utils";

/**
 * Reactive — a region in the DOM bounded by comment markers that 
 * can re-render its content when reactive dependencies change.
 * 
 * Use cases:
 *   - o-if / o-show conditional rendering
 *   - o-for list rendering  
 *   - @useBlock(name) slot mounting
 *   - Any expression binding that affects DOM structure
 * 
 * The open/close comment markers stay in place; only the content
 * between them is replaced on re-render. This avoids the need to
 * scan/diff the entire DOM tree.
 */
export class Reactive implements ReactiveInterface {
    static class = 'Reactive';
    oneType: OneObjectType = 'Reactive';
    public id: string; // Unique ID for debugging and marker registry
    public type: string; // Custom type for different reactive behaviors (e.g. 'if', 'list')
    public openTag: Comment;
    public closeTag: Comment;
    public parentElement: HtmlInterface | null;
    public parentReactive: ReactiveInterface | null;
    public parent: HtmlInterface | null = null; // Alias for parentReactive to satisfy OneNodeInterface

    public ctx: ViewControllerInterface;
    public childrenFactory: ReactiveChildrenFactory;
    public children: OneElementChildren = [];
    private mounted: boolean = false;
    public stateKeys: string[];
    public unsubscribe: () => void = () => {};
    private _isStarted = false;



    domChildren: Node[] = []; // For compatibility with HtmlInterface; Reactive itself doesn't have a single root element
    initMode: InitMode = InitModes.CREATE;
    constructor({
        type = 'reactive',
        id = null,
        ctx,
        parentElement = null,
        parentReactive = null,
        stateKeys = [],
        childrenFactory = () => [],
        initMode = InitModes.CREATE,
    }: {
        id?: string | null;
        type?: string;
        ctx: ViewControllerInterface;
        parentElement?: HtmlInterface | null;
        parentReactive?: ReactiveInterface | null;
        stateKeys?: string[];
        childrenFactory: ReactiveChildrenFactory;
        initMode?: InitMode;
    }) {
        this.ctx = ctx;
        this.parentElement = parentElement;
        this.parentReactive = parentReactive;
        this.id = `${ctx.viewId}-${id || generateUUID(5)}`;
        this.type = type;
        this.childrenFactory = childrenFactory;
        this.stateKeys = stateKeys;
        this.initMode = initMode;
        markerRegistry.register('reactive', this.id, {
            type: this.type,
            stateKeys: this.stateKeys,
            viewID: this.ctx.viewId,
        });

        this.openTag = markerRegistry.createMarkerStart('reactive', this.id);
        this.closeTag = markerRegistry.createMarkerEnd('reactive', this.id);
    }

    setParentElement(parent: HtmlInterface | null): void {
        this.parentElement = parent;
    }

    setChildrenFactory(factory: ReactiveChildrenFactory): void {
        this.childrenFactory = factory;
    }

    setStateKeys(stateKeys: string[]): void {
        this.stateKeys = stateKeys;
        // If already started, we need to resubscribe with new keys
        if (this._isStarted) {
            this.stop();
            this.start();
        }
    }

    /** Mount markers into parent and render content */
    render(): void {
        const target = this.getInsertionTarget();
        if (!target) return;

        if (!this.mounted) {
            // First render: place markers
            if (this.parentReactive) {
                // Insert before the parent's close marker
                target.insertBefore(this.openTag, this.parentReactive.closeTag);
                target.insertBefore(this.closeTag, this.parentReactive.closeTag);
            } else {
                target.appendChild(this.openTag);
                target.appendChild(this.closeTag);
            }
            this.mounted = true;
        } else {
            // Re-render: clear existing content between markers
            this.clearContent();
        }

        // Produce children
        const output: OneChildrenFactoryOutput = this.childrenFactory(this, this.parentElement);

        // Insert children between markers
        for (const child of output) {
            if (typeof child === 'string' || typeof child === 'number') {
                const textNode = document.createTextNode(String(child));
                this.insertBeforeClose(textNode);
                this.children.push(textNode);
            } else if (child && typeof child === 'object') {
                if ('element' in child) {
                    // HtmlInterface, TextInterface, FragmentInterface
                    this.insertBeforeClose(child.element);
                    this.children.push(child);
                    child.render();
                } else if ('openTag' in child) {
                    // Nested Reactive
                    this.children.push(child);
                    child.render();
                }
            }
        }
    }

    /** Schedule a re-render through the ViewController */
    update(): void {
        this.ctx.scheduleUpdate(this);
    }

    /** Clear all DOM nodes between the open and close markers */
    private clearContent(): void {
        // Destroy managed children first
        for (const child of this.children) {
            if (child && typeof child === 'object' && 'destroy' in child) {
                child.destroy();
            }
        }
        this.children = [];

        // Remove DOM nodes between markers
        let current = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next = current.nextSibling;
            current.remove();
            current = next;
        }
    }

    /** Insert a node just before the close marker */
    private insertBeforeClose(node: Node): void {
        this.closeTag.parentNode?.insertBefore(node, this.closeTag);
    }

    /** Determine the actual DOM element to insert into */
    private getInsertionTarget(): HTMLElement | null {
        if (this.parentElement) {
            return this.parentElement.element;
        }
        return null;
    }

    /** Start — subscribe to stateKeys and recursively start children.
     * Called during START phase of view lifecycle. */
    start(): void {
        if (this._isStarted) return;
        this._isStarted = true;

        // Subscribe to state changes → schedule re-render
        if (this.stateKeys.length > 0) {
            this.unsubscribe = this.ctx.states.__.subscribe(
                this.stateKeys,
                () => this.update()
            );
        }

        // Recursively start children
        for (const child of this.children) {
            if (child && typeof child === 'object' && 'start' in child && typeof (child as any).start === 'function') {
                (child as any).start();
            }
        }
    }

    /** Stop — unsubscribe and recursively stop children. */
    stop(): void {
        if (!this._isStarted) return;
        this._isStarted = false;

        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = () => {};
        }

        // Recursively stop children
        for (const child of this.children) {
            if (child && typeof child === 'object' && 'stop' in child && typeof (child as any).stop === 'function') {
                (child as any).stop();
            }
        }
    }

    /** Remove content but keep markers (for hide/show scenarios) */
    hide(): void {
        this.clearContent();
    }

    /** Re-render content (for show after hide) */
    show(): void {
        this.render();
    }

    destroy(): void {
        this.clearContent();
        this.openTag.remove();
        this.closeTag.remove();
        this.mounted = false;
        this.parentElement = null;
        this.parentReactive = null;
    }

    get isOneReactive(): boolean {
        return true;
    }
    set isOneReactive(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for Reactive elements
    }
    set isOneElement(value: boolean) {
        // No-op setter to satisfy the Interface; Reactive is a type of OneElement
    }
    get isOneElement(): boolean {
        return true;
    }
}