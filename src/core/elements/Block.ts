import type { BlockInterface, BlockRenderFactory } from "../contracts/BlockInterface";
import { InitMode } from "../contracts/common";
import type { FragmentInterface, HtmlInterface } from "../contracts/ElementInterface";
import type { ReactiveInterface } from "../contracts/ReactiveInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { generateUUID } from "../hellpers/utils";
import markerRegistry from "../services/MarkerRegistry";
import type { OneObjectType } from "../types/utils";
import { Fragment } from "./Fragment";
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
export class Block implements BlockInterface {
    oneType: OneObjectType = 'Block';
    id: string;
    name: string;
    ctx: ViewControllerInterface;
    viewId: string | null = null;
    fragment: FragmentInterface | null = null;
    contentRenderFactory: BlockRenderFactory | null = null;
    openTag: Comment;
    closeTag: Comment;

    domChildren: Node[] = [];
    initMode?: InitMode | undefined;
    parentElement: HtmlInterface | null = null;

    public readonly isOneBlock = true;
    public readonly isOneElement = false;
    
    constructor({
        ctx,
        name,
        viewId = null,
        contentRenderFactory = (parentElement: HtmlInterface) => [],
        id = null,
        initMode = 'create'
    }: {
        ctx: ViewControllerInterface;
        name: string;
        viewId?: string | null;
        contentRenderFactory?: BlockRenderFactory;
        id?: string | null;
        initMode?: InitMode;
    }) {
        this.id = `${this.viewId}-${id ?? generateUUID(10)}`; // Unique ID for debugging
        this.ctx = ctx;
        this.name = name;
        this.viewId = viewId ?? ctx.viewId; // Associate block with current viewId
        this.initMode = initMode;
        this.contentRenderFactory = contentRenderFactory || ((parentElement: HtmlInterface) => []);
        markerRegistry.register('block', this.id, { name, viewId }); // Register block in marker registry
        this.openTag = markerRegistry.createMarkerStart('block', this.id);
        this.closeTag = markerRegistry.createMarkerEnd('block', this.id);

    }

    /** Initialize the block */
    init(): void {
        if (this.initMode === 'hydrate') {
            // Hydration logic here
        } else {
            // Creation logic here
        }
    }

    /** Render the block's content into the parent element */
    render(): void {

        if (!this.contentRenderFactory) return;

        // Generate content using the factory
        const content = this.contentRenderFactory(this.parentElement!);

    }

    mount(mountCtx: ViewControllerInterface, parentElement: HtmlInterface): any {
        if(this.fragment) {
            this.fragment.parent = parentElement;
            this.fragment.render();
        }
    }
    unmount(): void {
        // Unmount logic (e.g. hide or remove DOM nodes, stop reactions)
    }
    destroy(): void {
        // Cleanup logic (e.g. remove DOM nodes, clear caches)
    }
    update(): void {
        // Update logic (e.g. re-render content on state change)
    }

     /** Set the block's parent element (used for mounting) */
     setParentElement(parentElement: HtmlInterface | null): void {
        this.parentElement = parentElement;
    }

}