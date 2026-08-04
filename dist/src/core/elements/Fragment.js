import { InitModes } from "../contracts/common";
import { generateUUID } from "../helpers/utils";
/**
 * Fragment — renders multiple root nodes into a parent without a wrapping tag.
 *
 * Use case: when a ViewController's render() returns multiple sibling elements
 * (e.g. `<h1>` + `<p>` + `<div>`) without a single root wrapper.
 *
 * Fragment uses open/close Comment markers to track its region in the DOM,
 * similar to Reactive but without the reactivity overhead.
 */
export class Fragment {
    constructor({ ctx, id = null, initMode = InitModes.CREATE, parentElement = null, childrenFactory }) {
        this.saoType = 'Fragment';
        this.nodes = [];
        /** Tracked child element wrappers (Html, Output, Reactive, TextElement, etc.) */
        this.children = [];
        this.initMode = InitModes.CREATE;
        this.domChildren = []; // For compatibility with HtmlInterface; Fragment itself doesn't have a single root element
        /** Registry guard — element đã destroy không được reuse */
        this.__destroyed__ = false;
        this.ctx = ctx;
        this.parent = parentElement;
        this.childrenFactory = childrenFactory;
        this.openTag = document.createComment('fragment-start');
        this.closeTag = document.createComment('fragment-end');
        this.id = `${ctx.viewId}-${id ?? generateUUID(10)}`; // Unique ID for debugging
        this.initMode = initMode;
    }
    setParentElement(parent) {
        this.parent = parent;
    }
    /**
     * Render — idempotent + position-aware (RUNTIME_CONTRACT.md §2),
     * cùng pattern với Reactive.render().
     */
    render() {
        if (this.__destroyed__)
            return;
        if (!this.openTag.parentNode) {
            if (!this.parent || !this.parent.element)
                return;
            const parentEl = this.parent.element;
            parentEl.appendChild(this.openTag);
            parentEl.appendChild(this.closeTag);
        }
        else {
            this.clear(false);
        }
        // Build children — compiled output uses (parentElement) => [...] signature
        const output = this.childrenFactory(this.parent);
        const insertBeforeClose = (node) => {
            this.closeTag.parentNode?.insertBefore(node, this.closeTag);
        };
        for (const child of output) {
            if (child === null || child === undefined)
                continue;
            if (typeof child === 'string' || typeof child === 'number') {
                const textNode = document.createTextNode(String(child));
                insertBeforeClose(textNode);
                this.nodes.push(textNode);
            }
            else if (child instanceof Node) {
                insertBeforeClose(child);
                this.nodes.push(child);
            }
            else if (typeof child === 'object') {
                if ('element' in child && child.element) {
                    insertBeforeClose(child.element);
                    this.nodes.push(child.element);
                    this.children.push(child);
                    child.render();
                }
                else if ('openTag' in child) {
                    // Marker-based: đặt markers đúng vị trí trước, render sau
                    if ('parent' in child) {
                        child.parent = this.parent;
                    }
                    if ('parentElement' in child) {
                        child.parentElement = this.parent;
                    }
                    insertBeforeClose(child.openTag);
                    insertBeforeClose(child.closeTag);
                    this.children.push(child);
                    child.render();
                }
            }
        }
    }
    setChildrenFactory(factory) {
        this.childrenFactory = factory;
    }
    /** Hydrate lifecycle — reattach event listeners or perform other setup */
    hydrate() {
        for (const child of this.children) {
            if ('hydrate' in child && typeof child.hydrate === 'function') {
                child.hydrate();
            }
        }
    }
    /** Start lifecycle — recursively activate children's reactive subscriptions */
    start() {
        for (const child of this.children) {
            if ('start' in child && typeof child.start === 'function') {
                child.start();
            }
        }
    }
    /** Stop lifecycle — recursively deactivate children's reactive subscriptions */
    stop() {
        for (const child of this.children) {
            if ('stop' in child && typeof child.stop === 'function') {
                child.stop();
            }
        }
    }
    /** Remove all nodes between markers from the DOM */
    clear(_destroyChildren = true) {
        // Destroy managed children first
        for (const child of this.children) {
            if ('destroy' in child && typeof child.destroy === 'function') {
                child.destroy();
            }
        }
        this.children = [];
        // Remove remaining DOM nodes between markers
        let current = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next = current.nextSibling;
            current.remove();
            current = next;
        }
        this.nodes = [];
    }
    destroy() {
        this.__destroyed__ = true;
        this.ctx.releaseElement?.(this);
        this.clear();
        this.openTag.remove();
        this.closeTag.remove();
        this.parent = null;
    }
    get isSaoElement() {
        return true;
    }
    set isSaoElement(value) {
        // No-op setter to satisfy the Interface; this property is always true for Fragment elements
    }
    get isSaoFragment() {
        return true;
    }
    set isSaoFragment(value) {
        // No-op setter to satisfy the Interface; this property is always true for Fragment elements
    }
}
//# sourceMappingURL=Fragment.js.map