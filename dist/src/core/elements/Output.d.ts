import { InitMode } from "../contracts/common";
import type { HtmlInterface, OutputInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { OneObjectType } from "../types/utils";
/**
 * Output — reactive text output between comment markers.
 *
 * Compiled từ: {{ $expression }}   → output({ctx, parentElement, stateKeys, isEscapeHTML: true}, () => expression)
 * Compiled từ: {!! $expression !!} → output({ctx, parentElement, stateKeys, isEscapeHTML: false}, () => expression)
 *
 * Render: Tạo Text node giữa <!--o:id-s--> và <!--o:id-e-->
 * Update: Khi stateKeys thay đổi → re-evaluate contentFactory → update textContent
 */
export declare class Output implements OutputInterface {
    oneType: OneObjectType;
    ctx: ViewControllerInterface;
    parent: HtmlInterface | null;
    openTag: Comment;
    closeTag: Comment;
    stateKeys: string[];
    contentFactory: () => string;
    isEscapeHTML: boolean;
    domChildren: Node[];
    private textNode;
    private unsubscribe;
    private _isStarted;
    private _isDestroyed;
    private id;
    initMode: InitMode;
    constructor({ ctx, id, parent, stateKeys, contentFactory, isEscapeHTML, initMode }: {
        ctx: ViewControllerInterface;
        id?: string | null;
        parent?: HtmlInterface | null;
        stateKeys?: string[];
        contentFactory?: () => string;
        isEscapeHTML?: boolean;
        initMode?: InitMode;
    });
    setParentElement(parent: HtmlInterface | null): void;
    setContentFactory(factory: () => string): void;
    setStateKeys(stateKeys: string[]): void;
    /**
     * Render — insert markers + initial text into parent element.
     */
    render(): void;
    /**
     * Start — subscribe to state changes for reactive updates.
     * Called during START phase of view lifecycle.
     */
    start(): void;
    /**
     * Stop — unsubscribe from state changes.
     */
    stop(): void;
    /**
     * Update — re-evaluate contentFactory and update text node in-place.
     * O(1) — chỉ thay textContent, không tạo/xóa DOM nodes.
     */
    private update;
    /**
     * Destroy — cleanup everything.
     */
    destroy(): void;
    get isOneElement(): boolean;
    set isOneElement(_: boolean);
    get isOneOutput(): boolean;
    set isOneOutput(_: boolean);
}
//# sourceMappingURL=Output.d.ts.map