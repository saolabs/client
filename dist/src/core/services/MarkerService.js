import { app } from "../hellpers/app";
import { generateUUID } from "../hellpers/utils";
import { MarkerRegistry } from "./MarkerRegistry";
/**
 * SaoMarker Model - Represents a custom marker element
 * Supports both:
 * - Generic markup: <tag>...</tag> or <!--tag-->...<!--/tag-->
 * - Registry tags: <!--o:r:id-->...<!--/o:r:id-->
 */
export class MarkerModel {
    constructor(data) {
        this.__fullName = data.name;
        this.__tagName = data.name.split(':')[1] || data.name;
        this.__registryID = data.registryID;
        this.__openTag = data.openTag;
        this.__closeTag = data.closeTag;
        this.__attributes = data.attributes;
        this.__nodes = data.children || [];
        this.__definedAttributes = [];
        this.__defineAttributes(Object.keys(data.attributes));
    }
    /**
     * Update model data
     */
    __update(data) {
        this.__fullName = data.name;
        this.__tagName = data.name.split(':')[1] || data.name;
        this.__registryID = data.registryID;
        this.__openTag = data.openTag;
        this.__closeTag = data.closeTag;
        this.__attributes = data.attributes;
        this.__nodes = data.children || [];
        this.__defineAttributes(Object.keys(data.attributes));
        return this;
    }
    /**
     * Define dynamic property accessors for attributes
     * @private
     */
    __defineAttributes(attributeKeys) {
        attributeKeys.forEach(key => this.__defineAttribute(key));
        return this;
    }
    /**
     * Define single attribute accessor
     * @private
     */
    __defineAttribute(name) {
        if (this.__definedAttributes.includes(name)) {
            return this;
        }
        this.__definedAttributes.push(name);
        Object.defineProperty(this, name, {
            get: () => this.__attributes[name],
            set: (value) => {
                this.__attributes[name] = value;
            },
            enumerable: true,
            configurable: true,
        });
        return this;
    }
    /**
     * Get tag name (without namespace)
     */
    get tagName() {
        return this.__tagName;
    }
    /**
     * Get full name (with namespace)
     */
    get fullName() {
        return this.__fullName;
    }
    get registryID() {
        return this.__registryID;
    }
    /**
     * Get open tag node
     */
    get openTag() {
        return this.__openTag;
    }
    /**
     * Get close tag node
     */
    get closeTag() {
        return this.__closeTag;
    }
    /**
     * Get all attributes
     */
    get attributes() {
        return this.__attributes;
    }
    /**
     * Get nodes between open and close tags
     */
    get nodes() {
        return this.__nodes;
    }
    /**
     * Get system prefix (registry tags only)
     */
    get systemPrefix() {
        return this.__systemPrefix;
    }
    /**
     * Get tag (registry tags only)
     */
    get tag() {
        return this.__tag;
    }
    /**
     * Get ID (registry tags only)
     */
    get id() {
        return this.__id;
    }
    /**
     * Get full key (registry tags only)
     */
    get key() {
        return this.__key;
    }
    /**
     * Get full data (registry tags only)
     */
    get data() {
        if (!this.__systemPrefix)
            return undefined;
        return {
            systemPrefix: this.__systemPrefix,
            tag: this.__tag,
            id: this.__id,
            key: this.__key,
            attributes: this.__attributes,
            nodes: this.__nodes
        };
    }
    /**
     * Get outer HTML including open/close tags and content
     */
    get outerHTML() {
        let html = '';
        html += this.__getNodeHTML(this.__openTag);
        let currentNode = this.__openTag.nextSibling;
        while (currentNode && currentNode !== this.__closeTag) {
            html += this.__getNodeHTML(currentNode);
            currentNode = currentNode.nextSibling;
        }
        html += this.__getNodeHTML(this.__closeTag);
        return html;
    }
    /**
     * Get inner HTML (content only, without open/close tags)
     */
    get innerHTML() {
        let html = '';
        let currentNode = this.__openTag.nextSibling;
        while (currentNode && currentNode !== this.__closeTag) {
            html += this.__getNodeHTML(currentNode);
            currentNode = currentNode.nextSibling;
        }
        return html;
    }
    /**
     * Get HTML representation of a node
     * @private
     */
    __getNodeHTML(node) {
        if (!node)
            return '';
        switch (node.nodeType) {
            case Node.COMMENT_NODE:
                return `<!--${node.nodeValue}-->`;
            case Node.TEXT_NODE:
                return node.textContent || '';
            case Node.ELEMENT_NODE:
                return node.outerHTML || '';
            default:
                return node.textContent || '';
        }
    }
    /**
     * Get attribute value
     */
    getAttribute(name) {
        return this.__attributes[name];
    }
    /**
     * Set attribute value
     */
    setAttribute(name, value) {
        this.__defineAttribute(name);
        this.__attributes[name] = value;
        return this;
    }
    /**
     * Check if model matches query attributes
     * @private
     */
    __match(attributes) {
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'tagName') {
                if (this.__tagName !== value)
                    return false;
            }
            else if (key === 'openTag') {
                if (this.__openTag !== value)
                    return false;
            }
            else if (key === 'closeTag') {
                if (this.__closeTag !== value)
                    return false;
            }
            else if (key === 'attributes' || key === 'nodes') {
                continue;
            }
            else if (this.__attributes[key] !== value) {
                return false;
            }
        }
        return true;
    }
    /**
     * Check if model matches given attributes (for registry tag filtering)
     */
    matchesAttributes(attributes) {
        if (!attributes || Object.keys(attributes).length === 0) {
            return true;
        }
        for (const [key, value] of Object.entries(attributes)) {
            if (this.__attributes?.[key] !== value) {
                return false;
            }
        }
        return true;
    }
    /**
     * Set attributes from registry
     */
    setAttributes(attributes) {
        Object.assign(this.__attributes, attributes);
        this.__defineAttributes(Object.keys(attributes));
        return this;
    }
    /**
     * Scan and update nodes between open/close tags
     */
    __scan() {
        const nodes = [];
        let currentNode = this.__openTag.nextSibling;
        while (currentNode && currentNode !== this.__closeTag) {
            nodes.push(currentNode);
            currentNode = currentNode.nextSibling;
        }
        this.__nodes = nodes;
        return this.__nodes;
    }
    /**
     * Sync with DOM (re-query and update)
     */
    __sync() {
        // Placeholder for sync logic
        // In V1, this uses oms.find() which requires SaoMarkerService
        return false;
    }
    /**
     * Update nodes array
     */
    updateNodes(nodes) {
        this.__nodes = nodes;
        return this;
    }
    /**
     * Replace content between open and close tags
     */
    replaceContent(content) {
        // Remove existing nodes
        this.__nodes.forEach(node => {
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        });
        this.__nodes = [];
        // Insert new content
        const closeTag = this.__closeTag;
        if (typeof content === 'string') {
            const temp = document.createElement('div');
            temp.innerHTML = content;
            const fragment = document.createDocumentFragment();
            Array.from(temp.childNodes).forEach(node => fragment.appendChild(node));
            if (closeTag.parentNode) {
                closeTag.parentNode.insertBefore(fragment, closeTag);
            }
        }
        else if (content instanceof Node) {
            if (closeTag.parentNode) {
                closeTag.parentNode.insertBefore(content, closeTag);
            }
        }
        else if (Array.isArray(content)) {
            const fragment = document.createDocumentFragment();
            content.forEach(node => fragment.appendChild(node));
            if (closeTag.parentNode) {
                closeTag.parentNode.insertBefore(fragment, closeTag);
            }
        }
        // Rescan nodes
        this.__scan();
        return this;
    }
    /**
     * Remove element and its content from DOM
     */
    remove() {
        // Remove all nodes
        this.__nodes.forEach(node => {
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        });
        // Remove open and close tags
        if (this.__openTag.parentNode) {
            this.__openTag.parentNode.removeChild(this.__openTag);
        }
        if (this.__closeTag.parentNode) {
            this.__closeTag.parentNode.removeChild(this.__closeTag);
        }
        this.__nodes = [];
    }
}
/**
 * SaoMarkerCollection - Collection of SaoMarkerModel instances
 * Provides array-like operations with type safety
 */
