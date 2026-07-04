/**
 * PageCache — bfcache-style cache cho trang đã ghé (ROUTE_RENDER_FLOW.md §8).
 *
 * Key = urlPath đầy đủ. Value = view chain (instance còn sống, state nguyên vẹn)
 * + DOM fragment đã detach + scroll position.
 *
 * Chính sách:
 *   - LRU max `maxEntries` (mặc định 10)
 *   - TTL mặc định 15 phút — entry quá hạn bị destroy thật + xoá khỏi cache
 *   - Hết hạn kiểm tra 3 tầng: lazy khi take(), sweep() khi navigate,
 *     sweep() khi tab visible lại (đăng ký ở bootstrap)
 *   - Trang đang active KHÔNG nằm trong cache (take() chuyển ownership ra ngoài)
 */
import type { ViewInterface } from "../contracts/ViewInterface";
export interface PageCacheEntry {
    urlPath: string;
    /** View chain (page + layouts không reuse), instance sống — state giữ nguyên */
    views: ViewInterface[];
    /** DOM đã detach (toàn bộ vùng wrapper, gồm cả comment markers) */
    fragment: DocumentFragment;
    scroll: {
        x: number;
        y: number;
    };
    savedAt: number;
    ttl: number;
}
export interface PageCacheSetOptions {
    views: ViewInterface[];
    fragment: DocumentFragment;
    scroll?: {
        x: number;
        y: number;
    };
    /** Override TTL cho entry này (ms). 0 = không cache. */
    ttl?: number;
}
export declare class PageCacheService {
    /** Map giữ insertion order → dùng làm LRU */
    private entries;
    maxEntries: number;
    /** 15 phút */
    defaultTTL: number;
    /** Hook khi entry bị destroy (evict/expire/invalidate) — ViewManager dọn store tại đây */
    onEvict: ((entry: PageCacheEntry) => void) | null;
    /** Injectable cho test */
    now: () => number;
    set(urlPath: string, options: PageCacheSetOptions): void;
    /**
     * Lấy entry RA KHỎI cache (chuyển ownership cho caller để restore).
     * Entry quá hạn → destroy, trả null.
     */
    take(urlPath: string): PageCacheEntry | null;
    has(urlPath: string): boolean;
    /** Xoá + destroy entry (vd: push navigation cần data tươi, hoặc sau mutation) */
    invalidate(urlPath: string): boolean;
    /** Quét destroy mọi entry quá hạn. Gọi sau mỗi navigation + khi tab visible lại. */
    sweep(): number;
    clear(): void;
    get size(): number;
    private isExpired;
    private destroyEntry;
    private destroyViews;
}
/**
 * Detach toàn bộ vùng DOM của một wrapper (từ openTag đến closeTag, inclusive)
 * vào DocumentFragment — node KHÔNG bị destroy, chỉ rời khỏi document.
 */
export declare function detachWrapperDOM(wrapper: {
    openTag: Comment;
    closeTag: Comment;
}): DocumentFragment;
export declare const PageCache: PageCacheService;
export default PageCache;
//# sourceMappingURL=PageCache.d.ts.map