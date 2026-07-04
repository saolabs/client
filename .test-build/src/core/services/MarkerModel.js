"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkerCollection = exports.MarkerModel = void 0;
/**
 * SaoMarker Model - Represents a custom marker element
 * Supports both:
 * - Generic markup: <tag>...</tag> or <!--tag-->...<!--/tag-->
 * - Registry tags: <!--o:r:id-->...<!--/o:r:id-->
 */
class MarkerModel {
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
exports.MarkerModel = MarkerModel;
/**
 * SaoMarkerCollection - Collection of SaoMarkerModel instances
 * Provides array-like operations with type safety
 */
class MarkerCollection {
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
exports.MarkerCollection = MarkerCollection;
