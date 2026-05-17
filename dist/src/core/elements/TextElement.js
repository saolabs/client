import { escapeHTML } from "../hellpers/utils";
/**
 * TextElement — wraps a DOM Text node.
 *
 * Supports reactive text updates without re-creating the node.
 * When `update(newText)` is called, only the textContent changes —
 * no DOM removal/insertion needed.
 */
export class TextElement {
    constructor({ ctx, parent = null, stateKeys = [], generateText = () => '', isEscapeHTML = true }) {
        this.saoType = 'TextElement';
        this.statekeys = [];
        this.unsubscribe = null;
        this.generateText = () => this._text;
        this._text = '';
        this.shouldEscapeHTML = true; // Whether to escape HTML in text content
        this.isStarted = false;
        this.domChildren = []; // For compatibility with HtmlInterface; Text itself doesn't have a single root element
        this.ctx = ctx;
        this.generateText = generateText;
        this.parent = parent;
        this.statekeys = stateKeys;
        this.shouldEscapeHTML = isEscapeHTML;
        this._text = this.generateText();
        if (this.shouldEscapeHTML) {
            this._text = escapeHTML(this._text);
        }
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
    }
    /** Update text content in-place */
    update(newText) {
        if (this._text !== newText) {
            this._text = newText;
            this.element.textContent = this.shouldEscapeHTML ? escapeHTML(newText) : newText;
        }
    }
    render() {
        if (this.parent && this.parent.element) {
            this.parent.element.appendChild(this.element);
        }
    }
    remove() {
        this.element.remove();
    }
    destroy() {
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
//# sourceMappingURL=TextElement.js.map