import { MarkerCollectionInterface, MarkerFilter, MarkerModelInterface, MarkerRecord, RegistryIDOrAttributes } from "../contracts/MarkerInterface.js";
import { app } from "../helpers/app.js";
import { generateUUID } from "../helpers/utils.js";
import { MarkerCollection, MarkerModel } from "./MarkerModel.js";
import { MarkerRegistry, MarkerRegistryService } from "./MarkerRegistry.js";




/**
 * Marker Service - Manages custom markup elements
 * Supports both HydrationMarker (comments) 
 */
export class MarkerService {

    static class: string = 'HydrationMarker';

    private prefix: string = 's';
    private delimiter: string = ':';
    private closeTagSuffix: string = '/';
    private rootElement: Element;
    private markerRegistry: MarkerRegistryService;
    private walker: TreeWalker;

    constructor(rootElement?: Element) {
        this.markerRegistry = MarkerRegistry;
        this.rootElement = (rootElement instanceof Element) ? rootElement : document.body;
        this.walker = document.createTreeWalker(
            this.rootElement,
            NodeFilter.SHOW_COMMENT,
            null
        );
    }
    refreshWalker() {
        this.walker = document.createTreeWalker(
            this.rootElement,
            NodeFilter.SHOW_COMMENT,
            null
        );

        return this;
    }

    addRegistry(tag: string, id?: string, attributes: Record<string, any> = {}): string {
        return this.markerRegistry.register(tag, id, attributes);
    }

    resolveTagName(tagShortcut: string): string {
        return this.markerRegistry.fullTag(tagShortcut);
    }
    getShortcut(tagName: string): string {
        return this.markerRegistry.shortcut(tagName);
    }

    /**
     * Check if registryIDOrAttributes is a registryID (string) or attributes (object)
     */
    private parseRegistryIDOrAttributes(
        value?: MarkerFilter
    ): { registryID?: string; attributes?: Record<string, any> } {
        if (typeof value === 'string') {
            return { registryID: value };
        }
        if (typeof value === 'object' && value !== null) {
            const registryID = typeof value['registryID'] === 'string' ? value['registryID'] : undefined;
            if (registryID) {
                delete value['registryID'];
            }
            return { registryID, attributes: value };
        }
        return {};
    }

    /**
     * Get attributes from MarkerRegistry if registryID provided
     */
    private getAttributesFromRegistry(
        tagName: string,
        registryID: string
    ): Record<string, any> {
        const record = this.markerRegistry.getByTagAndId(tagName, registryID);
        return record?.attributes || {};
    }

    /**
     * Check if attributes match filter
     */
    private attributesMatch(
        tagAttributes: Record<string, any>,
        filter?: Record<string, any>
    ): boolean {
        if (!filter) return true;

        for (const [key, value] of Object.entries(filter)) {
            if (value !== undefined && tagAttributes[key] !== value) {
                return false;
            }
        }

        return true;
    }

    createMarker(tag: string, id?: string, attributes: Record<string, any> = {}): MarkerModelInterface {
        const name = this.markerRegistry.fullTag(tag);
        const registryID = id ?? generateUUID();
        const key = this.markerRegistry.register(tag, registryID, attributes);
        const openTag = this.markerRegistry.createMarkerStart(tag, registryID);
        const closeTag = this.markerRegistry.createMarkerEnd(tag, registryID);

        
        // Register in MarkerRegistry

        return new MarkerModel({
            name,
            tagName: (this.prefix? this.prefix + this.delimiter : '') + tag,
            registryID,
            openTag,
            closeTag,
            attributes,
            children: []
        });
    }

