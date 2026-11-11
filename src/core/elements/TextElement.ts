import type { HtmlInterface, TextInterface } from "../contracts/ElementInterface.js";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface.js";
import { SaoObjectType } from "../types/utils.js";
import { isDiscarded } from "./teardown.js";

/**
 * TextElement — wraps a DOM Text node.
 * 
 * Supports reactive text updates without re-creating the node.
 * When `update(newText)` is called, only the textContent changes — 
 * no DOM removal/insertion needed.
 */
const NO_KEYS: string[] = [];
/** Chỉ để thoả HtmlInterface — không ai ghi vào. */
const NO_NODES = Object.freeze([]) as unknown as Node[];

export class TextElement implements TextInterface {
    saoType: SaoObjectType = 'TextElement';
    private _element: Text | null = null;
    public parent: HtmlInterface | null;
    private ctx: ViewControllerInterface;
    private statekeys: string[];
    private unsubscribe: (() => void) | null = null;
    /** null = chữ tĩnh, giá trị nằm sẵn trong `_text`. */
    protected generateText: (() => string) | null = null;
    public _text: string = '';
    public shouldEscapeHTML: boolean = true; // Whether to escape HTML in text content

    public isStarted: boolean = false;
    readonly isStatic: boolean;


    domChildren: Node[] = NO_NODES; // For compatibility with HtmlInterface; Text itself doesn't have a single root element
    constructor({ ctx, parent = null, stateKeys = NO_KEYS, generateText = null, text = '', isEscapeHTML = true }: { ctx: ViewControllerInterface, parent?: HtmlInterface | null, stateKeys?: string[], generateText?: (() => string) | null, text?: string, isEscapeHTML?: boolean }) {
        this.ctx = ctx;
        this.generateText = generateText;
        this.parent = parent;
        this.statekeys = stateKeys;
        this.isStatic = stateKeys.length === 0;
        this.shouldEscapeHTML = isEscapeHTML;
        // FIX(baseline#3): KHÔNG escapeHTML khi ghi vào Text node — text node tự an toàn,
        // escape thủ công gây double-escape. shouldEscapeHTML chỉ dùng cho SSR string path.
        this._text = generateText ? generateText() : text;
    }

    /**
     * Text node tạo LƯỜI. Mỗi lượt re-render compiler gọi lại `this.text(...)`
     * cho mọi đoạn chữ tĩnh, rồi `reuseStaticText` bỏ ngay bản mới để giữ node
     * cũ — tạo sẵn DOM node ở constructor là tạo ra để vứt.
     */
    get element(): Text {
        return this._element ??= document.createTextNode(this._text);
    }
    set element(node: Text) {
        this._element = node;
    }

    /** Start reactive text updates */
    start(): void {
        if (this.isStarted) return;
        this.isStarted = true;
        if (this.statekeys.length > 0) {
            this.unsubscribe = this.ctx.states.__.subscribe(this.statekeys, (newText: string) => {
                this.update(this.generateText ? this.generateText() : this._text);
            });
        }
    }
    stop(): void {
        if (!this.isStarted) return;
        this.isStarted = false;
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
    setParentElement(parent: HtmlInterface | null): void {
        this.parent = parent;
    }

    /** Update text content in-place */
    update(newText: string): void {
        if (this._text !== newText) {
            this._text = newText;
            if (this._element) this._element.data = newText;
        }
    }

    render(): HTMLElement | Text | Comment {
        if (this.generateText) this.update(this.generateText());
        return this.element;
    }

    replaceStaticText(text: string): void {
        this.generateText = null;
        this.update(text);
    }

    remove(): void {
        this._element?.remove();
    }

    /** Registry guard — element đã destroy không được reuse */
    public __destroyed__: boolean = false;

    destroy(): void {
        this.__destroyed__ = true;
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this._element && !isDiscarded(this._element)) this._element.remove();
        this.parent = null;
    }

    get text(): string {
        return this._text;
    }

    set text(newText: string) {
        this.update(newText);
    }

    get isSaoElement(): boolean {
        return true;
    }
    set isSaoElement(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for Text elements
    }
    get isOneText(): boolean {
        return true;
    }
    set isOneText(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for Text elements
    }
}
