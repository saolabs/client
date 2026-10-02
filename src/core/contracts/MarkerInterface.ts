

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
    /** Claim cặp marker SSR theo O(1) qua index (null = server không render vùng này) */
    claim(tag: string, id: string, scope?: Element | null): { open: Comment; close: Comment } | null;
    /** Bỏ index marker — gọi đầu mỗi lượt hydrate */
    invalidateIndex(): void;

}
