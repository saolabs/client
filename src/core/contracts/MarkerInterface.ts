

export interface MarkerRegistryRecord {
    /** Full tag name: 'reactive', 'block', 'foreach', etc. */
    tag: string;
    /** Unique ID for this marker (e.g. 'r:m0') */
    registryID: string;
    /** Arbitrary metadata */
    attributes: Record<string, any>;
}

export type MarkerTagName =
    | 'view' | 'component' | 'layout' | 'template'
    | 'block' | 'blockoutlet' | 'reactive' | 'section' | 'fragment'
    | 'for' | 'forin' | 'foreach' | 'while'
    | 'if' | 'switch'
    | 'include' | 'yield' | 'slot'
    | 'echo' | 'echoescaped'
    | 'useblock' | 'extend'
    | 'style' | 'script'
    | (string & {}); // Allow custom tags


// ─── MarkerRegistry Service ─────────────────────────────────────


export type MarkerFilter = string | Record<string, any>;
export interface MarkerRecord {
    name: string;
    tagName: string;
    registryID?: string | null;
    attributes: Record<string, any>;
    openTag: Comment;
    closeTag: Comment;
    children: Array<Node>;
    [key: string]: any;
}
export interface MarkupAttributes {
    [key: string]: string;
}

export interface MarkupQueryOptions {
    multiple?: boolean;
    recursive?: boolean;
}

export interface MarkupQuery {
    pattern: string;
    attributes?: MarkupAttributes;
    options?: MarkupQueryOptions;
    index?: number;
}

/**
 * RegistryTag Query Options
 */
export interface RegistryTagQueryOptions {
    tag?: string;
    id?: string;
    attributes?: Record<string, any>;
    multiple?: boolean;
}

/**
 * RegistryTagData
 */
export interface RegistryTagData {
    systemPrefix: string;
    tag: string;
    id: string;
    key: string;
    attributes?: Record<string, any>;
    nodes: Array<Node>;
}


export type RegistryIDOrAttributes = string | Record<string, any> | undefined;

export interface MarkerModelInterface {
    __update(data: Record<string, any>): this;
    tagName: string;
    fullName: string;
    registryID: string | undefined | null;
    openTag: Comment;
    closeTag: Comment;
    attributes: Record<string, any>;
    nodes: Array<Node>;
    systemPrefix: string | undefined;
    tag: string | undefined;
    id: string | undefined;
    key: string | undefined;
    data: Record<string, any> | undefined;
    outerHTML: string;
    innerHTML: string;
    getAttribute(name: string): string | undefined;
    setAttribute(name: string, value: string): this;
    __match(attributes: Record<string, any>): boolean;
    matchesAttributes(attributes: Record<string, any>): boolean;
    setAttributes(attributes: Record<string, any>): this;
    __scan(): Array<Node>;
    __sync(): boolean;
    updateNodes(nodes: Array<Node>): this;
    replaceContent(content: string | Node | Array<Node>): this;
    remove(): void;
}

export interface MarkerCollectionInterface {
    models: MarkerModelInterface[];
    length: number;
    first: MarkerModelInterface | undefined;
    last: MarkerModelInterface | undefined;
    get(index: number): MarkerModelInterface | undefined;
    set(index: number, model: MarkerModelInterface): this;
    push(model: MarkerModelInterface | MarkerRecord): this;
    pop(): MarkerModelInterface | undefined;
    shift(): MarkerModelInterface | undefined;
    unshift(model: MarkerModelInterface | MarkerRecord): this;
    splice(start: number, deleteCount: number, ...items: (MarkerModelInterface | MarkerRecord)[]): MarkerModelInterface[];
    slice(start?: number, end?: number): MarkerModelInterface[];
    concat(models: MarkerCollectionInterface | MarkerModelInterface[]): MarkerCollectionInterface;
    reverse(): MarkerCollectionInterface;
    map<T>(callback: (model: MarkerModelInterface, index: number, array: MarkerModelInterface[]) => T): T[];
    filter(callback: (model: MarkerModelInterface, index: number, array: MarkerModelInterface[]) => boolean): MarkerModelInterface[];
    reduce<T>(callback: (accumulator: T, model: MarkerModelInterface, index: number, array: MarkerModelInterface[]) => T, initialValue: T): T;
    forEach(callback: (model: MarkerModelInterface, index: number, array: MarkerModelInterface[]) => void): void;
    some(callback: (model: MarkerModelInterface, index: number, array: MarkerModelInterface[]) => boolean): boolean;
    every(callback: (model: MarkerModelInterface, index: number, array: MarkerModelInterface[]) => boolean): boolean;
    query(attributes?: Record<string, any>): MarkerModelInterface[];
}

export interface MarkerRegistryInterface {
    shortcut(tag: string): string;
    fullTag(shortcut: string): string;
    registerShortcut(tag: string, short: string): void;
    register(tag: string, id?: string, attributes?: Record<string, any>): string;
    createMarkerStart(tag: string, id?: string): Comment;
    createMarkerEnd(tag: string, id?: string): Comment;
    get(key: string): MarkerRegistryRecord | null;
    getByTagAndId(tag: string, id: string): MarkerRegistryRecord | null;
    has(key: string): boolean;
    remove(key: string): boolean;
    getByTag(tag: string): MarkerRegistryRecord[];
    all(): Map<string, MarkerRegistryRecord>;
    clear(): void;
    size: number;
    openComment(tag: string, id?: string): string;
    closeComment(tag: string, id?: string): string;
    parseComment(text: string): { tag: string; id: string; isClose: boolean } | null

}

// ─── MarkerService Interface ───────────────────────────────────

export interface MarkerServiceInterface {
    createMarker(data: MarkerRecord): MarkerModelInterface;
    queryMarkers(root: Node, query: MarkupQuery): Array<MarkerModelInterface> | MarkerModelInterface | null;
    queryRegistryTags(root: Node, options: RegistryTagQueryOptions): Array<MarkerModelInterface> | MarkerModelInterface | null;
    getMarkerData(marker: Comment): RegistryTagData | null;
}