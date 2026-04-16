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
import { MarkerRegistryRecord } from "../contracts/MarkerInterface";
export declare class MarkerRegistryService {
    static class: string;
    /** Tag name → short abbreviation (for compact DOM comments) */
    private shortcuts;
    /** Reverse lookup: shortcut → full tag name */
    private reverseShortcuts;
    /** All registered marker records, keyed by composite key (e.g. 'r:abc123') */
    private records;
    /** Delimiter between tag shortcut and ID in keys */
    private delimiter;
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
     * Create a comment string for a marker (open).
     * e.g. 'r:abc123' for <!--r:abc123-->
     */
    openComment(tag: string, id?: string): string;
    /**
     * Create a comment string for a closing marker.
     * e.g. '/r:abc123' for <!--/r:abc123-->
     */
    closeComment(tag: string, id?: string): string;
    /**
     * Parse a comment node's text to extract tag and id.
     * '  r:abc123  ' → { tag: 'reactive', id: 'abc123', isClose: false }
     * ' /r:abc123 '  → { tag: 'reactive', id: 'abc123', isClose: true }
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