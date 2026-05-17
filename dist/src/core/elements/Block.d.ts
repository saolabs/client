import type { BlockInterface, BlockRenderFactory } from "../contracts/BlockInterface";
import { InitMode } from "../contracts/common";
import type { FragmentInterface, HtmlInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { SaoObjectType } from "../types/utils";
/**
 * Block — a named mounting slot used in layout views.
 *
 * In a layout (super view), you declare blocks like `@useBlock('content')`.
 * Each block is a Reactive region that mounts/unmounts page view content.
 *
 * Key behaviors:
 *   - Only active when the layout view is active
 *   - Caches previously mounted view content (DOM nodes) so that
 *     navigating back doesn't re-render and lose user state
 *   - Tracks which viewId is currently active in this slot
 *
 * Flow:
 *   1. Layout declares: `@useBlock('content')` → creates Block('content')
 *   2. Router navigates to page → BlockManager.mount('content', viewId, factory)
 *   3. Block caches old content, mounts new content
 *   4. Browser back → BlockManager restores cached content without re-render
 */
export declare class Block implements BlockInterface {
    saoType: SaoObjectType;
    id: string;
    name: string;
    ctx: ViewControllerInterface;
    viewId: string | null;
    fragment: FragmentInterface | null;
    contentRenderFactory: BlockRenderFactory | null;
    openTag: Comment;
    closeTag: Comment;
    domChildren: Node[];
    initMode?: InitMode | undefined;
    parentElement: HtmlInterface | null;
    readonly isOneBlock = true;
    readonly isSaoElement = false;
    constructor({ ctx, name, viewId, contentRenderFactory, id, initMode }: {
        ctx: ViewControllerInterface;
        name: string;
        viewId?: string | null;
        contentRenderFactory?: BlockRenderFactory;
        id?: string | null;
        initMode?: InitMode;
    });
    /** Initialize the block */
    init(): void;
    /** Render the block's content into the parent element */
    render(): void;
    mount(mountCtx: ViewControllerInterface, parentElement: HtmlInterface): any;
    unmount(): void;
    destroy(): void;
    update(): void;
    /** Set the block's parent element (used for mounting) */
    setParentElement(parentElement: HtmlInterface | null): void;
}
//# sourceMappingURL=Block.d.ts.map