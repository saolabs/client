import { MarkerCollectionInterface, MarkerModelInterface, MarkerRecord } from "../contracts/MarkerInterface";
/**
 * SaoMarker Model - Represents a custom marker element
 * Supports both:
 * - Generic markup: <tag>...</tag> or <!--tag-->...<!--/tag-->
 * - Registry tags: <!--o:r:id-->...<!--/o:r:id-->
 */
export declare class MarkerModel implements MarkerModelInterface {
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
 * SaoMarkerCollection - Collection of SaoMarkerModel instances
 * Provides array-like operations with type safety
 */
export declare class MarkerCollection implements MarkerCollectionInterface {
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
//# sourceMappingURL=MarkerModel.d.ts.map