import { InitModes } from "../contracts/common";
/**
 * Wrapper — renders multiple root nodes into a parent without a wrapping tag.
 *
 * Use case: when a ViewController's render() returns multiple sibling elements
 * (e.g. `<h1>` + `<p>` + `<div>`) without a single root wrapper.
 *
 * Wrapper uses open/close Comment markers to track its region in the DOM,
 * similar to Reactive but without the reactivity overhead.
 */
export class Wrapper {
    constructor({ ctx, initMode = InitModes.CREATE, parentElement = null, childrenFactory }) {
        this.saoType = 'Wrapper';
        this.nodes = [];
        /** Tracked child element wrappers (Html, Output, Reactive, TextElement, etc.) */
        this.children = [];
        this.initMode = InitModes.CREATE;
        this.domChildren = []; // For compatibility with HtmlInterface; Wrapper itself doesn't have a single root element
        this.ctx = ctx;
        this.parent = parentElement;
        this.childrenFactory = childrenFactory;
        this.id = ctx.viewId;
        this.initMode = initMode;
        this.openTag = document.createComment('wrapper-start');
        this.closeTag = document.createComment('wrapper-end');
    }
    setParentElement(parent) {
        this.parent = parent;
    }
    render() {
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
    clear() {
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
//# sourceMappingURL=Wrapper.js.map