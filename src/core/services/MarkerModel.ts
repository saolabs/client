import { MarkerCollectionInterface, MarkerModelInterface, MarkerRecord } from "../contracts/MarkerInterface";

/**
 * OneMarker Model - Represents a custom marker element
 * Supports both:
 * - Generic markup: <tag>...</tag> or <!--tag-->...<!--/tag-->
 * - Registry tags: <!--o:r:id-->...<!--/o:r:id-->
 */
export class MarkerModel implements MarkerModelInterface {
    private __openTag: Comment;
    private __closeTag: Comment;
    private __attributes: Record<string, any>;
    private __nodes: Array<Node>;
    private __definedAttributes: string[];
    private __tagName: string;
    private __fullName: string;
    private __registryID?: string | undefined | null;
    // Registry tag specific properties (optional)
    private __systemPrefix?: string;
    private __tag?: string;
    private __id?: string;
    private __key?: string;

    constructor(
        data: MarkerRecord
    ) {
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
    __update(
        data: Record<string, any>
    ): this {
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
    private __defineAttributes(attributeKeys: string[]): this {
        attributeKeys.forEach(key => this.__defineAttribute(key));
        return this;
    }

    /**
     * Define single attribute accessor
     * @private
     */
    private __defineAttribute(name: string): this {
        if (this.__definedAttributes.includes(name)) {
            return this;
        }

        this.__definedAttributes.push(name);
        Object.defineProperty(this, name, {
            get: () => this.__attributes[name],
            set: (value: any) => {
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
    get tagName(): string {
        return this.__tagName;
    }

    /**
     * Get full name (with namespace)
     */
    get fullName(): string {
        return this.__fullName;
    }

    get registryID(): string | undefined | null {
        return this.__registryID;
    }
    /**
     * Get open tag node
     */
    get openTag(): Comment {
        return this.__openTag;
    }

    /**
     * Get close tag node
     */
    get closeTag(): Comment {
        return this.__closeTag;
    }

    /**
     * Get all attributes
     */
    get attributes(): Record<string, any> {
        return this.__attributes;
    }

    /**
     * Get nodes between open and close tags
     */
    get nodes(): Array<Node> {
        return this.__nodes;
    }

    /**
     * Get system prefix (registry tags only)
     */
    get systemPrefix(): string | undefined {
        return this.__systemPrefix;
    }

    /**
     * Get tag (registry tags only)
     */
    get tag(): string | undefined {
        return this.__tag;
    }

    /**
     * Get ID (registry tags only)
     */
    get id(): string | undefined {
        return this.__id;
    }

    /**
     * Get full key (registry tags only)
     */
    get key(): string | undefined {
        return this.__key;
    }

    /**
     * Get full data (registry tags only)
     */
    get data(): Record<string, any> | undefined {
        if (!this.__systemPrefix) return undefined;
        return {
            systemPrefix: this.__systemPrefix!,
            tag: this.__tag!,
            id: this.__id!,
            key: this.__key!,
            attributes: this.__attributes,
            nodes: this.__nodes
        };
    }

    /**
     * Get outer HTML including open/close tags and content
     */
    get outerHTML(): string {
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
    get innerHTML(): string {
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
    private __getNodeHTML(node: Node | null): string {
        if (!node) return '';

        switch (node.nodeType) {
            case Node.COMMENT_NODE:
                return `<!--${(node as Comment).nodeValue}-->`;
            case Node.TEXT_NODE:
                return node.textContent || '';
            case Node.ELEMENT_NODE:
                return (node as Element).outerHTML || '';
            default:
                return node.textContent || '';
        }
    }

    /**
     * Get attribute value
     */
    getAttribute(name: string): string | undefined {
        return this.__attributes[name];
    }

    /**
     * Set attribute value
     */
    setAttribute(name: string, value: string): this {
        this.__defineAttribute(name);
        this.__attributes[name] = value;
        return this;
    }

    /**
     * Check if model matches query attributes
     * @private
     */
    __match(attributes: Record<string, any>): boolean {
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'tagName') {
                if (this.__tagName !== value) return false;
            } else if (key === 'openTag') {
                if (this.__openTag !== value) return false;
            } else if (key === 'closeTag') {
                if (this.__closeTag !== value) return false;
            } else if (key === 'attributes' || key === 'nodes') {
                continue;
            } else if (this.__attributes[key] !== value) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if model matches given attributes (for registry tag filtering)
     */
    matchesAttributes(attributes: Record<string, any>): boolean {
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
    setAttributes(attributes: Record<string, any>): this {
        Object.assign(this.__attributes, attributes);
        this.__defineAttributes(Object.keys(attributes));
        return this;
    }

    /**
     * Scan and update nodes between open/close tags
     */
    __scan(): Array<Node> {
        const nodes: Array<Node> = [];
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
    __sync(): boolean {
        // Placeholder for sync logic
        // In V1, this uses oms.find() which requires OneMarkerService
        return false;
    }

    /**
     * Update nodes array
     */
    updateNodes(nodes: Array<Node>): this {
        this.__nodes = nodes;
        return this;
    }

    /**
     * Replace content between open and close tags
     */
    replaceContent(content: string | Node | Array<Node>): this {
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
        } else if (content instanceof Node) {
            if (closeTag.parentNode) {
                closeTag.parentNode.insertBefore(content, closeTag);
            }
        } else if (Array.isArray(content)) {
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
    remove(): void {
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
 * OneMarkerCollection - Collection of OneMarkerModel instances
 * Provides array-like operations with type safety
 */
export class MarkerCollection implements MarkerCollectionInterface {
    private __models: MarkerModel[];

    constructor(elements: Array<MarkerModel | MarkerRecord> = []) {
        this.__models = elements.map(element =>
            (element instanceof MarkerModel) ? element : new MarkerModel(element)
        );
    }

    get models(): MarkerModel[] {
        return this.__models;
    }

    get length(): number {
        return this.__models.length;
    }

    /**
     * Get the first model in the collection
     */
    get first(): MarkerModel | undefined {
        return this.__models[0];
    }

    /**
     * Get the last model in the collection
     */
    get last(): MarkerModel | undefined {
        return this.__models[this.__models.length - 1];
    }

    /**
     * Get the model at the given index
     */
    get(index: number): MarkerModel | undefined {
        return this.__models[index];
    }

    /**
     * Set the model at the given index
     */
    set(index: number, model: MarkerModel): this {
        this.__models[index] = model;
        return this;
    }

    push(model: MarkerModel | MarkerRecord): this {
        if (!(model instanceof MarkerModel)) {
            model = new MarkerModel(model);
        }
        this.__models.push(model as MarkerModel);
        return this;
    }

    pop(): MarkerModel | undefined {
        return this.__models.pop();
    }

    shift(): MarkerModel | undefined {
        return this.__models.shift();
    }

    unshift(model: MarkerModel | MarkerRecord): this {
        if (!(model instanceof MarkerModel)) {
            model = new MarkerModel(model);
        }
        this.__models.unshift(model as MarkerModel);
        return this;
    }

    splice(start: number, deleteCount: number, ...items: MarkerModel[]): MarkerModel[] {
        return this.__models.splice(start, deleteCount, ...items);
    }

    slice(start?: number, end?: number): MarkerModel[] {
        return this.__models.slice(start, end);
    }

    concat(models: MarkerCollection | MarkerModel[]): MarkerCollection {
        const otherModels = (models instanceof MarkerCollection) ? models.__models : models;
        return new MarkerCollection(this.__models.concat(otherModels));
    }

    reverse(): MarkerCollection {
        return new MarkerCollection([...this.__models].reverse());
    }

    map<T>(callback: (model: MarkerModel, index: number, array: MarkerModel[]) => T): T[] {
        return this.__models.map(callback);
    }

    filter(callback: (model: MarkerModel, index: number, array: MarkerModel[]) => boolean): MarkerModel[] {
        return this.__models.filter(callback);
    }

    reduce<T>(callback: (accumulator: T, model: MarkerModel, index: number, array: MarkerModel[]) => T, initialValue: T): T {
        return this.__models.reduce(callback, initialValue);
    }

    forEach(callback: (model: MarkerModel, index: number, array: MarkerModel[]) => void): void {
        this.__models.forEach(callback);
    }

    some(callback: (model: MarkerModel, index: number, array: MarkerModel[]) => boolean): boolean {
        return this.__models.some(callback);
    }

    every(callback: (model: MarkerModel, index: number, array: MarkerModel[]) => boolean): boolean {
        return this.__models.every(callback);
    }

    /**
     * Query the collection by attributes
     */
    query(attributes: Record<string, any> = {}): MarkerModel[] {
        return this.__models.filter(model => model.__match(attributes));
    }

    /**
     * Find first model matching attributes
     */
    find(attributes: Record<string, any> = {}): MarkerModel | null {
        return this.query(attributes)[0] || null;
    }
}

