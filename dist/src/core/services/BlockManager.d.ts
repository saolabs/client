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
     * Mount only blocks owned by one Page/Layout controller. Nested layout
     * chains call this from outer to inner, so an inner outlet exists before
     * the next owner is mounted and retained layouts are not rebuilt.
     */
    mountViewBlocks(viewId: string): void;
    /** Hydration counterpart of mountViewBlocks(). */
    hydrateViewBlocks(viewId: string): void;
    /**
     * Mount a single block's content into an outlet.
     * Clear nội dung cũ trước, render content mới GIỮA outlet markers
     * (cùng insertion model với Reactive — RUNTIME_CONTRACT.md §2).
     */
    private mountBlockIntoOutlet;
    /**
     * Hydrate version của mountAll — dùng khi SSR.
     * KHÁC mountAll: KHÔNG clearOutlet (giữ DOM server), KHÔNG insertBefore.
     * Chạy block factory ở HYDRATE mode → Html/Output/Reactive con CLAIM
     * DOM server đã render sẵn giữa cặp marker của outlet.
     *
     * Tiền đề: page ctrl.initMode === HYDRATE khi gọi (để this.html() trong
     * factory tạo element claim DOM thay vì tạo mới).
     */
    mountAllHydrate(): void;
    /**
     * Claim block content vào outlet (hydrate). Chạy factory, gọi render() đệ quy
     * trên children để claim DOM, KHÔNG chèn node mới. Track children cho lifecycle.
     */
    private hydrateBlockIntoOutlet;
    /** Tìm outlet theo tên (outlet key = `${layoutViewId}-ob-${name}`) */
    private findOutletByName;
    /**
     * Detach block content của một page (rời trang, vào PageCache):
     * gỡ DOM giữa markers của từng outlet vào DocumentFragment, lấy children
     * đang track ra khỏi manager (KHÔNG destroy — instance sống trong cache).
     *
     * Trả Map<outletName, {fragment, children}> để restore sau này.
     */
    detachPageContent(viewId: string): Map<string, {
        fragment: DocumentFragment;
        children: any[];
    }>;
    /**
     * Restore block content của một page từ PageCache vào outlets hiện tại.
     * Tiền đề: layout đang mount trùng với layout lúc detach (ViewManager guard).
     */
    restorePageContent(viewId: string, contents: Map<string, {
        fragment: DocumentFragment;
        children: any[];
    }>): void;
    /** Start toàn bộ block content đang mounted (gọi sau mountAll) */
    startAll(): void;
    /** Stop toàn bộ block content (trước khi swap page) */
    stopAll(): void;
    /**
     * Gỡ mọi dấu vết của một view (page bị destroy):
     * clear outlet đang chứa content của nó + xoá block đăng ký.
     */
    unmountView(viewId: string): void;
    /**
     * Gỡ outlets của một layout khỏi registry mà KHÔNG destroy — layout pause
     * vào PageCache. Nếu để lại, mountAll/findOutletByName có thể đụng outlet
     * (trùng tên) của layout đang detached. Re-register khi resume qua
     * addOutlet (ViewManager.reregisterLayoutOutlets).
     */
    detachOutletsOfView(viewId: string): void;
    /**
     * Gỡ outlets của một layout bị destroy — XOÁ THẬT, khác hẳn
     * `detachOutletsOfView` ở ngay trên (layout chỉ pause vào PageCache và sẽ
     * được re-register, nên KHÔNG được destroy ở đó).
     * `destroy()` idempotent nên gọi ở đây an toàn kể cả khi teardown cây
     * element đã destroy outlet trước đó.
     */
    removeOutletsOfView(viewId: string): void;
    /**
     * Clear content from a specific outlet (for page swap).
     * Removes all DOM nodes between a named outlet's markers.
     */
    clearOutlet(name: string): void;
    private outletKey;
    private clearOutletInstance;
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