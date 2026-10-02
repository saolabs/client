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


export class MarkerRegistryService implements MarkerRegistryInterface {
    static class: string = 'MarkerRegistryService';
    /**
     * Tag name → short abbreviation (for compact DOM comments).
     * PHẢI khớp 1-1 với server core/ViewStorageManager::$markerTagShortcut —
     * lệch shortcut nào thì marker loại đó không claim được khi hydrate.
     */
    private shortcuts: Record<string, string> = {
        view:         'v',
        component:    'c',
        layout:       'l',
        template:     't',
        block:        'b',
        reactive:     'r',
        section:      's',
        fragment:     'frg',
        blockoutlet:  'bo',
        output:       'o',
        for:          'fo',
        forin:        'fi',
        foreach:      'fe',
        forelse:      'fls',
        each:         'ea',
        while:        'wh',
        if:           'if',
        switch:       'sw',
        include:      'inc',
        echo:         'e',
        echoescaped:  'ee',
        yield:        'y',
        slot:         'st',
        useblock:     'ub',
        extend:       'ex',
        style:        'sty',
        script:       'sc',
    };

    /** Reverse lookup: shortcut → full tag name */
    private reverseShortcuts: Record<string, string> = {};

    /** All registered marker records, keyed by composite key (e.g. 'r:abc123') */
    private records: Map<string, MarkerRegistryRecord> = new Map();

    /** Delimiter between tag shortcut and ID in keys */
    private delimiter: string = ':';

    /**
     * Saola marker prefix — format chuẩn (RUNTIME_CONTRACT.md §5.1):
     *   open:  <!--s:{type}:{id}-s-->
     *   close: <!--s:{type}:{id}-e-->
     * Phải khớp server (core ViewStorageManager) để hydration claim đúng.
     */
    private prefix: string = 's';
    /** Hậu tố đánh dấu open/close marker */
    private openSuffix: string = '-s';
    private closeSuffix: string = '-e';

    /** Auto-increment counter for generating unique IDs */
    private counter: number = 0;

    constructor() {
        this.buildReverseShortcuts();
    }

    // ─── Tag Shortcuts ──────────────────────────────────────────

    /** Get short abbreviation for a tag name */
    shortcut(tag: string): string {
        return this.shortcuts[tag] ?? tag;
    }

    /** Get full tag name from a shortcut */
    fullTag(shortcut: string): string {
        return this.reverseShortcuts[shortcut] ?? shortcut;
    }

    /** Register a custom tag shortcut */
    registerShortcut(tag: string, short: string): void {
        this.shortcuts[tag] = short;
        this.reverseShortcuts[short] = tag;
    }

    // ─── Record Management ──────────────────────────────────────

    /**
     * Register a marker record.
     * 
     * @param tag        Full tag name (e.g. 'reactive', 'block')
     * @param id         Optional specific ID. Auto-generated if omitted.
     * @param attributes Optional metadata.
     * @returns The composite key (e.g. 'r:m0')
     */
    register(tag: string, id?: string, attributes: Record<string, any> = {}): string {
        const resolvedId = id ?? this.generateId();
        const key = this.makeKey(tag, resolvedId);

        const existing = this.records.get(key);
        if (existing) {
            existing.attributes = { ...existing.attributes, ...attributes };
            return key;
        }

        this.records.set(key, {
            tag,
            registryID: resolvedId,
            attributes,
        });

        return key;
    }

    /** Register + create the opening Comment node */
    createMarkerStart(tag: string, id?: string): Comment {
        return document.createComment(this.openComment(tag, id ?? ''));
    }

    createMarkerEnd(tag: string, id?: string): Comment {
        return document.createComment(this.closeComment(tag, id));
    }


    /** Get a record by composite key (e.g. 'r:abc123') */
    get(key: string): MarkerRegistryRecord | null {
        return this.records.get(key) ?? null;
    }

    /** Get a record by tag + id */
    getByTagAndId(tag: string, id: string): MarkerRegistryRecord | null {
        return this.records.get(this.makeKey(tag, id)) ?? null;
    }

    /** Check if a record exists */
    has(key: string): boolean {
        return this.records.has(key);
    }

    /** Remove a record */
    remove(key: string): boolean {
        return this.records.delete(key);
    }

    /** Get all records for a specific tag type */
    getByTag(tag: string): MarkerRegistryRecord[] {
        const short = this.shortcut(tag);
        const results: MarkerRegistryRecord[] = [];
        for (const [key, record] of this.records) {
            if (key.startsWith(short + this.delimiter) || record.tag === tag) {
                results.push(record);
            }
        }
        return results;
    }

    /** Get all records */
    all(): Map<string, MarkerRegistryRecord> {
        return this.records;
    }

    /** Clear all records */
    clear(): void {
        this.records.clear();
        this.counter = 0;
        this.index = null;
    }

    /** Total number of registered markers */
    get size(): number {
        return this.records.size;
    }

    // ─── Marker Index (O(1) claim khi hydrate) ──────────────────

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
    private index: Map<string, Comment> | null = null;

    /** Đã dựng lại index vì miss trong lượt microtask hiện tại chưa? */
    private rebuiltOnMiss: boolean = false;

    /** Bỏ index — gọi khi có HTML server MỚI vào DOM (đầu mỗi lượt hydrate). */
    invalidateIndex(): void {
        this.index = null;
    }

