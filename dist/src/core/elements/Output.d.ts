import { InitMode } from "../contracts/common";
import type { HtmlInterface, OutputInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { SaoObjectType } from "../types/utils";
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
    saoType: SaoObjectType;
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
    /**
     * Tìm cặp comment markers và text node từ server-rendered HTML.
     *
     * Duyệt comment nodes trong parent element, tìm cặp khớp format chuẩn §5.1:
     *   open:  `s:o:{this.id}-s`
     *   close: `s:o:{this.id}-e`
     *
     * Nếu có text node giữa 2 markers → claim luôn để không tạo thừa.
     */
    private claimSSRMarkers;
    setParentElement(parent: HtmlInterface | null): void;
    setContentFactory(factory: () => string): void;
    setStateKeys(stateKeys: string[]): void;
    /** Nodes của raw HTML mode ({!! !!}) — track để clear khi update */
    private rawNodes;
    /**
     * Render — idempotent + position-aware (RUNTIME_CONTRACT.md §2):
     *   - Markers chưa nằm trong DOM → caller chưa đặt → tự append vào parent
     *     (đường mountElementList: thứ tự duyệt tuần tự nên vị trí đúng).
     *   - Markers ĐÃ nằm trong DOM (caller như Reactive đã chèn đúng chỗ)
     *     → chỉ render nội dung GIỮA markers. FIX(baseline#6).
     */
    render(): void;
    /** Xoá toàn bộ nodes giữa open/close markers */
    private clearContent;
    private insertBeforeClose;
    /** Parse HTML string → DOM nodes thật, chèn giữa markers */
    private renderRaw;
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
     * Update — re-evaluate contentFactory.
     * Escaped mode: O(1) — chỉ thay textContent.
     * Raw mode: clear giữa markers → parse + chèn lại.
     */
    private update;
    /**
     * Destroy — cleanup everything.
     */
    /** Registry guard — alias của _isDestroyed cho ViewController.aliveFromRegistry */
    get __destroyed__(): boolean;
    destroy(): void;
    get isSaoElement(): boolean;
    set isSaoElement(_: boolean);
    get isOneOutput(): boolean;
    set isOneOutput(_: boolean);
}
//# sourceMappingURL=Output.d.ts.map