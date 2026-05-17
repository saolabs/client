import { InitMode } from "../contracts/common";
import type { HtmlInterface, SaoElementChildren } from "../contracts/ElementInterface";
import type { ReactiveInterface, ReactiveChildrenFactory } from "../contracts/ReactiveInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { SaoObjectType } from "../types/utils";
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
export declare class Reactive implements ReactiveInterface {
    static class: string;
    saoType: SaoObjectType;
    id: string;
    type: string;
    openTag: Comment;
    closeTag: Comment;
    parentElement: HtmlInterface | null;
    parentReactive: ReactiveInterface | null;
    parent: HtmlInterface | null;
    ctx: ViewControllerInterface;
    childrenFactory: ReactiveChildrenFactory;
    children: SaoElementChildren;
    private mounted;
    stateKeys: string[];
    unsubscribe: () => void;
    private _isStarted;
    domChildren: Node[];
    initMode: InitMode;
    constructor({ type, id, ctx, parentElement, parentReactive, stateKeys, childrenFactory, initMode, }: {
        id?: string | null;
        type?: string;
        ctx: ViewControllerInterface;
        parentElement?: HtmlInterface | null;
        parentReactive?: ReactiveInterface | null;
        stateKeys?: string[];
        childrenFactory: ReactiveChildrenFactory;
        initMode?: InitMode;
    });
    setParentElement(parent: HtmlInterface | null): void;
    setChildrenFactory(factory: ReactiveChildrenFactory): void;
    setStateKeys(stateKeys: string[]): void;
    /** Mount markers into parent and render content */
    render(): void;
    /** Schedule a re-render through the ViewController */
    update(): void;
    /** Clear all DOM nodes between the open and close markers */
    private clearContent;
    /** Insert a node just before the close marker */
    private insertBeforeClose;
    /** Determine the actual DOM element to insert into */
    private getInsertionTarget;
    /** Start — subscribe to stateKeys and recursively start children.
     * Called during START phase of view lifecycle. */
    start(): void;
    /** Stop — unsubscribe and recursively stop children. */
    stop(): void;
    /** Remove content but keep markers (for hide/show scenarios) */
    hide(): void;
    /** Re-render content (for show after hide) */
    show(): void;
    destroy(): void;
    get isOneReactive(): boolean;
    set isOneReactive(value: boolean);
    set isSaoElement(value: boolean);
    get isSaoElement(): boolean;
}
//# sourceMappingURL=Reactive.d.ts.map