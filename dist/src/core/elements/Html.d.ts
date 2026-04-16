import { InitMode } from "../contracts/common";
import type { HtmlInterface, OneChildrenFactory, OneElementConfig } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { ViewManagerInterface } from "../contracts/ViewManagerInterface";
import type { OneObjectType } from "../types/utils";
export declare class Html implements HtmlInterface {
    oneType: OneObjectType;
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
        config?: OneElementConfig;
        childrenFactory?: OneChildrenFactory | null;
        initMode?: InitMode;
    });
    updateConfig(newConfig: Partial<OneElementConfig>): void;
    private initialize;
    private initializeAttributes;
    private initializeClasses;
    private initializeStyles;
    private initializeEvents;
    setParentElement(parent: HtmlInterface | null): void;
    setParent(parent: HtmlInterface | null): void;
    setChildrenFactory(factory: OneChildrenFactory): void;
    isSingleElement(): boolean;
    render(): HTMLElement;
    /** Start reactive bindings + children (Phase 2 lifecycle) */
    start(): void;
    /** Stop reactive bindings + children */
    stop(): void;
    remove(): void;
    destroy(): void;
    get isOneElement(): boolean;
    set isOneElement(value: boolean);
    get isOneHtml(): boolean;
    set isOneHtml(value: boolean);
}
//# sourceMappingURL=Html.d.ts.map