    private buildIndex(): Map<string, Comment> {
        const idx = new Map<string, Comment>();
        const root = document.body ?? document.documentElement;
        if (root) {
            const head = this.prefix + this.delimiter; // "s:"
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
            let node: Comment | null;
            while ((node = walker.nextNode() as Comment | null)) {
                const value = (node.nodeValue ?? '').trim();
                // Giữ node ĐẦU TIÊN theo document order — đúng thứ tự mà
                // TreeWalker scan cũ trả về.
                if (value.startsWith(head) && !idx.has(value)) idx.set(value, node);
            }
        }
        this.index = idx;
        return idx;
    }

    /**
     * Claim cặp marker SSR `<!--s:{tag}:{id}-s-->` … `<!--s:{tag}:{id}-e-->`.
     *
     * @param scope Nếu truyền, cặp tìm được PHẢI nằm trong scope — không thì
     *              rơi về scan tuyến tính trong scope (giữ nguyên ngữ nghĩa cũ).
     * @returns null khi server không render vùng này (partial hydration).
     */
    claim(tag: string, id: string, scope?: Element | null): { open: Comment; close: Comment } | null {
        const openText = this.openComment(tag, id);
        const closeText = this.closeComment(tag, id);

        let idx = this.index ?? this.buildIndex();
        let open = idx.get(openText);
        let close = idx.get(closeText);

        // Miss có HAI nguyên nhân: (a) server không render vùng này — partial
        // hydration, hợp lệ; (b) index cũ vì HTML server mới vào DOM sau lần
        // dựng. Không phân biệt được trong O(1), nên dựng lại TỐI ĐA MỘT LẦN
        // mỗi lượt microtask: burst hydrate đồng bộ chỉ tốn thêm 1 lượt quét,
        // còn 499 miss thật sau đó vẫn O(1) (không quay lại O(N²)).
        // Node rời DOM cũng là dấu hiệu index cũ → xử lý cùng nhánh.
        const stale = (open && !open.isConnected) || (close && !close.isConnected);
        if (stale || ((!open || !close) && !this.rebuiltOnMiss)) {
            this.rebuiltOnMiss = true;
            queueMicrotask(() => { this.rebuiltOnMiss = false; });
            idx = this.buildIndex();
            open = idx.get(openText);
            close = idx.get(closeText);
        }

        if (!open || !close || !open.isConnected || !close.isConnected) return null;

        if (scope && !(scope.contains(open) && scope.contains(close))) {
            return this.scanForPair(scope, openText, closeText);
        }
        return { open, close };
    }

    /** Fallback hiếm: quét tuyến tính trong scope (ngữ nghĩa scan cũ). */
    private scanForPair(scope: Node, openText: string, closeText: string): { open: Comment; close: Comment } | null {
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_COMMENT);
        let openNode: Comment | null = null;
        let node: Comment | null;
        while ((node = walker.nextNode() as Comment | null)) {
            const value = (node.nodeValue ?? '').trim();
            if (!openNode && value === openText) { openNode = node; continue; }
            if (openNode && value === closeText) return { open: openNode, close: node };
        }
        return null;
    }

    // ─── Comment Node Helpers ───────────────────────────────────

    /**
     * Create a comment string for a marker (open).
     * Format chuẩn: 's:r:abc123-s' cho <!--s:r:abc123-s-->
     */
    openComment(tag: string, id?: string): string {
        const body = id ? `${this.shortcut(tag)}${this.delimiter}${id}` : this.shortcut(tag);
        return `${this.prefix}${this.delimiter}${body}${this.openSuffix}`;
    }

    /**
     * Create a comment string for a closing marker.
     * Format chuẩn: 's:r:abc123-e' cho <!--s:r:abc123-e-->
     */
    closeComment(tag: string, id?: string): string {
        const body = id ? `${this.shortcut(tag)}${this.delimiter}${id}` : this.shortcut(tag);
        return `${this.prefix}${this.delimiter}${body}${this.closeSuffix}`;
    }

    /**
     * Parse a comment node's text to extract tag and id (format chuẩn §5.1).
     * 's:r:abc123-s' → { tag: 'reactive', id: 'abc123', isClose: false }
     * 's:r:abc123-e' → { tag: 'reactive', id: 'abc123', isClose: true }
     */
    parseComment(text: string): { tag: string; id: string; isClose: boolean } | null {
        const trimmed = text.trim();
        if (!trimmed) return null;

        const head = this.prefix + this.delimiter; // "s:"
        if (!trimmed.startsWith(head)) return null;

        let body = trimmed.slice(head.length); // "r:abc123-s"
        let isClose: boolean;
        if (body.endsWith(this.openSuffix)) {
            isClose = false;
            body = body.slice(0, -this.openSuffix.length);
        } else if (body.endsWith(this.closeSuffix)) {
            isClose = true;
            body = body.slice(0, -this.closeSuffix.length);
        } else {
            return null;
        }

        const delimIdx = body.indexOf(this.delimiter);
        if (delimIdx === -1) {
            return { tag: this.fullTag(body), id: '', isClose };
        }

        const shortTag = body.slice(0, delimIdx);
        const id = body.slice(delimIdx + 1);

        return {
            tag: this.fullTag(shortTag),
            id,
            isClose,
        };
    }

    // ─── Private ────────────────────────────────────────────────

    private makeKey(tag: string, id?: string): string {
        return `${this.shortcut(tag)}${id ? this.delimiter + id : ''}`;
    }

    private generateId(): string {
        return `m${(this.counter++).toString(36)}`;
    }

    private buildReverseShortcuts(): void {
        this.reverseShortcuts = {};
        for (const [tag, short] of Object.entries(this.shortcuts)) {
            this.reverseShortcuts[short] = tag;
        }
    }
}

// ─── Singleton ──────────────────────────────────────────────────

export const MarkerRegistry = new MarkerRegistryService();
export default MarkerRegistry;