export class MarkerCollection {
    constructor(elements = []) {
        this.__models = elements.map(element => (element instanceof MarkerModel) ? element : new MarkerModel(element));
    }
    get models() {
        return this.__models;
    }
    get length() {
        return this.__models.length;
    }
    /**
     * Get the first model in the collection
     */
    get first() {
        return this.__models[0];
    }
    /**
     * Get the last model in the collection
     */
    get last() {
        return this.__models[this.__models.length - 1];
    }
    /**
     * Get the model at the given index
     */
    get(index) {
        return this.__models[index];
    }
    /**
     * Set the model at the given index
     */
    set(index, model) {
        this.__models[index] = model;
        return this;
    }
    push(model) {
        if (!(model instanceof MarkerModel)) {
            model = new MarkerModel(model);
        }
        this.__models.push(model);
        return this;
    }
    pop() {
        return this.__models.pop();
    }
    shift() {
        return this.__models.shift();
    }
    unshift(model) {
        if (!(model instanceof MarkerModel)) {
            model = new MarkerModel(model);
        }
        this.__models.unshift(model);
        return this;
    }
    splice(start, deleteCount, ...items) {
        return this.__models.splice(start, deleteCount, ...items);
    }
    slice(start, end) {
        return this.__models.slice(start, end);
    }
    concat(models) {
        const otherModels = (models instanceof MarkerCollection) ? models.__models : models;
        return new MarkerCollection(this.__models.concat(otherModels));
    }
    reverse() {
        return new MarkerCollection([...this.__models].reverse());
    }
    map(callback) {
        return this.__models.map(callback);
    }
    filter(callback) {
        return this.__models.filter(callback);
    }
    reduce(callback, initialValue) {
        return this.__models.reduce(callback, initialValue);
    }
    forEach(callback) {
        this.__models.forEach(callback);
    }
    some(callback) {
        return this.__models.some(callback);
    }
    every(callback) {
        return this.__models.every(callback);
    }
    /**
     * Query the collection by attributes
     */
    query(attributes = {}) {
        return this.__models.filter(model => model.__match(attributes));
    }
    /**
     * Find first model matching attributes
     */
    find(attributes = {}) {
        return this.query(attributes)[0] || null;
    }
}
/**
 * Marker Service - Manages custom markup elements
 * Supports both HydrationMarker (comments)
 */
