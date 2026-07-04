"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Output = void 0;
const common_1 = require("../contracts/common");
const utils_1 = require("../helpers/utils");
/**
 * Output — reactive text output between comment markers.
 *
 * Compiled từ: {{ $expression }}   → output({ctx, parentElement, stateKeys, isEscapeHTML: true}, () => expression)
 * Compiled từ: {!! $expression !!} → output({ctx, parentElement, stateKeys, isEscapeHTML: false}, () => expression)
 *
 * Render: Tạo Text node giữa <!--o:id-s--> và <!--o:id-e-->
 * Update: Khi stateKeys thay đổi → re-evaluate contentFactory → update textContent
 */
class Output {
    constructor({ ctx, id = null, parent = null, stateKeys = [], contentFactory = () => '', isEscapeHTML = true, initMode = common_1.InitModes.CREATE }) {
        this.saoType = 'Output';
        this.domChildren = []; // For compatibility with HtmlInterface; Output itself doesn't have a single root element
        this.textNode = null;
        this.unsubscribe = null;
        this._isStarted = false;
        this._isDestroyed = false;
        this.initMode = common_1.InitModes.CREATE;
        /** Nodes của raw HTML mode ({!! !!}) — track để clear khi update */
        this.rawNodes = [];
        this.ctx = ctx;
        this.parent = parent;
        this.stateKeys = stateKeys;
        this.contentFactory = contentFactory;
        this.isEscapeHTML = isEscapeHTML;
        this.id = `${ctx.viewId}-${id ?? (0, utils_1.generateUUID)(8)}`;
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
     * Render — idempotent + position-aware (RUNTIME_CONTRACT.md §2):
     *   - Markers chưa nằm trong DOM → caller chưa đặt → tự append vào parent
     *     (đường mountElementList: thứ tự duyệt tuần tự nên vị trí đúng).
     *   - Markers ĐÃ nằm trong DOM (caller như Reactive đã chèn đúng chỗ)
     *     → chỉ render nội dung GIỮA markers. FIX(baseline#6).
     */
    render() {
        if (this._isDestroyed)
            return;
        if (!this.openTag.parentNode) {
            const parentEl = this.parent?.element;
            if (!parentEl)
                return;
            parentEl.appendChild(this.openTag);
            parentEl.appendChild(this.closeTag);
        }
        this.clearContent();
        const rawText = String(this.contentFactory() ?? '');
        if (this.isEscapeHTML) {
            // FIX(baseline#3): KHÔNG escape thủ công — text node tự an toàn
            this.textNode = document.createTextNode(rawText);
            this.insertBeforeClose(this.textNode);
        }
        else {
            // FIX(baseline#4): {!! !!} render raw HTML thật giữa markers
            this.renderRaw(rawText);
        }
    }
    /** Xoá toàn bộ nodes giữa open/close markers */
    clearContent() {
        let current = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next = current.nextSibling;
            current.remove();
            current = next;
        }
        this.textNode = null;
        this.rawNodes = [];
    }
    insertBeforeClose(node) {
        this.closeTag.parentNode?.insertBefore(node, this.closeTag);
    }
    /** Parse HTML string → DOM nodes thật, chèn giữa markers */
    renderRaw(html) {
        if (!html)
            return;
        const range = document.createRange();
        const container = this.closeTag.parentNode ?? document.body;
        range.selectNodeContents(container);
        const fragment = range.createContextualFragment(html);
        this.rawNodes = Array.from(fragment.childNodes);
        this.insertBeforeClose(fragment);
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
     * Update — re-evaluate contentFactory.
     * Escaped mode: O(1) — chỉ thay textContent.
     * Raw mode: clear giữa markers → parse + chèn lại.
     */
    update() {
        if (this._isDestroyed)
            return;
        const rawText = String(this.contentFactory() ?? '');
        if (this.isEscapeHTML && this.textNode) {
            if (this.textNode.textContent !== rawText) {
                this.textNode.textContent = rawText;
            }
            return;
        }
        // Raw mode hoặc textNode chưa tồn tại → render lại nội dung giữa markers
        if (this.openTag.parentNode) {
            this.clearContent();
            if (this.isEscapeHTML) {
                this.textNode = document.createTextNode(rawText);
                this.insertBeforeClose(this.textNode);
            }
            else {
                this.renderRaw(rawText);
            }
        }
    }
    /**
     * Destroy — cleanup everything.
     */
    /** Registry guard — alias của _isDestroyed cho ViewController.aliveFromRegistry */
    get __destroyed__() { return this._isDestroyed; }
    destroy() {
        if (this._isDestroyed)
            return;
        this._isDestroyed = true;
        this.stop();
        // Remove mọi nội dung giữa markers (text node hoặc raw nodes)
        let current = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next = current.nextSibling;
            current.remove();
            current = next;
        }
        this.textNode = null;
        this.rawNodes = [];
        // Remove markers
        this.openTag.remove();
        this.closeTag.remove();
        this.parent = null;
    }
    // ─── OneElement markers ─────────────────────────────
    get isSaoElement() { return true; }
    set isSaoElement(_) { }
    get isOneOutput() { return true; }
    set isOneOutput(_) { }
}
exports.Output = Output;
