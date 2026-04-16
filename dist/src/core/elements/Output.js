import { InitModes } from "../contracts/common";
import { escapeHTML, generateUUID } from "../hellpers/utils";
/**
 * Output — reactive text output between comment markers.
 *
 * Compiled từ: {{ $expression }}   → output({ctx, parentElement, stateKeys, isEscapeHTML: true}, () => expression)
 * Compiled từ: {!! $expression !!} → output({ctx, parentElement, stateKeys, isEscapeHTML: false}, () => expression)
 *
 * Render: Tạo Text node giữa <!--o:id-s--> và <!--o:id-e-->
 * Update: Khi stateKeys thay đổi → re-evaluate contentFactory → update textContent
 */
export class Output {
    constructor({ ctx, id = null, parent = null, stateKeys = [], contentFactory = () => '', isEscapeHTML = true, initMode = InitModes.CREATE }) {
        this.oneType = 'Output';
        this.domChildren = []; // For compatibility with HtmlInterface; Output itself doesn't have a single root element
        this.textNode = null;
        this.unsubscribe = null;
        this._isStarted = false;
        this._isDestroyed = false;
        this.initMode = InitModes.CREATE;
        this.ctx = ctx;
        this.parent = parent;
        this.stateKeys = stateKeys;
        this.contentFactory = contentFactory;
        this.isEscapeHTML = isEscapeHTML;
        this.id = `${ctx.viewId}-${id ?? generateUUID(8)}`;
        this.initMode = initMode;
        this.openTag = document.createComment(`o:${this.id}-s`);
        this.closeTag = document.createComment(`o:${this.id}-e`);
    }
    setParentElement(parent) {
        this.parent = parent;
    }
    setContentFactory(factory) {
        this.contentFactory = factory;
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
     * Render — insert markers + initial text into parent element.
     */
    render() {
        if (!this.parent?.element || this._isDestroyed)
            return;
        const parentEl = this.parent.element;
        // Append markers + text node
        parentEl.appendChild(this.openTag);
        const rawText = String(this.contentFactory() ?? '');
        const displayText = this.isEscapeHTML ? escapeHTML(rawText) : rawText;
        this.textNode = document.createTextNode(displayText);
        parentEl.appendChild(this.textNode);
        parentEl.appendChild(this.closeTag);
    }
    /**
     * Start — subscribe to state changes for reactive updates.
     * Called during START phase of view lifecycle.
     */
    start() {
        if (this._isStarted || this._isDestroyed)
            return;
        this._isStarted = true;
        if (this.stateKeys.length > 0) {
            this.unsubscribe = this.ctx.states.__.subscribe(this.stateKeys, () => this.update());
        }
    }
    /**
     * Stop — unsubscribe from state changes.
     */
    stop() {
        if (!this._isStarted)
            return;
        this._isStarted = false;
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
    /**
     * Update — re-evaluate contentFactory and update text node in-place.
     * O(1) — chỉ thay textContent, không tạo/xóa DOM nodes.
     */
    update() {
        if (!this.textNode || this._isDestroyed)
            return;
        const rawText = String(this.contentFactory() ?? '');
        const displayText = this.isEscapeHTML ? escapeHTML(rawText) : rawText;
        if (this.textNode.textContent !== displayText) {
            this.textNode.textContent = displayText;
        }
    }
    /**
     * Destroy — cleanup everything.
     */
    destroy() {
        if (this._isDestroyed)
            return;
        this._isDestroyed = true;
        this.stop();
        // Remove text node
        if (this.textNode) {
            this.textNode.remove();
            this.textNode = null;
        }
        // Remove markers
        this.openTag.remove();
        this.closeTag.remove();
        this.parent = null;
    }
    // ─── OneElement markers ─────────────────────────────
    get isOneElement() { return true; }
    set isOneElement(_) { }
    get isOneOutput() { return true; }
    set isOneOutput(_) { }
}
//# sourceMappingURL=Output.js.map