export class MarkerService {
    constructor(rootElement) {
        this.prefix = 'o';
        this.delimiter = ':';
        this.closeTagSuffix = '/';
        this.markerRegistry = MarkerRegistry;
        this.rootElement = (rootElement instanceof Element) ? rootElement : document.body;
        this.walker = document.createTreeWalker(this.rootElement, NodeFilter.SHOW_COMMENT, null);
    }
    refreshWalker() {
        this.walker = document.createTreeWalker(this.rootElement, NodeFilter.SHOW_COMMENT, null);
        return this;
    }
    addRegistry(tag, id, attributes = {}) {
        return this.markerRegistry.register(tag, id, attributes);
    }
    resolveTagName(tagShortcut) {
        return this.markerRegistry.fullTag(tagShortcut);
    }
    getShortcut(tagName) {
        return this.markerRegistry.shortcut(tagName);
    }
    /**
     * Check if registryIDOrAttributes is a registryID (string) or attributes (object)
     */
    parseRegistryIDOrAttributes(value) {
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
    getAttributesFromRegistry(tagName, registryID) {
        const record = this.markerRegistry.getByTagAndId(tagName, registryID);
        return record?.attributes || {};
    }
    /**
     * Check if attributes match filter
     */
    attributesMatch(tagAttributes, filter) {
        if (!filter)
            return true;
        for (const [key, value] of Object.entries(filter)) {
            if (value !== undefined && tagAttributes[key] !== value) {
                return false;
            }
        }
        return true;
    }
    createMarker(tag, id, attributes = {}) {
        const name = this.markerRegistry.fullTag(tag);
        const registryID = id ?? generateUUID();
        const key = this.markerRegistry.register(tag, registryID, attributes);
        const openTag = this.markerRegistry.createMarkerStart(tag, registryID);
        const closeTag = this.markerRegistry.createMarkerEnd(tag, registryID);
        // Register in MarkerRegistry
        return new MarkerModel({
            name,
            tagName: (this.prefix ? this.prefix + this.delimiter : '') + tag,
            registryID,
            openTag,
            closeTag,
            attributes,
            children: []
        });
    }
    createOpenMarker(tag, id) {
        return this.markerRegistry.createMarkerStart(tag, id);
    }
    createCloseMarker(tag, id) {
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
    query(tagOrShortcut, where, useCache = true) {
        const { registryID, attributes: attributeFilter } = this.parseRegistryIDOrAttributes(where);
        const results = [];
        if (!(useCache === true)) {
            this.refreshWalker();
        }
        const walker = this.walker;
        const commentNodes = [];
        let comment;
        while ((comment = walker.nextNode())) {
            commentNodes.push(comment);
        }
        const tagShortcut = this.markerRegistry.shortcut(tagOrShortcut);
        const stack = [];
        // Process comments with stack-based matching
        for (let i = 0; i < commentNodes.length; i++) {
            const commentText = commentNodes[i].nodeValue?.trim() || '';
            // Check if open tag: prefix:shortcut:registryID
            const openMatch = commentText.match(new RegExp(`^${this.prefix}${this.delimiter}([^${this.delimiter}/]+)${this.delimiter}(.+)$`));
            if (openMatch) {
                const shortcut = openMatch[1];
                const id = openMatch[2];
                // Check if matches requested tag and registryID
                if (shortcut === tagShortcut) {
                    if (registryID && id !== registryID) {
                        continue; // Skip if specific registryID requested
                    }
                    const attrs = this.getAttributesFromRegistry(tagOrShortcut, id);
                    if (!this.attributesMatch(attrs, attributeFilter)) {
                        continue; // Skip if attributes don't match
                    }
                    stack.push({
                        index: i,
                        shortcut,
                        registryID: id,
                        attributes: attrs
                    });
                }
                continue;
            }
            // Check if close tag: /prefix:shortcut:registryID
            const closeMatch = commentText.match(new RegExp(`^${this.closeTagSuffix}${this.prefix}${this.delimiter}([^${this.delimiter}/]+)${this.delimiter}(.+)$`));
            if (closeMatch) {
                const shortcut = closeMatch[1];
                const id = closeMatch[2];
                // Find matching open tag in stack (LIFO)
                let foundIndex = -1;
                for (let s = stack.length - 1; s >= 0; s--) {
                    if (stack[s].shortcut === shortcut && stack[s].registryID === id) {
                        foundIndex = s;
                        break;
                    }
                }
                if (foundIndex !== -1) {
                    const openTag = stack[foundIndex];
                    // Get children between open and close
                    let currentNode = commentNodes[openTag.index].nextSibling;
                    const children = [];
                    while (currentNode && currentNode !== commentNodes[i]) {
                        children.push(currentNode);
                        currentNode = currentNode.nextSibling;
                    }
                    const fullTagName = this.resolveTagName(openTag.shortcut);
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
            }
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
    find(tagOrShortcut, where, useCache = true) {
        return this.collect(this.query(tagOrShortcut, where, useCache));
    }
    getResults(tagOrShortcut, where, index, length, useCache = true) {
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
    get(tagOrShortcut, where, index, length, useCache = true) {
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
    first(tagOrShortcut, where, useCache = true) {
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
    last(tagOrShortcut, where, useCache = true) {
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
    once(tagOrShortcut, where, index, useCache = true) {
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
    collect(models) {
        return new MarkerCollection(models);
    }
    /**
     * Convert raw tag to MarkerModel
     */
    toModel(tag) {
        return new MarkerModel(tag);
    }
}
MarkerService.class = 'HydrationMarker';
export const SaoMarker = app(MarkerService);
//# sourceMappingURL=MarkerService.js.map