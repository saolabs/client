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
        // Mount block content vào outlet cùng tên; outlet không có block active → clear về rỗng
        for (const [, outlet] of this.blockOutlets) {
            const block = this.activeBlocks.get(outlet.name);
            if (block && block.contentRenderFactory) {
                this.mountBlockIntoOutlet(block, outlet);
            } else {
                this.clearOutlet(outlet.name);
            }
        }
    }

    /**
     * Mount a single block's content into an outlet.
     * Clear nội dung cũ trước, render content mới GIỮA outlet markers
     * (cùng insertion model với Reactive — RUNTIME_CONTRACT.md §2).
     */
    private mountBlockIntoOutlet(block: BlockInterface, outlet: BlockOutletInterface): void {
        if (!outlet.openTag.parentNode) return; // outlet chưa nằm trong DOM

        // Clear nội dung cũ (page trước) trước khi mount page mới
        this.clearOutlet(outlet.name);

        const children: any[] = [];
        const insertBeforeClose = (node: Node) => {
            outlet.closeTag.parentNode?.insertBefore(node, outlet.closeTag);
        };

        // Render block content using the factory — elements thuộc về PAGE ctrl
        const content = block.contentRenderFactory!(outlet.parentElement as any);

        if (!Array.isArray(content)) return;

        for (const child of content) {
            if (child === null || child === undefined) continue;
            if (typeof child === 'string' || typeof child === 'number') {
                insertBeforeClose(document.createTextNode(String(child)));
            } else if (child instanceof Node) {
                insertBeforeClose(child);
            } else if (typeof child === 'object') {
                if ('element' in child && (child as any).element) {
                    insertBeforeClose((child as any).element);
                    children.push(child);
                    child.render();
                } else if ('openTag' in child) {
                    // Marker-based: đặt markers đúng vị trí trước, render sau (idempotent)
                    if ('parent' in child) {
                        (child as any).parent = outlet.parentElement;
                    }
                    if ('parentElement' in child) {
                        (child as any).parentElement = outlet.parentElement;
                    }
                    insertBeforeClose((child as any).openTag);
                    insertBeforeClose((child as any).closeTag);
                    children.push(child);
                    child.render();
                }
            }
        }

        // Track mounted children for lifecycle (start/stop/destroy)
        this.mountedChildren.set(outlet.name, children);
    }

    /**
     * Hydrate version của mountAll — dùng khi SSR.
     * KHÁC mountAll: KHÔNG clearOutlet (giữ DOM server), KHÔNG insertBefore.
     * Chạy block factory ở HYDRATE mode → Html/Output/Reactive con CLAIM
     * DOM server đã render sẵn giữa cặp marker của outlet.
     *
     * Tiền đề: page ctrl.initMode === HYDRATE khi gọi (để this.html() trong
     * factory tạo element claim DOM thay vì tạo mới).
     */
    mountAllHydrate(): void {
        for (const [, outlet] of this.blockOutlets) {
            const block = this.activeBlocks.get(outlet.name);
            if (block && block.contentRenderFactory) {
                this.hydrateBlockIntoOutlet(block, outlet);
            }
            // outlet không có block active → để nguyên DOM server (thường rỗng)
        }
    }

    /**
     * Claim block content vào outlet (hydrate). Chạy factory, gọi render() đệ quy
     * trên children để claim DOM, KHÔNG chèn node mới. Track children cho lifecycle.
     */
    private hydrateBlockIntoOutlet(block: BlockInterface, outlet: BlockOutletInterface): void {
        const children: any[] = [];
        const content = block.contentRenderFactory!(outlet.parentElement as any);
        if (!Array.isArray(content)) return;

        for (const child of content) {
            if (child === null || child === undefined) continue;
            if (typeof child === 'string' || typeof child === 'number') continue; // text: giữ server
            if (child instanceof Node) continue;
            if (typeof child === 'object') {
                if ('element' in child && (child as any).element) {
                    children.push(child);
                    (child as any).render(); // HYDRATE: Html claim DOM, không chèn
                } else if ('openTag' in child) {
                    if ('parent' in child) (child as any).parent = outlet.parentElement;
                    if ('parentElement' in child) (child as any).parentElement = outlet.parentElement;
                    children.push(child);
                    (child as any).render(); // HYDRATE: Output/Reactive claim markers
                }
            }
        }

        this.mountedChildren.set(outlet.name, children);
    }

    /** Tìm outlet theo tên (outlet key = `${layoutViewId}-ob-${name}`) */
    private findOutletByName(name: string): BlockOutletInterface | null {
        for (const [, outlet] of this.blockOutlets) {
            if (outlet.name === name) return outlet;
        }
        return null;
    }

    /**
     * Detach block content của một page (rời trang, vào PageCache):
     * gỡ DOM giữa markers của từng outlet vào DocumentFragment, lấy children
     * đang track ra khỏi manager (KHÔNG destroy — instance sống trong cache).
     *
     * Trả Map<outletName, {fragment, children}> để restore sau này.
     */
    detachPageContent(viewId: string): Map<string, { fragment: DocumentFragment; children: any[] }> {
        const result = new Map<string, { fragment: DocumentFragment; children: any[] }>();
        for (const [name, block] of Array.from(this.activeBlocks)) {
            if (block.viewId !== viewId) continue;

            const fragment = document.createDocumentFragment();
            const outlet = this.findOutletByName(name);
            if (outlet && outlet.openTag.parentNode) {
                let current = outlet.openTag.nextSibling;
                while (current && current !== outlet.closeTag) {
                    const next = current.nextSibling;
                    fragment.appendChild(current); // appendChild tự remove khỏi DOM
                    current = next;
                }
            }

            const children = this.mountedChildren.get(name) ?? [];
            this.mountedChildren.delete(name);
            this.activeBlocks.delete(name); // page rời đi — không còn active ở outlet này
            result.set(name, { fragment, children });
        }
        return result;
    }

    /**
     * Restore block content của một page từ PageCache vào outlets hiện tại.
     * Tiền đề: layout đang mount trùng với layout lúc detach (ViewManager guard).
     */
    restorePageContent(viewId: string, contents: Map<string, { fragment: DocumentFragment; children: any[] }>): void {
        for (const [name, { fragment, children }] of contents) {
            const outlet = this.findOutletByName(name);
            if (outlet && outlet.closeTag.parentNode) {
                outlet.closeTag.parentNode.insertBefore(fragment, outlet.closeTag);
            }
            this.mountedChildren.set(name, children);
            // Re-activate block của page này (blocks map còn giữ — pause không xoá)
            const block = this.blocks.get(name + viewId);
            if (block) {
                this.activeBlocks.set(name, block);
            }
        }
    }

    /** Start toàn bộ block content đang mounted (gọi sau mountAll) */
    startAll(): void {
        for (const [, children] of this.mountedChildren) {
            for (const child of children) {
                if (child && typeof child.start === 'function') child.start();
            }
        }
    }

    /** Stop toàn bộ block content (trước khi swap page) */
    stopAll(): void {
        for (const [, children] of this.mountedChildren) {
            for (const child of children) {
                if (child && typeof child.stop === 'function') child.stop();
            }
        }
    }

    /**
     * Gỡ mọi dấu vết của một view (page bị destroy):
     * clear outlet đang chứa content của nó + xoá block đăng ký.
     */
    unmountView(viewId: string): void {
        for (const [name, block] of this.activeBlocks) {
            if (block.viewId === viewId) {
                this.clearOutlet(name);
                this.activeBlocks.delete(name);
            }
        }
        for (const [key, block] of this.blocks) {
            if (block.viewId === viewId) {
                this.blocks.delete(key);
            }
        }
    }

    /**
     * Gỡ outlets của một layout khỏi registry mà KHÔNG destroy — layout pause
     * vào PageCache. Nếu để lại, mountAll/findOutletByName có thể đụng outlet
     * (trùng tên) của layout đang detached. Re-register khi resume qua
     * addOutlet (ViewManager.reregisterLayoutOutlets).
     */
    detachOutletsOfView(viewId: string): void {
        for (const [key, outlet] of this.blockOutlets) {
            if ((outlet as any).ctx?.viewId === viewId) {
                this.blockOutlets.delete(key);
            }
        }
    }

    /** Gỡ outlets của một layout bị destroy */
    removeOutletsOfView(viewId: string): void {
        for (const [key, outlet] of this.blockOutlets) {
            if ((outlet as any).ctx?.viewId === viewId) {
                this.mountedChildren.delete(outlet.name);
                this.blockOutlets.delete(key);
            }
        }
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
