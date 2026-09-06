import type { BlockOutletInterface } from "../contracts/BlockInterface.js";
import { InitMode } from "../contracts/common.js";
import type { HtmlInterface } from "../contracts/ElementInterface.js";
import { MarkerModelInterface } from "../contracts/MarkerInterface.js";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface.js";
import type { SaoObjectType } from "../types/utils.js";
export declare class BlockOutlet implements BlockOutletInterface {
    saoType: SaoObjectType;
    id: string;
    name: string;
    openTag: Comment;
    closeTag: Comment;
    parent: HtmlInterface | null;
    parentElement: HtmlInterface | null;
    ctx: ViewControllerInterface;
    initMode: InitMode;
    marker: MarkerModelInterface | null;
    constructor({ ctx, parentElement, name, id, initMode }: {
        ctx: ViewControllerInterface;
        parentElement?: HtmlInterface | null;
        name: string;
        id?: string | null;
        initMode?: InitMode;
    });
    /**
     * Tìm cặp marker outlet từ server-rendered HTML (format chuẩn §5.1):
     *   open:  s:bo:{id}-s   close: s:bo:{id}-e
     * Quét trong parentElement (fallback document.body) bằng fresh TreeWalker.
     */
    private claimSSRMarkers;
    hydrate(): void;
    /** Registry guard */
    __destroyed__: boolean;
    /** Key trả về bởi markerRegistry.register — destroy() dùng để gỡ lại */
    private markerKey;
    /** Render — idempotent: markers đã trong DOM thì giữ nguyên (same-layout reuse) */
    render(): void;
    destroy(): void;
    start(): void;
    stop(): void;
    setParentElement(parentElement: HtmlInterface | null): void;
    get isSaoElement(): boolean;
    set isSaoElement(value: boolean);
    get isOneBlockOutlet(): boolean;
    set isOneBlockOutlet(value: boolean);
}
//# sourceMappingURL=BlockOutlet.d.ts.map