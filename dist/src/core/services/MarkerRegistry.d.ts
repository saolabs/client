/**
 * MarkerRegistry — singleton service that manages DOM comment marker metadata.
 *
 * In the new element-based system, Reactive/Block/Fragment all use
 * comment nodes (<!--reactive-start-->, <!--block:content-end-->) as markers.
 *
 * MarkerRegistry provides:
 *   1. Tag shortcuts: 'reactive' → 'r', 'block' → 'b', etc.
 *      → Keeps DOM comments short: <!--r:abc123--> instead of <!--reactive:abc123-->
 *   2. Registry records: maps marker IDs to metadata (tag type, attributes, owner viewId, etc.)
 *      → Enables lookup: given a comment node, find what element/view it belongs to
 *   3. Query API: find records by tag, by viewId, by custom attributes
 *
 * Used by:
 *   - Reactive, Block, Fragment — to register their markers on creation
 *   - ViewController — to query/manage markers for its view
 *   - Compiler — to know tag shortcut mappings for generated code
 *   - DevTools (future) — to inspect/debug the element tree via markers
 */
import { MarkerRegistryInterface, MarkerRegistryRecord } from "../contracts/MarkerInterface.js";
export declare class MarkerRegistryService implements MarkerRegistryInterface {
    static class: string;
    /**
     * Tag name → short abbreviation (for compact DOM comments).
     * PHẢI khớp 1-1 với server core/ViewStorageManager::$markerTagShortcut —
     * lệch shortcut nào thì marker loại đó không claim được khi hydrate.
     */
    private shortcuts;
    /** Reverse lookup: shortcut → full tag name */
    private reverseShortcuts;
    /** All registered marker records, keyed by composite key (e.g. 'r:abc123') */
    private records;
    /** Delimiter between tag shortcut and ID in keys */
    private delimiter;
    /**
     * Saola marker prefix — format chuẩn (RUNTIME_CONTRACT.md §5.1):
     *   open:  <!--s:{type}:{id}-s-->
     *   close: <!--s:{type}:{id}-e-->
     * Phải khớp server (core ViewStorageManager) để hydration claim đúng.
     */
    private prefix;
    /** Hậu tố đánh dấu open/close marker */
    private openSuffix;
    private closeSuffix;
    /** Auto-increment counter for generating unique IDs */
    private counter;
    constructor();
    /** Get short abbreviation for a tag name */
    shortcut(tag: string): string;
    /** Get full tag name from a shortcut */
    fullTag(shortcut: string): string;
    /** Register a custom tag shortcut */
    registerShortcut(tag: string, short: string): void;
    /**
     * Register a marker record.
     *
     * @param tag        Full tag name (e.g. 'reactive', 'block')
     * @param id         Optional specific ID. Auto-generated if omitted.
     * @param attributes Optional metadata.
     * @returns The composite key (e.g. 'r:m0')
     */
    register(tag: string, id?: string, attributes?: Record<string, any>): string;
    /** Register + create the opening Comment node */
    createMarkerStart(tag: string, id?: string): Comment;
    createMarkerEnd(tag: string, id?: string): Comment;
    /** Get a record by composite key (e.g. 'r:abc123') */
    get(key: string): MarkerRegistryRecord | null;
    /** Get a record by tag + id */
    getByTagAndId(tag: string, id: string): MarkerRegistryRecord | null;
    /** Check if a record exists */
    has(key: string): boolean;
    /** Remove a record */
    remove(key: string): boolean;
    /** Get all records for a specific tag type */
    getByTag(tag: string): MarkerRegistryRecord[];
    /** Get all records */
    all(): Map<string, MarkerRegistryRecord>;
    /** Clear all records */
    clear(): void;
    /** Total number of registered markers */
    get size(): number;
    /**
     * Index text-comment → Comment node, dựng 1 lần cho mỗi lượt hydrate.
     *
     * Trước đây mỗi element (Reactive/Output/Component/Wrapper/BlockOutlet/Block)
     * tự tạo TreeWalker quét toàn bộ comment trong parent để tìm đúng 2 chuỗi →
     * O(số element × số comment). Với 400 row × 5 cột (~4000 marker) đo được
     * ~210ms chỉ để claim. Index 1 lượt rồi Map.get đưa về O(N) tổng, ~1.5ms.
     *
     * null = chưa dựng (lazy — CSR không bao giờ chạm tới).
     */
    private index;
    /** Đã dựng lại index vì miss trong lượt microtask hiện tại chưa? */
    private rebuiltOnMiss;
    /** Bỏ index — gọi khi có HTML server MỚI vào DOM (đầu mỗi lượt hydrate). */
    invalidateIndex(): void;
    private buildIndex;
    /**
     * Claim cặp marker SSR `<!--s:{tag}:{id}-s-->` … `<!--s:{tag}:{id}-e-->`.
     *
     * @param scope Nếu truyền, cặp tìm được PHẢI nằm trong scope — không thì
     *              rơi về scan tuyến tính trong scope (giữ nguyên ngữ nghĩa cũ).
     * @returns null khi server không render vùng này (partial hydration).
     */
    claim(tag: string, id: string, scope?: Element | null): {
        open: Comment;
        close: Comment;
    } | null;
    /** Fallback hiếm: quét tuyến tính trong scope (ngữ nghĩa scan cũ). */
    private scanForPair;
    /**
     * Create a comment string for a marker (open).
     * Format chuẩn: 's:r:abc123-s' cho <!--s:r:abc123-s-->
     */
    openComment(tag: string, id?: string): string;
    /**
     * Create a comment string for a closing marker.
     * Format chuẩn: 's:r:abc123-e' cho <!--s:r:abc123-e-->
     */
    closeComment(tag: string, id?: string): string;
    /**
     * Parse a comment node's text to extract tag and id (format chuẩn §5.1).
     * 's:r:abc123-s' → { tag: 'reactive', id: 'abc123', isClose: false }
     * 's:r:abc123-e' → { tag: 'reactive', id: 'abc123', isClose: true }
     */
    parseComment(text: string): {
        tag: string;
        id: string;
        isClose: boolean;
    } | null;
    private makeKey;
    private generateId;
    private buildReverseShortcuts;
}
export declare const MarkerRegistry: MarkerRegistryService;
export default MarkerRegistry;
//# sourceMappingURL=MarkerRegistry.d.ts.map