import type { BlockInterface, BlockManagerInterface, BlockOutletInterface } from "../contracts/BlockInterface";
/**
 * BlockManager — manages all block slots in a layout view.
 *
 * Responsibilities:
 *   - Register block slots declared by @useBlock(name) in layout
 *   - Track which blocks exist and their active state
 *   - Coordinate mounting/unmounting when router navigates
 *   - Provide block state info (active viewId, cached views, etc.)
 *
 * Lifecycle:
 *   1. Layout view creates BlockManager
 *   2. Layout's render() calls manager.register('content', parentEl) for each @useBlock
 *   3. Router calls manager.mount('content', viewId, factory) on navigation
 *   4. On browser back/forward, router calls mount with previous viewId
 *      → Block restores cached DOM instead of re-rendering
 *   5. When layout deactivates, manager.unmountAll() hides all content
 */
export declare class BlockManagerService implements BlockManagerInterface {
    blocks: Map<string, BlockInterface>;
    blockOutlets: Map<string, BlockOutletInterface>;
    activeBlocks: Map<string, BlockInterface>;
    listeners: Map<string, ((block: BlockInterface) => void)[]>;
    /** Tracks children mounted into each outlet for cleanup */
    private mountedChildren;
    constructor();
    add(block: BlockInterface): void;
    active(name: string, viewId: string): void;
    subscribe(name: string, callback: (block: BlockInterface) => void): () => void;
    unsubscribe(name: string, callback?: (block: BlockInterface) => void): void;
    addOutlet(key: string, outlet: BlockOutletInterface): void;
    hasOutlet(key: string): boolean;
    getOutlet(key: string): BlockOutletInterface | undefined;
    /**
     * Mount all registered blocks into their corresponding outlets.
     * Called by ViewManager after layout + page views are both rendered.
     *
     * Iterates activeBlocks by name, finds matching outlet (keyed by
     * viewId:blockName), and inserts block content between outlet markers.
     */
    mountAll(): void;
    /**
     * Mount a single block's content into an outlet.
     * Content is rendered and inserted between the outlet's open/close markers.
     */
    private mountBlockIntoOutlet;
    /**
     * Clear content from a specific outlet (for page swap).
     * Removes all DOM nodes between a named outlet's markers.
     */
    clearOutlet(name: string): void;
    /**
     * Clear all outlets (for full layout teardown).
     */
    clearAllOutlets(): void;
    /**
     * Full cleanup — destroy all blocks, outlets, listeners.
     */
    destroy(): void;
}
export declare const BlockManager: BlockManagerService;
export default BlockManager;
//# sourceMappingURL=BlockManager.d.ts.map