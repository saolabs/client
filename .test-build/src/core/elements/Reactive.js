"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reactive = void 0;
const common_1 = require("../contracts/common");
const utils_1 = require("../helpers/utils");
const MarkerModel_1 = require("../services/MarkerModel");
const MarkerRegistry_1 = __importDefault(require("../services/MarkerRegistry"));
const MarkerService_1 = require("../services/MarkerService");
/**
 * Reactive — a region in the DOM bounded by comment markers that
 * can re-render its content when reactive dependencies change.
 *
 * Use cases:
 *   - o-if / o-show conditional rendering
 *   - o-for list rendering
 *   - @useBlock(name) slot mounting
 *   - Any expression binding that affects DOM structure
 *
 * The open/close comment markers stay in place; only the content
 * between them is replaced on re-render. This avoids the need to
 * scan/diff the entire DOM tree.
 */
class Reactive {
    constructor({ type = 'reactive', id = null, ctx, parentElement = null, parentReactive = null, stateKeys = [], childrenFactory = () => [], initMode = common_1.InitModes.CREATE, }) {
        this.saoType = 'Reactive';
        this.parent = null; // Alias for parentReactive to satisfy SaoNodeInterface
        this.children = [];
        this.mounted = false;
        this.unsubscribe = () => { };
        this._isStarted = false;
        this.marker = null;
        this.domChildren = []; // For compatibility with HtmlInterface; Reactive itself doesn't have a single root element
        this.initMode = common_1.InitModes.CREATE;
        /** Registry guard — element đã destroy không được reuse */
        this.__destroyed__ = false;
        this.ctx = ctx;
        this.parentElement = parentElement;
        this.parentReactive = parentReactive;
        this.id = id ? id : `${ctx.viewId}-${(0, utils_1.generateUUID)(5)}`;
        this.type = type;
        this.childrenFactory = childrenFactory;
        this.stateKeys = stateKeys;
        this.initMode = initMode;
        if (this.initMode === common_1.InitModes.CREATE) {
            MarkerRegistry_1.default.register('reactive', this.id, {
                type: this.type,
                stateKeys: this.stateKeys,
                viewID: this.ctx.viewId,
            });
            this.openTag = MarkerRegistry_1.default.createMarkerStart('reactive', this.id);
            this.closeTag = MarkerRegistry_1.default.createMarkerEnd('reactive', this.id);
        }
        else {
            const marker = MarkerService_1.SaoMarker.first('reactive', this.id);
            if (marker) {
                this.marker = marker;
                this.openTag = marker.openTag;
                this.closeTag = marker.closeTag;
            }
            else {
                this.openTag = MarkerRegistry_1.default.createMarkerStart('reactive', this.id);
                this.closeTag = MarkerRegistry_1.default.createMarkerEnd('reactive', this.id);
                this.marker = new MarkerModel_1.MarkerModel({
                    tagName: 's:r',
                    name: 'reactive',
                    markerID: this.id,
                    openTag: this.openTag,
                    closeTag: this.closeTag,
                    attributes: {},
                    children: []
                });
            }
        }
    }
    setParentElement(parent) {
        this.parentElement = parent;
    }
    setChildrenFactory(factory) {
        this.childrenFactory = factory;
    }
    setStateKeys(stateKeys) {
        this.stateKeys = stateKeys;
        // If already started, we need to resubscribe with new keys
        if (this._isStarted) {
            this.stop();
            this.start();
        }
    }
    /**
     * Render — idempotent + position-aware (RUNTIME_CONTRACT.md §2):
     *   - Markers chưa trong DOM → đặt markers (trước closeTag của parentReactive
     *     nếu có, ngược lại append vào parentElement — đường mountElementList
     *     duyệt tuần tự nên vị trí đúng).
     *   - Markers đã trong DOM → chỉ thay nội dung GIỮA markers.
     * Children loại marker-based (Output, nested Reactive, Fragment) được CALLER
     * đặt markers vào đúng vị trí trước, rồi mới gọi child.render() — FIX(baseline#6).
     * Children sinh ra khi đang active được start() ngay — FIX(baseline#7).
     */
    render() {
        if (this.__destroyed__)
            return;
        if (!this.openTag.parentNode) {
            // Markers chưa được đặt — đặt mới
            const target = this.getInsertionTarget();
            if (!target)
                return;
            if (this.parentReactive && this.parentReactive.closeTag.parentNode === target) {
                target.insertBefore(this.openTag, this.parentReactive.closeTag);
                target.insertBefore(this.closeTag, this.parentReactive.closeTag);
            }
            else {
                target.appendChild(this.openTag);
                target.appendChild(this.closeTag);
            }
            this.mounted = true;
        }
        else {
            // Re-render: clear nội dung cũ giữa markers
            this.clearContent();
        }
        // Produce children
        const output = this.childrenFactory(this, this.parentElement);
        const newChildren = [];
        // Insert children between markers
        for (const child of output) {
            if (child === null || child === undefined)
                continue;
            if (typeof child === 'string' || typeof child === 'number') {
                const textNode = document.createTextNode(String(child));
                this.insertBeforeClose(textNode);
                this.children.push(textNode);
            }
            else if (child instanceof Node) {
                // Raw DOM node (phòng hờ code viết tay)
                this.insertBeforeClose(child);
                this.children.push(child);
            }
            else if (typeof child === 'object') {
                if ('element' in child && child.element) {
                    // Html, TextElement — single root element
                    this.insertBeforeClose(child.element);
                    this.children.push(child);
                    newChildren.push(child);
                    child.render();
                }
                else if ('openTag' in child) {
                    // Marker-based: Output, nested Reactive, Fragment...
                    // Đặt markers của child vào ĐÚNG vị trí trước, render sau —
                    // child.render() (idempotent) sẽ fill nội dung giữa markers của nó.
                    this.insertBeforeClose(child.openTag);
                    this.insertBeforeClose(child.closeTag);
                    this.children.push(child);
                    newChildren.push(child);
                    child.render();
                }
            }
        }
        // Nếu vùng này đang active (re-render sau state change),
        // children mới phải được start() ngay để có subscription/event.
        if (this._isStarted) {
            for (const child of newChildren) {
                if (typeof child.start === 'function') {
                    child.start();
                }
            }
        }
    }
    /** Schedule a re-render through the ViewController */
    update() {
        this.ctx.scheduleUpdate(this);
    }
    /** Clear all DOM nodes between the open and close markers */
    clearContent() {
        // Destroy managed children first
        for (const child of this.children) {
            if (child && typeof child === 'object' && 'destroy' in child) {
                child.destroy();
            }
        }
        this.children = [];
        // Remove DOM nodes between markers
        let current = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next = current.nextSibling;
            current.remove();
            current = next;
        }
    }
    /** Insert a node just before the close marker */
    insertBeforeClose(node) {
        this.closeTag.parentNode?.insertBefore(node, this.closeTag);
    }
    /** Determine the actual DOM element to insert into */
    getInsertionTarget() {
        if (this.parentElement) {
            return this.parentElement.element;
        }
        return null;
    }
    /** Start — subscribe to stateKeys and recursively start children.
     * Called during START phase of view lifecycle. */
    start() {
        if (this._isStarted)
            return;
        this._isStarted = true;
        // Subscribe to state changes → schedule re-render
        if (this.stateKeys.length > 0) {
            this.unsubscribe = this.ctx.states.__.subscribe(this.stateKeys, () => this.update());
        }
        // Recursively start children
        for (const child of this.children) {
            if (child && typeof child === 'object' && 'start' in child && typeof child.start === 'function') {
                child.start();
            }
        }
    }
    /** Stop — unsubscribe and recursively stop children. */
    stop() {
        if (!this._isStarted)
            return;
        this._isStarted = false;
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = () => { };
        }
        // Recursively stop children
        for (const child of this.children) {
            if (child && typeof child === 'object' && 'stop' in child && typeof child.stop === 'function') {
                child.stop();
            }
        }
    }
    /** Remove content but keep markers (for hide/show scenarios) */
    hide() {
        this.clearContent();
    }
    /** Re-render content (for show after hide) */
    show() {
        this.render();
    }
    destroy() {
        this.__destroyed__ = true;
        this.stop();
        this.clearContent();
        this.openTag.remove();
        this.closeTag.remove();
        this.mounted = false;
        this.parentElement = null;
        this.parentReactive = null;
    }
    get isOneReactive() {
        return true;
    }
    set isOneReactive(value) {
        // No-op setter to satisfy the Interface; this property is always true for Reactive elements
    }
    set isSaoElement(value) {
        // No-op setter to satisfy the Interface; Reactive is a type of OneElement
    }
    get isSaoElement() {
        return true;
    }
}
exports.Reactive = Reactive;
Reactive.class = 'Reactive';
