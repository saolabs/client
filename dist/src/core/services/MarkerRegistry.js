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
export class MarkerRegistryService {
    constructor() {
        /** Tag name → short abbreviation (for compact DOM comments) */
        this.shortcuts = {
            view: 'v',
            component: 'c',
            layout: 'l',
            template: 't',
            block: 'b',
            reactive: 'r',
            section: 's',
            fragment: 'frg',
            blockoutlet: 'bo',
            for: 'fo',
            forin: 'fi',
            foreach: 'fe',
            while: 'wh',
            if: 'if',
            switch: 'sw',
            include: 'inc',
            echo: 'e',
            echoescaped: 'ee',
            yield: 'y',
            slot: 'st',
            useblock: 'ub',
            extend: 'ex',
            style: 'sty',
            script: 'sc',
        };
        /** Reverse lookup: shortcut → full tag name */
        this.reverseShortcuts = {};
        /** All registered marker records, keyed by composite key (e.g. 'r:abc123') */
        this.records = new Map();
        /** Delimiter between tag shortcut and ID in keys */
        this.delimiter = ':';
        /** Auto-increment counter for generating unique IDs */
        this.counter = 0;
        this.buildReverseShortcuts();
    }
    // ─── Tag Shortcuts ──────────────────────────────────────────
    /** Get short abbreviation for a tag name */
    shortcut(tag) {
        return this.shortcuts[tag] ?? tag;
    }
    /** Get full tag name from a shortcut */
    fullTag(shortcut) {
        return this.reverseShortcuts[shortcut] ?? shortcut;
    }
    /** Register a custom tag shortcut */
    registerShortcut(tag, short) {
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
    register(tag, id, attributes = {}) {
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
    createMarkerStart(tag, id) {
        return document.createComment(this.openComment(tag, id ?? ''));
    }
    createMarkerEnd(tag, id) {
        return document.createComment(this.closeComment(tag, id));
    }
    /** Get a record by composite key (e.g. 'r:abc123') */
    get(key) {
        return this.records.get(key) ?? null;
    }
    /** Get a record by tag + id */
    getByTagAndId(tag, id) {
        return this.records.get(this.makeKey(tag, id)) ?? null;
    }
    /** Check if a record exists */
    has(key) {
        return this.records.has(key);
    }
    /** Remove a record */
    remove(key) {
        return this.records.delete(key);
    }
    /** Get all records for a specific tag type */
    getByTag(tag) {
        const short = this.shortcut(tag);
        const results = [];
        for (const [key, record] of this.records) {
            if (key.startsWith(short + this.delimiter) || record.tag === tag) {
                results.push(record);
            }
        }
        return results;
    }
    /** Get all records */
    all() {
        return this.records;
    }
    /** Clear all records */
    clear() {
        this.records.clear();
        this.counter = 0;
    }
    /** Total number of registered markers */
    get size() {
        return this.records.size;
    }
    // ─── Comment Node Helpers ───────────────────────────────────
    /**
     * Create a comment string for a marker (open).
     * e.g. 'r:abc123' for <!--r:abc123-->
     */
    openComment(tag, id) {
        return `${this.shortcut(tag)}${id ? this.delimiter + id : ''}`;
    }
    /**
     * Create a comment string for a closing marker.
     * e.g. '/r:abc123' for <!--/r:abc123-->
     */
    closeComment(tag, id) {
        return `/${this.shortcut(tag)}${id ? this.delimiter + id : ''}`;
    }
    /**
     * Parse a comment node's text to extract tag and id.
     * '  r:abc123  ' → { tag: 'reactive', id: 'abc123', isClose: false }
     * ' /r:abc123 '  → { tag: 'reactive', id: 'abc123', isClose: true }
     */
    parseComment(text) {
        const trimmed = text.trim();
        if (!trimmed)
            return null;
        const isClose = trimmed.startsWith('/');
        const content = isClose ? trimmed.slice(1) : trimmed;
        const delimIdx = content.indexOf(this.delimiter);
        if (delimIdx === -1)
            return null;
        const shortTag = content.slice(0, delimIdx);
        const id = content.slice(delimIdx + 1);
        return {
            tag: this.fullTag(shortTag),
            id,
            isClose,
        };
    }
    // ─── Private ────────────────────────────────────────────────
    makeKey(tag, id) {
        return `${this.shortcut(tag)}${id ? this.delimiter + id : ''}`;
    }
    generateId() {
        return `m${(this.counter++).toString(36)}`;
    }
    buildReverseShortcuts() {
        this.reverseShortcuts = {};
        for (const [tag, short] of Object.entries(this.shortcuts)) {
            this.reverseShortcuts[short] = tag;
        }
    }
}
MarkerRegistryService.class = 'MarkerRegistryService';
// ─── Singleton ──────────────────────────────────────────────────
export const MarkerRegistry = new MarkerRegistryService();
export default MarkerRegistry;
//# sourceMappingURL=MarkerRegistry.js.map