import type { HtmlInterface, TextInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { escapeHTML } from "../hellpers/utils";
import { OneObjectType } from "../types/utils";

/**
 * TextElement — wraps a DOM Text node.
 * 
 * Supports reactive text updates without re-creating the node.
 * When `update(newText)` is called, only the textContent changes — 
 * no DOM removal/insertion needed.
 */
export class TextElement implements TextInterface {
    oneType: OneObjectType = 'TextElement';
    public element: Text;
    public parent: HtmlInterface | null;
    private ctx: ViewControllerInterface;
    private statekeys: string[] = [];
    private unsubscribe: (() => void) | null = null;
    protected generateText: () => string = () => this._text;
    public _text: string = '';
    public shouldEscapeHTML: boolean = true; // Whether to escape HTML in text content

    public isStarted: boolean = false;


    domChildren: Node[] = []; // For compatibility with HtmlInterface; Text itself doesn't have a single root element
    constructor({ ctx, parent = null, stateKeys = [], generateText = () => '', isEscapeHTML = true }: { ctx: ViewControllerInterface, parent?: HtmlInterface | null, stateKeys?: string[], generateText?: () => string, isEscapeHTML?: boolean }) {
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
    start(): void {
        if (this.isStarted) return;
        this.isStarted = true;
        if (this.statekeys.length > 0) {
            this.unsubscribe = this.ctx.states.__.subscribe(this.statekeys, (newText: string) => {
                this.update(this.generateText());
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
        
    }

    /** Update text content in-place */
    update(newText: string): void {
        if (this._text !== newText) {
            this._text = newText;
            this.element.textContent = this.shouldEscapeHTML ? escapeHTML(newText) : newText;
        }
    }

    render(): void {
        if (this.parent && this.parent.element) {
            this.parent.element.appendChild(this.element);
        }
    }

    remove(): void {
        this.element.remove();
    }

    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.element.remove();
        this.parent = null;
    }

    get text(): string {
        return this._text;
    }

    set text(newText: string) {
        this.update(newText);
    }

    get isOneElement(): boolean {
        return true;
    }
    set isOneElement(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for Text elements
    }
    get isOneText(): boolean {
        return true;
    }
    set isOneText(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for Text elements
    }
}
