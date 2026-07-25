import { InitMode } from "../contracts/common";
import type { HtmlInterface, SaoChildrenFactory, SaoElementChildren, WrapperInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { SaoObjectType } from "../types/utils";
/**
 * Wrapper — renders multiple root nodes into a parent without a wrapping tag.
 *
 * Use case: when a ViewController's render() returns multiple sibling elements
 * (e.g. `<h1>` + `<p>` + `<div>`) without a single root wrapper.
 *
 * Wrapper uses open/close Comment markers to track its region in the DOM,
 * similar to Reactive but without the reactivity overhead.
 */
export declare class Wrapper implements WrapperInterface {
    saoType: SaoObjectType;
    parent: HtmlInterface | null;
    nodes: Node[];
    /** Tracked child element wrappers (Html, Output, Reactive, TextElement, etc.) */
    children: SaoElementChildren;
    private ctx;
    private childrenFactory;
    openTag: Comment;
    closeTag: Comment;
    id: string;
    initMode: InitMode;
    domChildren: Node[];
    constructor({ ctx, initMode, parentElement, childrenFactory }: {
        ctx: ViewControllerInterface;
        initMode?: InitMode;
        parentElement?: HtmlInterface | null;
        childrenFactory: SaoChildrenFactory;
    });
    /**
     * Tìm cặp view markers từ server-rendered HTML.
     * Format MarkerRegistry: open = `v:id`, close = `/v:id`.
     * Quét comment nodes trong parent element (fallback document.body).
     */
    private claimSSRMarkers;
    init(): void;
    setParentElement(parent: HtmlInterface | null): void;
    render(): SaoElementChildren;
    appendTo(parent: HtmlInterface): void;
    mountTo(parent: HtmlInterface): void;
    setChildrenFactory(factory: SaoChildrenFactory): void;
    /** Hydrate lifecycle — reattach event listeners or perform other setup */
    hydrate(): void;
    /** Start lifecycle — recursively activate children's reactive subscriptions */
    start(): void;
    /** Stop lifecycle — recursively deactivate children's reactive subscriptions */
    stop(): void;
    /** Remove all nodes between markers from the DOM */
    clear(): void;
    /** Registry guard — wrapper đã destroy không được reuse (ViewController.wrapper) */
    __destroyed__: boolean;
    destroy(): void;
    get isSaoElement(): boolean;
    set isSaoElement(value: boolean);
    get isSaoFragment(): boolean;
    set isSaoFragment(value: boolean);
}
//# sourceMappingURL=Wrapper.d.ts.map