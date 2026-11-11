import { InitMode } from "../contracts/common.js";
import type { HtmlInterface, SaoChildrenFactory, SaoElementChildren, SaoElementConfig } from "../contracts/ElementInterface.js";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface.js";
import type { ViewManagerInterface } from "../contracts/ViewManagerInterface.js";
import type { SaoObjectType } from "../types/utils.js";
export declare class Html implements HtmlInterface {
    /**
     * CHỈ cho kiểm thử: bật thì element tạo ở client cũng mang class hydrate
     * `{viewId}-{id}` như DOM của server. Cổng parity SSR↔CSR dựa vào class
     * đó để biết element nào do compiler sinh; production để tắt (mỗi element
     * một tên class duy nhất là ~1/3 thời gian tạo một danh sách dài).
     * Bật trước khi app khởi động: `window.__SAOLA_CSR_HYDRATE_CLASS__ = true`.
     */
    static csrHydrateClass: boolean;
    saoType: SaoObjectType;
    element: HTMLElement;
    parent: HtmlInterface | null;
    private tagName;
    private config;
    private ctx;
    private children;
    domChildren: Node[];
    private childrenFactory;
    /**
     * Chỉ `@bind` cần signal. Tạo sẵn cho MỌI element (và tạo lại ở mỗi
     * updateConfig) từng chiếm ~30% thời gian một lượt cập nhật danh sách.
     */
    private abortController;
    /** Config NGUYÊN BẢN compiler truyền vào — so identity để bỏ qua cập nhật thừa. */
    private sourceConfig;
    private isVoidTag;
    /** Khác null = element vừa tạo ở client, class tĩnh chờ ghi một lần. */
    private pendingClass;
    private isOptionTag;
    private isTextareaTag;
    /** All state subscriptions for reactive bindings — cleanup on destroy */
    private bindingUnsubscribes;
    /** Invalidates deferred/stale binding callbacks after a config reconciliation. */
    private bindingGeneration;
    private contentUnsubscribe;
    /**
     * Tên class do binding `dynamic` gắn lúc chạy — thứ duy nhất không suy ra
     * được từ config. Attr/class/style/prop còn lại đọc thẳng từ config khi
     * updateConfig cần gỡ phần thừa, nên element vừa tạo không tốn Set nào.
     */
    private dynamicClassNames;
    /** Events actually registered through ViewController, independent of current config. */
    private registeredEventNames;
    initMode: InitMode;
    private adoptedSSR;
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
    /** Gỡ khỏi DOM những gì config CŨ quản lý mà config mới không còn nhắc tới. */
    private removeStaleDomState;
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
    private addClass;
    private removeClass;
    private toggleClass;
    private applyStyle;
    private initializeStyles;
    private initializeEvents;
    addEventListeners(): void;
    /** Gỡ listener; truyền `keep` thì giữ lại các event còn trong config mới. */
    removeEventListeners(keep?: Record<string, unknown> | null): void;
    setParentElement(parent: HtmlInterface | null): void;
    setParent(parent: HtmlInterface | null): void;
    setChildrenFactory(factory: SaoChildrenFactory): void;
    isSingleElement(): boolean;
    getElement(): HTMLElement;
    renderChildren(): SaoElementChildren;
    private contentRendered;
    private bindingInitialized;
    private composing;
    private isStarted;
    render(): HTMLElement;
    private applyOptionSelection;
    private renderTextContent;
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
    /**
     * Nhả id của element này và toàn bộ cây con khỏi `ctx.elements`, KHÔNG
     * destroy. Dùng khi leave transition giữ DOM lại: registry phải sạch ngay
     * để pass sau tạo element mới thay vì tái dùng xác sắp chết.
     */
    private releaseSubtreeFromRegistry;
    /** Destroy children + dọn nội dung. Tách riêng để leave hoãn được. */
    private teardownSubtree;
    get isSaoElement(): boolean;
    set isSaoElement(value: boolean);
    get isOneHtml(): boolean;
    set isOneHtml(value: boolean);
}
//# sourceMappingURL=Html.d.ts.map