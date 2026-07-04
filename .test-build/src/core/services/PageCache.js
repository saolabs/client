"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageCache = exports.PageCacheService = void 0;
exports.detachWrapperDOM = detachWrapperDOM;
class PageCacheService {
    constructor() {
        /** Map giữ insertion order → dùng làm LRU */
        this.entries = new Map();
        this.maxEntries = 10;
        /** 15 phút */
        this.defaultTTL = 15 * 60 * 1000;
        /** Hook khi entry bị destroy (evict/expire/invalidate) — ViewManager dọn store tại đây */
        this.onEvict = null;
        /** Injectable cho test */
        this.now = () => Date.now();
    }
    set(urlPath, options) {
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
            fragment: options.fragment,
            scroll: options.scroll ?? { x: 0, y: 0 },
            savedAt: this.now(),
            ttl,
        });
        // LRU evict
        while (this.entries.size > this.maxEntries) {
            const oldestKey = this.entries.keys().next().value;
            const oldest = this.entries.get(oldestKey);
            this.entries.delete(oldestKey);
            this.destroyEntry(oldest);
        }
    }
    /**
     * Lấy entry RA KHỎI cache (chuyển ownership cho caller để restore).
     * Entry quá hạn → destroy, trả null.
     */
    take(urlPath) {
        const entry = this.entries.get(urlPath);
        if (!entry)
            return null;
        this.entries.delete(urlPath);
        if (this.isExpired(entry)) {
            this.destroyEntry(entry);
            return null;
        }
        return entry;
    }
    has(urlPath) {
        const entry = this.entries.get(urlPath);
        return !!entry && !this.isExpired(entry);
    }
    /** Xoá + destroy entry (vd: push navigation cần data tươi, hoặc sau mutation) */
    invalidate(urlPath) {
        const entry = this.entries.get(urlPath);
        if (!entry)
            return false;
        this.entries.delete(urlPath);
        this.destroyEntry(entry);
        return true;
    }
    /** Quét destroy mọi entry quá hạn. Gọi sau mỗi navigation + khi tab visible lại. */
    sweep() {
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
    clear() {
        for (const entry of this.entries.values()) {
            this.destroyEntry(entry);
        }
        this.entries.clear();
    }
    get size() {
        return this.entries.size;
    }
    // ─── Private ────────────────────────────────────────────────
    isExpired(entry) {
        return this.now() - entry.savedAt > entry.ttl;
    }
    destroyEntry(entry) {
        this.destroyViews(entry.views);
        try {
            this.onEvict?.(entry);
        }
        catch (e) {
            console.error('[PageCache] onEvict error:', e);
        }
    }
    destroyViews(views) {
        for (const view of views) {
            try {
                view.__ctrl__?.destroy();
            }
            catch (e) {
                console.error('[PageCache] destroy view error:', e);
            }
        }
    }
}
exports.PageCacheService = PageCacheService;
/**
 * Detach toàn bộ vùng DOM của một wrapper (từ openTag đến closeTag, inclusive)
 * vào DocumentFragment — node KHÔNG bị destroy, chỉ rời khỏi document.
 */
function detachWrapperDOM(wrapper) {
    const fragment = document.createDocumentFragment();
    const start = wrapper.openTag;
    const end = wrapper.closeTag;
    if (!start.parentNode)
        return fragment;
    let current = start;
    while (current) {
        const isEnd = current === end;
        const next = current.nextSibling;
        fragment.appendChild(current); // appendChild tự remove khỏi vị trí cũ
        if (isEnd)
            break;
        current = next;
    }
    return fragment;
}
exports.PageCache = new PageCacheService();
exports.default = exports.PageCache;
