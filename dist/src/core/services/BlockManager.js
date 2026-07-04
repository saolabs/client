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
export class BlockManagerService {
    constructor() {
        this.blocks = new Map();
        this.blockOutlets = new Map();
        this.activeBlocks = new Map();
        this.listeners = new Map();
        /** Tracks children mounted into each outlet for cleanup */
        this.mountedChildren = new Map();
    }
    add(block) {
        const key = block.name + (block.viewId ?? '');
        if (!this.blocks.has(key)) {
            this.blocks.set(key, block);
        }
        this.active(block.name, block.viewId ?? '');
    }
    active(name, viewId) {
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
    subscribe(name, callback) {
        if (!this.listeners.has(name)) {
            this.listeners.set(name, []);
        }
        this.listeners.get(name).push(callback);
        return () => this.unsubscribe(name, callback);
    }
    unsubscribe(name, callback) {
        if (!this.listeners.has(name))
            return;
        if (!callback) {
            this.listeners.delete(name);
            return;
        }
        const listeners = this.listeners.get(name);
        if (listeners) {
            this.listeners.set(name, listeners.filter(fn => fn !== callback));
            if (this.listeners.get(name).length === 0) {
                this.listeners.delete(name);
            }
        }
    }
    addOutlet(key, outlet) {
        if (!this.blockOutlets.has(key)) {
            this.blockOutlets.set(key, outlet);
        }
    }
    hasOutlet(key) {
        return this.blockOutlets.has(key);
    }
    getOutlet(key) {
        return this.blockOutlets.get(key);
    }
    /**
     * Mount all registered blocks into their corresponding outlets.
     * Called by ViewManager after layout + page views are both rendered.
     *
     * Iterates activeBlocks by name, finds matching outlet (keyed by
     * viewId:blockName), and inserts block content between outlet markers.
     */
    mountAll() {
        // Mount block content vào outlet cùng tên; outlet không có block active → clear về rỗng
        for (const [, outlet] of this.blockOutlets) {
            const block = this.activeBlocks.get(outlet.name);
            if (block && block.contentRenderFactory) {
                this.mountBlockIntoOutlet(block, outlet);
            }
            else {
                this.clearOutlet(outlet.name);
            }
        }
    }
    /**
     * Mount a single block's content into an outlet.
     * Clear nội dung cũ trước, render content mới GIỮA outlet markers
     * (cùng insertion model với Reactive — RUNTIME_CONTRACT.md §2).
     */
    mountBlockIntoOutlet(block, outlet) {
        if (!outlet.openTag.parentNode)
            return; // outlet chưa nằm trong DOM
        // Clear nội dung cũ (page trước) trước khi mount page mới
        this.clearOutlet(outlet.name);
        const children = [];
        const insertBeforeClose = (node) => {
            outlet.closeTag.parentNode?.insertBefore(node, outlet.closeTag);
        };
        // Render block content using the factory — elements thuộc về PAGE ctrl
        const content = block.contentRenderFactory(outlet.parentElement);
        if (!Array.isArray(content))
            return;
        for (const child of content) {
            if (child === null || child === undefined)
                continue;
            if (typeof child === 'string' || typeof child === 'number') {
                insertBeforeClose(document.createTextNode(String(child)));
            }
            else if (child instanceof Node) {
                insertBeforeClose(child);
            }
            else if (typeof child === 'object') {
                if ('element' in child && child.element) {
                    insertBeforeClose(child.element);
                    children.push(child);
                    child.render();
                }
                else if ('openTag' in child) {
                    // Marker-based: đặt markers đúng vị trí trước, render sau (idempotent)
                    if ('parent' in child) {
                        child.parent = outlet.parentElement;
                    }
                    if ('parentElement' in child) {
                        child.parentElement = outlet.parentElement;
                    }
                    insertBeforeClose(child.openTag);
                    insertBeforeClose(child.closeTag);
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
    mountAllHydrate() {
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
    hydrateBlockIntoOutlet(block, outlet) {
        const children = [];
        const content = block.contentRenderFactory(outlet.parentElement);
        if (!Array.isArray(content))
            return;
        for (const child of content) {
            if (child === null || child === undefined)
                continue;
            if (typeof child === 'string' || typeof child === 'number')
                continue; // text: giữ server
            if (child instanceof Node)
                continue;
            if (typeof child === 'object') {
                if ('element' in child && child.element) {
                    children.push(child);
                    child.render(); // HYDRATE: Html claim DOM, không chèn
                }
                else if ('openTag' in child) {
                    if ('parent' in child)
                        child.parent = outlet.parentElement;
                    if ('parentElement' in child)
                        child.parentElement = outlet.parentElement;
                    children.push(child);
                    child.render(); // HYDRATE: Output/Reactive claim markers
                }
            }
        }
        this.mountedChildren.set(outlet.name, children);
    }
    /** Start toàn bộ block content đang mounted (gọi sau mountAll) */
    startAll() {
        for (const [, children] of this.mountedChildren) {
            for (const child of children) {
                if (child && typeof child.start === 'function')
                    child.start();
            }
        }
    }
    /** Stop toàn bộ block content (trước khi swap page) */
    stopAll() {
        for (const [, children] of this.mountedChildren) {
            for (const child of children) {
                if (child && typeof child.stop === 'function')
                    child.stop();
            }
        }
    }
    /**
     * Gỡ mọi dấu vết của một view (page bị destroy):
     * clear outlet đang chứa content của nó + xoá block đăng ký.
     */
    unmountView(viewId) {
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
    /** Gỡ outlets của một layout bị destroy */
    removeOutletsOfView(viewId) {
        for (const [key, outlet] of this.blockOutlets) {
            if (outlet.ctx?.viewId === viewId) {
                this.mountedChildren.delete(outlet.name);
                this.blockOutlets.delete(key);
            }
        }
    }
    /**
     * Clear content from a specific outlet (for page swap).
     * Removes all DOM nodes between a named outlet's markers.
     */
    clearOutlet(name) {
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
    clearAllOutlets() {
        for (const [key, outlet] of this.blockOutlets) {
            this.clearOutlet(outlet.name);
        }
    }
    /**
     * Full cleanup — destroy all blocks, outlets, listeners.
     */
    destroy() {
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
//# sourceMappingURL=BlockManager.js.map