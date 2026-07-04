import { MarkerCollectionInterface, MarkerFilter, MarkerModelInterface, MarkerRecord, RegistryIDOrAttributes } from "../contracts/MarkerInterface";
/**
 * Marker Service - Manages custom markup elements
 * Supports both HydrationMarker (comments)
 */
export declare class MarkerService {
    static class: string;
    private prefix;
    private delimiter;
    private closeTagSuffix;
    private rootElement;
    private markerRegistry;
    private walker;
    constructor(rootElement?: Element);
    refreshWalker(): this;
    addRegistry(tag: string, id?: string, attributes?: Record<string, any>): string;
    resolveTagName(tagShortcut: string): string;
    getShortcut(tagName: string): string;
    /**
     * Check if registryIDOrAttributes is a registryID (string) or attributes (object)
     */
    private parseRegistryIDOrAttributes;
    /**
     * Get attributes from MarkerRegistry if registryID provided
     */
    private getAttributesFromRegistry;
    /**
     * Check if attributes match filter
     */
    private attributesMatch;
    createMarker(tag: string, id?: string, attributes?: Record<string, any>): MarkerModelInterface;
    createOpenMarker(tag: string, id?: string): Comment;
    createCloseMarker(tag: string, id?: string): Comment;
    /**
     * Query hydration markers in HTML comments
     * Works with format: <!--prefix:shortcutTag:registryID-->
     *
     * @param tagOrShortcut - Tag name or shortcut (r, v, c, etc.)
     * @param where - Registry ID (string) or attributes filter (object)
     * @returns Array of matched markers
     *
     * @example
     * query("r", "1234")                    // Find o:r:1234
     * query("reactive", "1234")             // Find o:r:1234 (resolved from shortcut)
     * query("r", { userId: "123" })        // Find o:r:* with userId="123"
     */
    query(tagOrShortcut: string, where?: MarkerFilter, useCache?: boolean): MarkerRecord[];
    /**
     * Find multiple hydration markers by tag and optional ID/attributes
     * Flexible API supporting multiple query styles
     *
     * @param tagOrShortcut - Tag name or shortcut (r, v, c, etc.)
     * @param registryIDOrAttributes - Optional registry ID (string) or attributes filter (object)
     * @returns Array of all matched markers
     *
     * @example
     * find("r")                              // All o:r:*
     * find("reactive")                       // All o:r:* (resolved from shortcut)
     * find("r", "1234")                      // All o:r:1234 (usually one)
     * find("r", { userId: "123" })          // All o:r:* with userId="123"
     */
    find(tagOrShortcut: string, where?: RegistryIDOrAttributes, useCache?: boolean): MarkerCollectionInterface;
    getResults(tagOrShortcut: string, where?: RegistryIDOrAttributes, index?: number, length?: number, useCache?: boolean): MarkerRecord[];
    /**
     * Get hydration markers with index and length support
     *
     * @param tagOrShortcut - Tag name or shortcut
     * @param where - Registry ID or attributes filter
     * @param index - Start position (default 0): >= 0 positive, < 0 negative from end
     * @param length - Number to return (default 0 = all): > 0 returns exactly that many
     * @returns Array of matched markers
     *
     * @example
     * get("r", "1234")                    // All o:r:1234
     * get("r", "1234", 1)                 // From index 1
     * get("r", "1234", 0, 2)              // First 2 items
     * get("r", {}, -1)                    // Last item
     */
    get(tagOrShortcut: string, where?: RegistryIDOrAttributes, index?: number, length?: number, useCache?: boolean): MarkerCollectionInterface;
    /**
     * Get first matching hydration marker
     *
     * @param tagOrShortcut - Tag name or shortcut
     * @param where - Registry ID or attributes filter
     * @returns First matched marker or null
     */
    first(tagOrShortcut: string, where?: RegistryIDOrAttributes, useCache?: boolean): MarkerModelInterface | null;
    /**
     * Get last matching hydration marker
     *
     * @param tagOrShortcut - Tag name or shortcut
     * @param where - Registry ID or attributes filter
     * @returns Last matched marker or null
     */
    last(tagOrShortcut: string, where?: RegistryIDOrAttributes, useCache?: boolean): MarkerModelInterface | null;
    /**
     * Get exactly one matching hydration marker
     * Throws error if not found or multiple matches found
     *
     * @param tagOrShortcut - Tag name or shortcut
     * @param where - Registry ID or attributes filter
     * @param index - Start position (default 0)
     * @returns Exactly one matched marker
     * @throws Error if no match or multiple matches
     */
    once(tagOrShortcut: string, where?: RegistryIDOrAttributes, index?: number, useCache?: boolean): MarkerModelInterface | null;
    /**
     * Create MarkerCollection from query results
     */
    collect(models: MarkerRecord[]): MarkerCollectionInterface;
    /**
     * Convert raw tag to MarkerModel
     */
    toModel(tag: MarkerRecord): MarkerModelInterface;
}
export declare const SaoMarker: MarkerService;
//# sourceMappingURL=MarkerService.d.ts.map