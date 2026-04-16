export interface MarkerRegistryRecord {
    /** Full tag name: 'reactive', 'block', 'foreach', etc. */
    tag: string;
    /** Unique ID for this marker (e.g. 'r:m0') */
    registryID: string;
    /** Arbitrary metadata */
    attributes: Record<string, any>;
}
export type MarkerTagName = 'view' | 'component' | 'layout' | 'template' | 'block' | 'blockoutlet' | 'reactive' | 'section' | 'fragment' | 'for' | 'forin' | 'foreach' | 'while' | 'if' | 'switch' | 'include' | 'yield' | 'slot' | 'echo' | 'echoescaped' | 'useblock' | 'extend' | 'style' | 'script' | (string & {});
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
//# sourceMappingURL=MarkerInterface.d.ts.map