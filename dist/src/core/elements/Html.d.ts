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
     *   attrs: { "bind": { type: 'static', value: true }, "<stateKey>": { type: 'static', value: true } }
     *
     *   - "bind": true          → bật two-way binding
     *   - "<stateKey>": true    → tên state key cần bind (e.g. "newTodo")
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
    get isSaoElement(): boolean;
    set isSaoElement(value: boolean);
    get isOneHtml(): boolean;
    set isOneHtml(value: boolean);
}
//# sourceMappingURL=Html.d.ts.map