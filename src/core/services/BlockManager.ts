import type { BlockInterface, BlockManagerInterface, BlockOutletInterface, BlockRenderFactory } from "../contracts/BlockInterface";
import type { HtmlInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { Block } from "../elements/Block";

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
export class BlockManagerService implements BlockManagerInterface {
    blocks: Map<string, BlockInterface> = new Map();
    blockOutlets: Map<string, BlockOutletInterface> = new Map();
    activeBlocks: Map<string, BlockInterface> = new Map();
    listeners: Map<string, ((block: BlockInterface) => void)[]> = new Map();
    
    /** Tracks children mounted into each outlet for cleanup */
    private mountedChildren: Map<string, any[]> = new Map();

    constructor() {}

    add(block: BlockInterface): void {
        const key = block.name + (block.viewId ?? '');
        if (!this.blocks.has(key)) {
            this.blocks.set(key, block);
        }
        this.active(block.name, block.viewId ?? '');
    }

    active(name: string, viewId: string): void {
        const key = name + viewId;
        const block = this.blocks.get(key);
        if (block) {
            this.activeBlocks.set(name, block);
            const listeners = this.listeners.get(name);
            if (listeners) {
                listeners.forEach(fn => fn(block));
            }
        }
    }

    subscribe(name: string, callback: (block: BlockInterface) => void): () => void {
        if (!this.listeners.has(name)) {
            this.listeners.set(name, []);
        }
        this.listeners.get(name)!.push(callback);
        return () => this.unsubscribe(name, callback);
    }

    unsubscribe(name: string, callback?: (block: BlockInterface) => void): void {
        if (!this.listeners.has(name)) return;
        if (!callback) {
            this.listeners.delete(name);
            return;
        }
        const listeners = this.listeners.get(name);
        if (listeners) {
            this.listeners.set(name, listeners.filter(fn => fn !== callback));
            if (this.listeners.get(name)!.length === 0) {
                this.listeners.delete(name);
            }
        }
    }

    addOutlet(key: string, outlet: BlockOutletInterface): void {
        if (!this.blockOutlets.has(key)) {
            this.blockOutlets.set(key, outlet);
        }
    }

    hasOutlet(key: string): boolean {
        return this.blockOutlets.has(key);
    }

    getOutlet(key: string): BlockOutletInterface | undefined {
        return this.blockOutlets.get(key);
    }

    /**
     * Mount all registered blocks into their corresponding outlets.
     * Called by ViewManager after layout + page views are both rendered.
     * 
     * Iterates activeBlocks by name, finds matching outlet (keyed by
     * viewId:blockName), and inserts block content between outlet markers.
     */
    mountAll(): void {
        for (const [name, block] of this.activeBlocks) {
            // Try to find an outlet that matches this block name
            for (const [outletKey, outlet] of this.blockOutlets) {
                if (outletKey.endsWith(`:${name}`) || outlet.name === name) {
                    if (block.contentRenderFactory) {
                        this.mountBlockIntoOutlet(block, outlet);
                    }
                    break;
                }
            }
        }
    }

    /**
     * Mount a single block's content into an outlet.
     * Content is rendered and inserted between the outlet's open/close markers.
     */
    private mountBlockIntoOutlet(block: BlockInterface, outlet: BlockOutletInterface): void {
        if (!outlet.parentElement?.element) return;

        const parentEl = outlet.parentElement.element;
        const children: any[] = [];

        // Render block content using the factory
        const content = block.contentRenderFactory!(block.ctx as any);

        if (!Array.isArray(content)) return;

        // Insert each child between outlet markers
        for (const child of content) {
            if (typeof child === 'string' || typeof child === 'number') {
                const textNode = document.createTextNode(String(child));
                parentEl.insertBefore(textNode, outlet.closeTag);
            } else if (child && typeof child === 'object') {
                if ('element' in child) {
                    // HtmlInterface, TextInterface
                    parentEl.insertBefore(child.element, outlet.closeTag);
                    children.push(child);
                    child.render();
                } else if ('openTag' in child) {
                    // Reactive, Fragment, Output — set parent, render
                    if ('parent' in child) {
                        (child as any).parent = outlet.parentElement;
                    }
                    if ('parentElement' in child) {
                        (child as any).parentElement = outlet.parentElement;
                    }
                    children.push(child);
                    child.render();
                }
            }
        }

        // Track mounted children for cleanup
        this.mountedChildren.set(outlet.name, children);
    }

    /**
     * Clear content from a specific outlet (for page swap).
     * Removes all DOM nodes between a named outlet's markers.
     */
    clearOutlet(name: string): void {
        // Find outlet by name
        for (const [key, outlet] of this.blockOutlets) {
            if (outlet.name === name) {
                // Destroy tracked children first
                const children = this.mountedChildren.get(name) || [];
                if (children) {
                    for (const child of children) {
                        if ('destroy' in child && typeof child.destroy === 'function') {
                            child.destroy();
                        }
                    }
                    this.mountedChildren.delete(name);
                }

                // Remove any remaining DOM nodes between markers
                let current = outlet.openTag.nextSibling;
                while (current && current !== outlet.closeTag) {
                    const next = current.nextSibling;
                    current.remove();
                    current = next;
                }
                break;
            }
        }
    }

    /**
     * Clear all outlets (for full layout teardown).
     */
    clearAllOutlets(): void {
        for (const [key, outlet] of this.blockOutlets) {
            this.clearOutlet(outlet.name);
        }
    }

    /**
     * Full cleanup — destroy all blocks, outlets, listeners.
     */
    destroy(): void {
        this.clearAllOutlets();
        this.blocks.clear();
        this.blockOutlets.clear();
        this.activeBlocks.clear();
        this.listeners.clear();
        this.mountedChildren.clear();
    }
}

export const BlockManager = new BlockManagerService();
export default BlockManager;