    createOpenMarker(tag: string, id?: string): Comment {
        return this.markerRegistry.createMarkerStart(tag, id);
    }
    createCloseMarker(tag: string, id?: string): Comment {
        return this.markerRegistry.createMarkerEnd(tag, id);
    }


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
    query(
        tagOrShortcut: string,
        where?: MarkerFilter,
        useCache: boolean = true
    ): MarkerRecord[] {
        const { registryID, attributes: attributeFilter } = this.parseRegistryIDOrAttributes(
            where
        );

        const tagShortcutEarly = this.markerRegistry.shortcut(tagOrShortcut);
        const fullTagEarly = this.markerRegistry.fullTag(tagShortcutEarly);

        // Biết chính xác (tag, id) → tra thẳng index của MarkerRegistry: O(1),
        // không duyệt toàn bộ comment của tài liệu. Chỉ dùng khi root là
        // document.body vì index dựng trên đó; root tuỳ biến đi đường quét.
        if (registryID && this.rootElement === document.body) {
            const pair = this.markerRegistry.claim(fullTagEarly, registryID);
            if (!pair) return [];

            const attrs = this.getAttributesFromRegistry(tagOrShortcut, registryID);
            if (!this.attributesMatch(attrs, attributeFilter)) return [];

            const children: Node[] = [];
            for (let node = pair.open.nextSibling; node && node !== pair.close; node = node.nextSibling) {
                children.push(node);
            }

            return [{
                name: fullTagEarly,
                tagName: tagShortcutEarly,
                registryID,
                attributes: attrs,
                openTag: pair.open,
                closeTag: pair.close,
                children,
            }];
        }

        const results: MarkerRecord[] = [];
        if (!(useCache === true)) {
            this.refreshWalker();
        }
        const walker = this.walker;
        // TreeWalker nhớ currentNode giữa các lần gọi. Không reset thì query
        // thứ HAI trở đi nextNode() trả null ngay → mọi marker "biến mất"
        // (đây là lý do chỉ @block đầu tiên hydrate được).
        walker.currentNode = this.rootElement;

        const commentNodes: Comment[] = [];
        let comment: Comment | null;
        while ((comment = walker.nextNode() as Comment | null)) {
            commentNodes.push(comment);
        }

        const tagShortcut = tagShortcutEarly;
        const fullTagName = fullTagEarly;
        const stack: Array<{
            index: number;
            shortcut: string;
            registryID: string;
            attributes: Record<string, any>;
        }> = [];

        // Parse bằng string ops của MarkerRegistry (trước đây dựng 2 RegExp MỚI
        // cho MỖI comment node — chi phí lớn nhất của vòng lặp này).
        for (let i = 0; i < commentNodes.length; i++) {
            const parsed = this.markerRegistry.parseComment(commentNodes[i].nodeValue ?? '');
            if (!parsed || parsed.tag !== fullTagName) continue;

            // Open tag (format chuẩn §5.1): s:{shortcut}:{id}-s
            if (!parsed.isClose) {
                if (registryID && parsed.id !== registryID) {
                    continue; // Skip if specific registryID requested
                }

                const attrs = this.getAttributesFromRegistry(tagOrShortcut, parsed.id);
                if (!this.attributesMatch(attrs, attributeFilter)) {
                    continue; // Skip if attributes don't match
                }

                stack.push({
                    index: i,
                    shortcut: tagShortcut,
                    registryID: parsed.id,
                    attributes: attrs
                });
                continue;
            }

            // Close tag (format chuẩn §5.1): s:{shortcut}:{id}-e
            // Tìm open tag khớp trong stack (LIFO)
            let foundIndex = -1;
            for (let sIdx = stack.length - 1; sIdx >= 0; sIdx--) {
                if (stack[sIdx].registryID === parsed.id) {
                    foundIndex = sIdx;
                    break;
                }
            }
            if (foundIndex === -1) continue;

            const openTag = stack[foundIndex];

            // Get children between open and close
            let currentNode: Node | null = commentNodes[openTag.index].nextSibling;
            const children: Node[] = [];

            while (currentNode && currentNode !== commentNodes[i]) {
                children.push(currentNode);
                currentNode = currentNode.nextSibling;
            }

            results.push({
                name: fullTagName,
                tagName: openTag.shortcut,
                registryID: openTag.registryID,
                attributes: openTag.attributes,
                openTag: commentNodes[openTag.index],
                closeTag: commentNodes[i],
                children
            });

            stack.splice(foundIndex, 1);
        }

        return results;
    }


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
    find(
        tagOrShortcut: string,
        where?: RegistryIDOrAttributes,
        useCache: boolean = true
    ): MarkerCollectionInterface {
        return this.collect(this.query(tagOrShortcut, where, useCache));
    }


    getResults(
        tagOrShortcut: string,
        where?: RegistryIDOrAttributes,
        index?: number,
        length?: number,
        useCache: boolean = true
    ): MarkerRecord[] {
        const startIndex = (typeof index === 'number' && index !== null) ? index : 0;
        const takeLength = (typeof length === 'number' && length !== null && length > 0) ? length : 0;

        const allResults = this.query(tagOrShortcut, where, useCache);

        // Handle positive index
        if (startIndex >= 0) {
            const sliced = allResults.slice(startIndex);
            if (takeLength > 0) {
                return sliced.slice(0, takeLength);
            }
            return sliced;
        }

        // Handle negative index
        const sliced = allResults.slice(startIndex);
        if (takeLength > 0) {
            return sliced.slice(0, takeLength);
        }
        return sliced;
    }

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
    get(
        tagOrShortcut: string,
        where?: RegistryIDOrAttributes,
        index?: number,
        length?: number,
        useCache: boolean = true
    ): MarkerCollectionInterface {
        const results = this.getResults(tagOrShortcut, where, index, length, useCache);
        return this.collect(results);
    }

    /**
     * Get first matching hydration marker
     * 
     * @param tagOrShortcut - Tag name or shortcut
     * @param where - Registry ID or attributes filter
     * @returns First matched marker or null
     */
    first(
        tagOrShortcut: string,
        where?: RegistryIDOrAttributes,
        useCache: boolean = true
    ): MarkerModelInterface | null {
        const results = this.getResults(tagOrShortcut, where, 0, 1, useCache);
        return results.length > 0 ? this.toModel(results[0]) : null;
    }

    /**
     * Get last matching hydration marker
     * 
     * @param tagOrShortcut - Tag name or shortcut
     * @param where - Registry ID or attributes filter
     * @returns Last matched marker or null
     */
    last(
        tagOrShortcut: string,
        where?: RegistryIDOrAttributes,
        useCache: boolean = true
    ): MarkerModelInterface | null {
        const results = this.getResults(tagOrShortcut, where, -1, 1, useCache);
        return results.length > 0 ? this.toModel(results[0]) : null;
    }

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
    once(
        tagOrShortcut: string,
        where?: RegistryIDOrAttributes,
        index?: number,
        useCache: boolean = true
    ): MarkerModelInterface | null {
        const startIndex = (typeof index === 'number' && index !== null) ? index : 0;
        const results = this.getResults(tagOrShortcut, where, startIndex, 1, useCache);

        if (!results || results.length === 0) {
            return null; // Or throw new Error(`HydrationMarker: No marker found for "${tagOrShortcut}" with specified criteria`);
        }

        return this.toModel(results[0]);
    }



    /**
     * Create MarkerCollection from query results
     */
    collect(models: MarkerRecord[]): MarkerCollectionInterface {
        return new MarkerCollection(models);
    }

    /**
     * Convert raw tag to MarkerModel
     */
    toModel(tag: MarkerRecord): MarkerModelInterface {
        return new MarkerModel(
            tag
        );
    }
}

export const SaoMarker: MarkerService = app<MarkerService>(MarkerService) as MarkerService;