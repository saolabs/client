"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextElement = void 0;
/**
 * TextElement — wraps a DOM Text node.
 *
 * Supports reactive text updates without re-creating the node.
 * When `update(newText)` is called, only the textContent changes —
 * no DOM removal/insertion needed.
 */
class TextElement {
    constructor({ ctx, parent = null, stateKeys = [], generateText = () => '', isEscapeHTML = true }) {
        this.saoType = 'TextElement';
        this.statekeys = [];
        this.unsubscribe = null;
        this.generateText = () => this._text;
        this._text = '';
        this.shouldEscapeHTML = true; // Whether to escape HTML in text content
        this.isStarted = false;
        this.domChildren = []; // For compatibility with HtmlInterface; Text itself doesn't have a single root element
        /** Registry guard — element đã destroy không được reuse */
        this.__destroyed__ = false;
        this.ctx = ctx;
        this.generateText = generateText;
        this.parent = parent;
        this.statekeys = stateKeys;
        this.shouldEscapeHTML = isEscapeHTML;
        // FIX(baseline#3): KHÔNG escapeHTML khi ghi vào Text node — text node tự an toàn,
        // escape thủ công gây double-escape. shouldEscapeHTML chỉ dùng cho SSR string path.
        this._text = this.generateText();
        this.element = document.createTextNode(this._text);
    }
    /** Start reactive text updates */
    start() {
        if (this.isStarted)
            return;
        this.isStarted = true;
        if (this.statekeys.length > 0) {
            this.unsubscribe = this.ctx.states.__.subscribe(this.statekeys, (newText) => {
                this.update(this.generateText());
            });
        }
    }
    stop() {
        if (!this.isStarted)
            return;
        this.isStarted = false;
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
    setParentElement(parent) {
        this.parent = parent;
    }
    /** Update text content in-place */
    update(newText) {
        if (this._text !== newText) {
            this._text = newText;
            this.element.textContent = newText;
        }
    }
    render() {
        const text = this.generateText();
        this._text = text;
        this.element.textContent = text;
        return this.element;
    }
    remove() {
        this.element.remove();
    }
    destroy() {
        this.__destroyed__ = true;
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.element.remove();
        this.parent = null;
    }
    get text() {
        return this._text;
    }
    set text(newText) {
        this.update(newText);
    }
    get isSaoElement() {
        return true;
    }
    set isSaoElement(value) {
        // No-op setter to satisfy the Interface; this property is always true for Text elements
    }
    get isOneText() {
        return true;
    }
    set isOneText(value) {
        // No-op setter to satisfy the Interface; this property is always true for Text elements
    }
}
exports.TextElement = TextElement;
