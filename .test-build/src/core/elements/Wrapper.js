"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wrapper = void 0;
const common_1 = require("../contracts/common");
const app_1 = require("../helpers/app");
const view_1 = require("../helpers/view");
const MarkerService_1 = require("../services/MarkerService");
const TextElement_1 = require("./TextElement");
/**
 * Wrapper — renders multiple root nodes into a parent without a wrapping tag.
 *
 * Use case: when a ViewController's render() returns multiple sibling elements
 * (e.g. `<h1>` + `<p>` + `<div>`) without a single root wrapper.
 *
 * Wrapper uses open/close Comment markers to track its region in the DOM,
 * similar to Reactive but without the reactivity overhead.
 */
class Wrapper {
    constructor({ ctx, initMode = common_1.InitModes.CREATE, parentElement = null, childrenFactory }) {
        this.saoType = 'Wrapper';
        this.nodes = [];
        /** Tracked child element wrappers (Html, Output, Reactive, TextElement, etc.) */
        this.children = [];
        this.initMode = common_1.InitModes.CREATE;
        this.domChildren = []; // For compatibility with HtmlInterface; Wrapper itself doesn't have a single root element
        this.ctx = ctx;
        this.parent = parentElement;
        this.childrenFactory = childrenFactory;
        this.id = ctx.viewId;
        this.initMode = initMode;
        this.init();
        const registry = (0, app_1.app)("Registry");
        if (this.initMode === common_1.InitModes.HYDRATE) {
            const markerService = (0, app_1.app)(MarkerService_1.MarkerService);
            const viewMarker = markerService.first('view', this.id);
            if (viewMarker) {
                this.openTag = viewMarker.openTag;
                this.closeTag = viewMarker.closeTag;
            }
            else {
                this.openTag = registry.createMarkerStart('view', this.id);
                this.closeTag = registry.createMarkerEnd('view', this.id);
                console.warn(`Wrapper hydration failed: no marker found for view ID ${this.id}`);
            }
        }
        else {
            this.openTag = registry.createMarkerStart('view', this.id);
            this.closeTag = registry.createMarkerEnd('view', this.id);
        }
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
                return new TextElement_1.TextElement({ ctx: this.ctx, parent: this.parent, stateKeys: [], generateText: () => String(child) });
            }
            return child;
        });
        return this.children;
    }
    appendTo(parent) {
        this.parent = parent;
        this.parent.appendElement(this.openTag);
        (0, view_1.mountElementList)(this.parent, this.render());
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
exports.Wrapper = Wrapper;
