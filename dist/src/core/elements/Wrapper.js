import { InitModes } from "../contracts/common";
import { app } from "../helpers/app";
import { mountElementList } from "../helpers/view";
import { TextElement } from "./TextElement";
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
        this.init();
        const registry = app("Registry");
        if (this.initMode === InitModes.HYDRATE) {
            // ── Hydrate: tìm view markers SSR trong DOM ─────────────────
            // Format MarkerRegistry: open = `v:id`, close = `/v:id`
            // (v = shortcut cho 'view'). Nếu không có (vd partial hydration
            // khi root element CHÍNH là boundary của view) → tạo markers mới,
            // không cảnh báo vì đây là trường hợp hợp lệ.
            const claimed = this.claimSSRMarkers(registry);
            if (claimed) {
                this.openTag = claimed.open;
                this.closeTag = claimed.close;
            }
            else {
                this.openTag = registry.createMarkerStart('view', this.id);
                this.closeTag = registry.createMarkerEnd('view', this.id);
            }
        }
        else {
            this.openTag = registry.createMarkerStart('view', this.id);
            this.closeTag = registry.createMarkerEnd('view', this.id);
        }
    }
    /**
     * Tìm cặp view markers từ server-rendered HTML.
     * Format MarkerRegistry: open = `v:id`, close = `/v:id`.
     * Quét comment nodes trong parent element (fallback document.body).
     */
    claimSSRMarkers(registry) {
        const searchRoot = this.parent?.element ?? document.body;
        const walker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_COMMENT);
        const openText = registry.openComment('view', this.id);
        const closeText = registry.closeComment('view', this.id);
        let openNode = null;
        let node;
        while ((node = walker.nextNode())) {
            const value = node.nodeValue?.trim() ?? '';
            if (!openNode && value === openText) {
                openNode = node;
                continue;
            }
            if (openNode && value === closeText) {
                return { open: openNode, close: node };
            }
        }
        return null;
    }
    init() {
    }
    setParentElement(parent) {
        this.parent = parent;
    }
    render() {
        this.children = [];
        const children = this.childrenFactory(this.parent);
        this.children = children
            .filter((child) => child !== null && child !== undefined)
            .map((child) => {
            if (typeof child === 'string' || typeof child === 'number') {
                return new TextElement({ ctx: this.ctx, parent: this.parent, stateKeys: [], generateText: () => String(child) });
            }
            return child;
        });
        return this.children;
    }
    appendTo(parent) {
        this.parent = parent;
        this.parent.appendElement(this.openTag);
        mountElementList(this.parent, this.render());
        this.parent.appendElement(this.closeTag);
    }
    mountTo(parent) {
        parent.clearHTML();
        this.appendTo(parent);
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