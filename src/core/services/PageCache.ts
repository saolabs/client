/**
 * PageCache — bfcache-style cache cho trang đã ghé (ROUTE_RENDER_FLOW.md §8).
 *
 * Key = `${viewName}::${requestUri}` — requestUri gồm path + query, KHÔNG gồm
 * hash (ViewManager.cacheKey). Value = view chain (instance còn sống, state
 * nguyên vẹn) + DOM đã detach + scroll position.
 *
 * Chính sách:
 *   - LRU max `maxEntries` (mặc định 10)
 *   - TTL mặc định 10 phút — entry quá hạn bị destroy thật + xoá khỏi cache
 *   - Hết hạn kiểm tra 3 tầng: lazy khi take(), sweep() khi navigate,
 *     sweep() khi tab visible lại (đăng ký ở bootstrap)
 *   - Trang đang active KHÔNG nằm trong cache (take() chuyển ownership ra ngoài)
 *   - Page thuộc layout: DOM được detach THEO TỪNG OUTLET (outletContents);
 *     chỉ restore được khi layout đang mount trùng `layoutPath`.
 */
import type { ViewInterface } from "../contracts/ViewInterface";

/** Nội dung một outlet đã detach (page thuộc layout) */
export interface OutletContent {
    fragment: DocumentFragment;
    /** Saola elements (block content) — để re-track lifecycle khi restore */
    children: any[];
}

export interface PageCacheEntry {
    urlPath: string;
    /** View chain (page + layouts không reuse), instance sống — state giữ nguyên */
    views: ViewInterface[];
    /** DOM đã detach (toàn bộ vùng wrapper, gồm cả comment markers) — standalone page */
    fragment: DocumentFragment;
    /** Page thuộc layout: path của layout lúc cache — restore đòi hỏi layout trùng */
    layoutPath: string | null;
    /** Page thuộc layout: DOM + children đã detach theo tên outlet */
    outletContents: Map<string, OutletContent> | null;
    scroll: { x: number; y: number };
    savedAt: number;
    ttl: number;
}

export interface PageCacheSetOptions {
    views: ViewInterface[];
    fragment?: DocumentFragment;
    layoutPath?: string | null;
    outletContents?: Map<string, OutletContent> | null;
    scroll?: { x: number; y: number };
    /** Override TTL cho entry này (ms). 0 = không cache. */
    ttl?: number;
}

export class PageCacheService {
    /** Map giữ insertion order → dùng làm LRU */
    private entries = new Map<string, PageCacheEntry>();

    public maxEntries = 10;
    /** 10 phút — trong khoảng thiết kế 5–15 phút; override per-view qua cache:{ttl} */
    public defaultTTL = 10 * 60 * 1000;

    /** Hook khi entry bị destroy (evict/expire/invalidate) — ViewManager dọn store tại đây */
    public onEvict: ((entry: PageCacheEntry) => void) | null = null;

    /** Injectable cho test */
    public now: () => number = () => Date.now();

    set(urlPath: string, options: PageCacheSetOptions): void {
        const ttl = options.ttl ?? this.defaultTTL;
        if (ttl <= 0) {
            // Không cache — destroy luôn
            this.destroyViews(options.views);
            return;
        }

        // Đã có entry cùng path → destroy bản cũ trước
        const existing = this.entries.get(urlPath);
        if (existing) {
            this.entries.delete(urlPath);
            this.destroyEntry(existing);
        }

        this.entries.set(urlPath, {
            urlPath,
            views: options.views,
            fragment: options.fragment ?? document.createDocumentFragment(),
            layoutPath: options.layoutPath ?? null,
            outletContents: options.outletContents ?? null,
            scroll: options.scroll ?? { x: 0, y: 0 },
            savedAt: this.now(),
            ttl,
        });

        // LRU evict
        while (this.entries.size > this.maxEntries) {
            const oldestKey = this.entries.keys().next().value as string;
            const oldest = this.entries.get(oldestKey)!;
            this.entries.delete(oldestKey);
            this.destroyEntry(oldest);
        }
    }

