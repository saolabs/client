import { MarkerFilter, MarkerRecord, RegistryIDOrAttributes } from "../contracts/MarkerInterface";
/**
 * OneMarker Model - Represents a custom marker element
 * Supports both:
 * - Generic markup: <tag>...</tag> or <!--tag-->...<!--/tag-->
 * - Registry tags: <!--o:r:id-->...<!--/o:r:id-->
 */
export declare class MarkerModel {
    private __openTag;
    private __closeTag;
    private __attributes;
    private __nodes;
    private __definedAttributes;
    private __tagName;
    private __fullName;
    private __registryID?;
    private __systemPrefix?;
    private __tag?;
    private __id?;
    private __key?;
    constructor(data: MarkerRecord);
    /**
     * Update model data
     */
    __update(data: Record<string, any>): this;
    /**
     * Define dynamic property accessors for attributes
     * @private
     */
    private __defineAttributes;
    /**
     * Define single attribute accessor
     * @private
     */
    private __defineAttribute;
    /**
     * Get tag name (without namespace)
     */
    get tagName(): string;
    /**
     * Get full name (with namespace)
     */
    get fullName(): string;
    get registryID(): string | undefined | null;
    /**
     * Get open tag node
     */
    get openTag(): Comment;
    /**
     * Get close tag node
     */
    get closeTag(): Comment;
    /**
     * Get all attributes
     */
    get attributes(): Record<string, any>;
    /**
     * Get nodes between open and close tags
     */
    get nodes(): Array<Node>;
    /**
     * Get system prefix (registry tags only)
     */
    get systemPrefix(): string | undefined;
    /**
     * Get tag (registry tags only)
     */
    get tag(): string | undefined;
    /**
     * Get ID (registry tags only)
     */
    get id(): string | undefined;
    /**
     * Get full key (registry tags only)
     */
    get key(): string | undefined;
    /**
     * Get full data (registry tags only)
     */
    get data(): Record<string, any> | undefined;
    /**
     * Get outer HTML including open/close tags and content
     */
    get outerHTML(): string;
    /**
     * Get inner HTML (content only, without open/close tags)
     */
    get innerHTML(): string;
    /**
     * Get HTML representation of a node
     * @private
     */
    private __getNodeHTML;
    /**
     * Get attribute value
     */
    getAttribute(name: string): string | undefined;
    /**
     * Set attribute value
     */
    setAttribute(name: string, value: string): this;
    /**
     * Check if model matches query attributes
     * @private
     */
    __match(attributes: Record<string, any>): boolean;
    /**
     * Check if model matches given attributes (for registry tag filtering)
     */
    matchesAttributes(attributes: Record<string, any>): boolean;
    /**
     * Set attributes from registry
     */
    setAttributes(attributes: Record<string, any>): this;
    /**
     * Scan and update nodes between open/close tags
     */
    __scan(): Array<Node>;
    /**
     * Sync with DOM (re-query and update)
     */
    __sync(): boolean;
    /**
     * Update nodes array
     */
    updateNodes(nodes: Array<Node>): this;
    /**
     * Replace content between open and close tags
     */
    replaceContent(content: string | Node | Array<Node>): this;
    /**
     * Remove element and its content from DOM
     */
    remove(): void;
}
/**
 * OneMarkerCollection - Collection of OneMarkerModel instances
 * Provides array-like operations with type safety
 */
export declare class MarkerCollection {
    private __models;
    constructor(elements?: Array<MarkerModel | MarkerRecord>);
    get models(): MarkerModel[];
    get length(): number;
    /**
     * Get the first model in the collection
     */
    get first(): MarkerModel | undefined;
    /**
     * Get the last model in the collection
     */
    get last(): MarkerModel | undefined;
    /**
     * Get the model at the given index
     */
    get(index: number): MarkerModel | undefined;
    /**
     * Set the model at the given index
     */
    set(index: number, model: MarkerModel): this;
    push(model: MarkerModel | MarkerRecord): this;
    pop(): MarkerModel | undefined;
    shift(): MarkerModel | undefined;
    unshift(model: MarkerModel | MarkerRecord): this;
    splice(start: number, deleteCount: number, ...items: MarkerModel[]): MarkerModel[];
    slice(start?: number, end?: number): MarkerModel[];
    concat(models: MarkerCollection | MarkerModel[]): MarkerCollection;
    reverse(): MarkerCollection;
    map<T>(callback: (model: MarkerModel, index: number, array: MarkerModel[]) => T): T[];
    filter(callback: (model: MarkerModel, index: number, array: MarkerModel[]) => boolean): MarkerModel[];
    reduce<T>(callback: (accumulator: T, model: MarkerModel, index: number, array: MarkerModel[]) => T, initialValue: T): T;
    forEach(callback: (model: MarkerModel, index: number, array: MarkerModel[]) => void): void;
    some(callback: (model: MarkerModel, index: number, array: MarkerModel[]) => boolean): boolean;
    every(callback: (model: MarkerModel, index: number, array: MarkerModel[]) => boolean): boolean;
    /**
     * Query the collection by attributes
     */
    query(attributes?: Record<string, any>): MarkerModel[];
    /**
     * Find first model matching attributes
     */
    find(attributes?: Record<string, any>): MarkerModel | null;
}
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
    createMarker(tag: string, id?: string, attributes?: Record<string, any>): MarkerModel;
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
    find(tagOrShortcut: string, where?: RegistryIDOrAttributes, useCache?: boolean): MarkerCollection;
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
    get(tagOrShortcut: string, where?: RegistryIDOrAttributes, index?: number, length?: number, useCache?: boolean): MarkerCollection;
    /**
     * Get first matching hydration marker
     *
     * @param tagOrShortcut - Tag name or shortcut
     * @param where - Registry ID or attributes filter
     * @returns First matched marker or null
     */
    first(tagOrShortcut: string, where?: RegistryIDOrAttributes, useCache?: boolean): MarkerModel | null;
    /**
     * Get last matching hydration marker
     *
     * @param tagOrShortcut - Tag name or shortcut
     * @param where - Registry ID or attributes filter
     * @returns Last matched marker or null
     */
    last(tagOrShortcut: string, where?: RegistryIDOrAttributes, useCache?: boolean): MarkerModel | null;
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
    once(tagOrShortcut: string, where?: RegistryIDOrAttributes, index?: number, useCache?: boolean): MarkerModel | null;
    /**
     * Create MarkerCollection from query results
     */
    collect(models: MarkerRecord[]): MarkerCollection;
    /**
     * Convert raw tag to MarkerModel
     */
    toModel(tag: MarkerRecord): MarkerModel;
}
export declare const OneMarker: MarkerService;
//# sourceMappingURL=MarkerService.d.ts.map