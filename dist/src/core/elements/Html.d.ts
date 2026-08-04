import { InitMode } from "../contracts/common";
import type { HtmlInterface, SaoChildrenFactory, SaoElementChildren, SaoElementConfig } from "../contracts/ElementInterface";
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
    /** Invalidates deferred/stale binding callbacks after a config reconciliation. */
    private bindingGeneration;
    /** DOM state owned by this Html config, used for exact cleanup before reuse. */
    private managedAttributeNames;
    private managedClassNames;
    private managedStyleNames;
    private managedPropertyNames;
    /** Events actually registered through ViewController, independent of current config. */
    private registeredEventNames;
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
    private isBindingCurrent;
    private cleanupBindingResources;
    private clearManagedDomState;
    /**
     * Chuẩn hóa tên attr từ camelCase → kebab-case cho data-* và aria-* attrs.
     *
     * Compiler emit camelCase: "dataCount" → client phải set "data-count" trên DOM.
     * Tham chiếu: COMPILER_CONTRACT.md §3 — camelCase attrs.
     *
     * @example normalizeAttrName('dataCount') === 'data-count'
     * @example normalizeAttrName('ariaLabel') === 'aria-label'
     * @example normalizeAttrName('id') === 'id'  (không đổi)
     */
    private normalizeAttrName;
    /**
     * Thiết lập two-way data binding (v-model-like) theo compiler pattern:
     *
     *   config.bind = { key: "<stateKey>" }  — own bucket, sibling of attrs/props/events.
     *
     * Hành vi:
     *   1. Khởi tạo: set element.value = state hiện tại
     *   2. input event → update state
     *   3. state change → update element.value
     *
     * Tham chiếu: COMPILER_CONTRACT.md §5 — @bind directive.
     */
    private setupTwoWayBinding;
    private initializeAttributes;
    /**
     * Apply một attr vào element, bao gồm:
     *   - Chuẩn hóa tên (camelCase → kebab-case cho data-* / aria-*)
     *   - Xử lý reactive binding
     */
    private _applyAttr;
    private initializeClasses;
    private initializeStyles;
    private initializeEvents;
    addEventListeners(): void;
    removeEventListeners(): void;
    setParentElement(parent: HtmlInterface | null): void;
    setParent(parent: HtmlInterface | null): void;
    setChildrenFactory(factory: SaoChildrenFactory): void;
    isSingleElement(): boolean;
    getElement(): HTMLElement;
    renderChildren(): SaoElementChildren;
    render(): HTMLElement;
    /** Đã chạy enter rồi — re-render không được chạy lại. */
    private _entered;
    /**
     * Enter chạy MỘT lần, khi element vừa được tạo và đã nằm trong DOM.
     * Bỏ qua ở HYDRATE: DOM đó do server render, animate lại là nháy vô cớ
     * (tương đương `appear = false` mặc định của Vue).
     */
    private maybeRunEnter;
    appendElement(element: HTMLElement | Comment | Text): void;
    /** Start reactive bindings + children (Phase 2 lifecycle) */
    start(): void;
    /** Stop reactive bindings + children */
    stop(): void;
    clearHTML(): void;
    remove(): void;
    /** Registry guard — element đã destroy không được reuse (xem RUNTIME_CONTRACT.md §2) */
    __destroyed__: boolean;
    destroy(): void;
    /** Destroy children + dọn nội dung. Tách riêng để leave hoãn được. */
    private teardownSubtree;
    get isSaoElement(): boolean;
    set isSaoElement(value: boolean);
    get isOneHtml(): boolean;
    set isOneHtml(value: boolean);
}
//# sourceMappingURL=Html.d.ts.map