    /**
     * Trả một entry ĐÃ take() về lại cache — dùng khi restore thất bại nhưng
     * entry còn giá trị (vd layout của page chưa mount lại; lần điều hướng sau
     * có thể restore được). GIỮ savedAt gốc — TTL KHÔNG được reset.
     */
    putBack(entry: PageCacheEntry): void {
        if (this.isExpired(entry)) {
            this.destroyEntry(entry);
            return;
        }
        const existing = this.entries.get(entry.urlPath);
        if (existing && existing !== entry) {
            this.entries.delete(entry.urlPath);
            this.destroyEntry(existing);
        }
        this.entries.set(entry.urlPath, entry);

        while (this.entries.size > this.maxEntries) {
            const oldestKey = this.entries.keys().next().value as string;
            const oldest = this.entries.get(oldestKey)!;
            this.entries.delete(oldestKey);
            this.destroyEntry(oldest);
        }
    }

    /**
     * Lấy entry RA KHỎI cache (chuyển ownership cho caller để restore).
     * Entry quá hạn → destroy, trả null.
     */
    take(urlPath: string): PageCacheEntry | null {
        const entry = this.entries.get(urlPath);
        if (!entry) return null;

        this.entries.delete(urlPath);

        if (this.isExpired(entry)) {
            this.destroyEntry(entry);
            return null;
        }
        return entry;
    }

    has(urlPath: string): boolean {
        const entry = this.entries.get(urlPath);
        return !!entry && !this.isExpired(entry);
    }

    /** Xoá + destroy entry (vd: push navigation cần data tươi, hoặc sau mutation) */
    invalidate(urlPath: string): boolean {
        const entry = this.entries.get(urlPath);
        if (!entry) return false;
        this.entries.delete(urlPath);
        this.destroyEntry(entry);
        return true;
    }

    /** Quét destroy mọi entry quá hạn. Gọi sau mỗi navigation + khi tab visible lại. */
    sweep(): number {
        let removed = 0;
        for (const [key, entry] of this.entries) {
            if (this.isExpired(entry)) {
                this.entries.delete(key);
                this.destroyEntry(entry);
                removed++;
            }
        }
        return removed;
    }

    clear(): void {
        for (const entry of this.entries.values()) {
            this.destroyEntry(entry);
        }
        this.entries.clear();
    }

    get size(): number {
        return this.entries.size;
    }

    // ─── Private ────────────────────────────────────────────────

    private isExpired(entry: PageCacheEntry): boolean {
        return this.now() - entry.savedAt > entry.ttl;
    }

    private destroyEntry(entry: PageCacheEntry): void {
        this.destroyTakenEntry(entry);
        try { this.onEvict?.(entry); } catch (e) { console.error('[PageCache] onEvict error:', e); }
    }

    /**
     * Destroy một entry ĐÃ take() ra khỏi cache nhưng không restore được
     * (vd layout hiện tại không khớp layoutPath). Public cho ViewManager.
     */
    destroyTakenEntry(entry: PageCacheEntry): void {
        // Block content đã detach — ViewController.destroy() không đi qua chúng
        // (không nằm trong _rootTree) nên phải destroy tường minh trước.
        if (entry.outletContents) {
            for (const [, content] of entry.outletContents) {
                for (const child of content.children) {
                    try { child?.destroy?.(); }
                    catch (e) { console.error('[PageCache] destroy block child error:', e); }
                }
            }
        }
        this.destroyViews(entry.views);
    }

    private destroyViews(views: ViewInterface[]): void {
        for (const view of views) {
            try { view.__ctrl__?.destroy(); }
            catch (e) { console.error('[PageCache] destroy view error:', e); }
        }
    }
}

/**
 * Detach toàn bộ vùng DOM của một wrapper (từ openTag đến closeTag, inclusive)
 * vào DocumentFragment — node KHÔNG bị destroy, chỉ rời khỏi document.
 */
export function detachWrapperDOM(wrapper: { openTag: Comment; closeTag: Comment }): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const start = wrapper.openTag;
    const end = wrapper.closeTag;
    if (!start.parentNode) return fragment;

    let current: Node | null = start;
    while (current) {
        const isEnd = current === end;
        const next: Node | null = current.nextSibling;
        fragment.appendChild(current); // appendChild tự remove khỏi vị trí cũ
        if (isEnd) break;
        current = next;
    }
    return fragment;
}

export const PageCache = new PageCacheService();
export default PageCache;
