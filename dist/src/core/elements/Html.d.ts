import { InitMode } from "../contracts/common";
import type { HtmlInterface, SaoChildrenFactory, SaoElementConfig } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { ViewManagerInterface } from "../contracts/ViewManagerInterface";
import type { SaoObjectType } from "../types/utils";
export declare class Html implements HtmlInterface {
    saoType: SaoObjectType;
    element: HTMLElement;
    parent: HtmlInterface | null;
    private tagName;
    private config;
    private ctx;
    private children;
    domChildren: Node[];
    private childrenFactory;
    private abortController;
    /** All state subscriptions for reactive bindings — cleanup on destroy */
    private bindingUnsubscribes;
    initMode: InitMode;
    constructor({ ctx, id, parentElement, tagName, element, config, childrenFactory, initMode, }: {
        ctx: ViewControllerInterface | ViewManagerInterface;
        id?: string | null;
        parentElement?: HtmlInterface | null;
        tagName?: string;
        element?: HTMLElement | null;
        config?: SaoElementConfig;
        childrenFactory?: SaoChildrenFactory | null;
        initMode?: InitMode;
    });
    updateConfig(newConfig: Partial<SaoElementConfig>): void;
    private initialize;
    private initializeAttributes;
    private initializeClasses;
    private initializeStyles;
    private initializeEvents;
    setParentElement(parent: HtmlInterface | null): void;
    setParent(parent: HtmlInterface | null): void;
    setChildrenFactory(factory: SaoChildrenFactory): void;
    isSingleElement(): boolean;
    render(): HTMLElement;
    /** Start reactive bindings + children (Phase 2 lifecycle) */
    start(): void;
    /** Stop reactive bindings + children */
    stop(): void;
    remove(): void;
    destroy(): void;
    get isSaoElement(): boolean;
    set isSaoElement(value: boolean);
    get isOneHtml(): boolean;
    set isOneHtml(value: boolean);
}
//# sourceMappingURL=Html.d.ts.map