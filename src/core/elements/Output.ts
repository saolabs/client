import { InitMode, InitModes } from "../contracts/common";
import type { HtmlInterface, OutputInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { escapeHTML, generateUUID } from "../helpers/utils";
import type { OneObjectType } from "../types/utils";

/**
 * Output — reactive text output between comment markers.
 * 
 * Compiled từ: {{ $expression }}   → output({ctx, parentElement, stateKeys, isEscapeHTML: true}, () => expression)
 * Compiled từ: {!! $expression !!} → output({ctx, parentElement, stateKeys, isEscapeHTML: false}, () => expression)
 * 
 * Render: Tạo Text node giữa <!--o:id-s--> và <!--o:id-e-->
 * Update: Khi stateKeys thay đổi → re-evaluate contentFactory → update textContent
 */
export class Output implements OutputInterface {
    oneType: OneObjectType = 'Output';
    ctx: ViewControllerInterface;
    parent: HtmlInterface | null;
    openTag: Comment;
    closeTag: Comment;
    stateKeys: string[];
    contentFactory: () => string;
    isEscapeHTML: boolean;
    domChildren: Node[] = []; // For compatibility with HtmlInterface; Output itself doesn't have a single root element
    private textNode: Text | null = null;
    private unsubscribe: (() => void) | null = null;
    private _isStarted = false;
    private _isDestroyed = false;
    private id: string;
    initMode: InitMode = InitModes.CREATE;

    constructor({
        ctx,
        id = null,
        parent = null,
        stateKeys = [],
        contentFactory = () => '',
        isEscapeHTML = true,
        initMode = InitModes.CREATE
    }: {
        ctx: ViewControllerInterface;
        id?: string | null;
        parent?: HtmlInterface | null;
        stateKeys?: string[];
        contentFactory?: () => string;
        isEscapeHTML?: boolean;
        initMode?: InitMode;
    }) {
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

    setParentElement(parent: HtmlInterface | null): void {
        this.parent = parent;
    }
    setContentFactory(factory: () => string): void {
        this.contentFactory = factory;
    }
    setStateKeys(stateKeys: string[]): void {
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
    render(): void {
        if (!this.parent?.element || this._isDestroyed) return;

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
    start(): void {
        if (this._isStarted || this._isDestroyed) return;
        this._isStarted = true;

        if (this.stateKeys.length > 0) {
            this.unsubscribe = this.ctx.states.__.subscribe(
                this.stateKeys,
                () => this.update()
            );
        }
    }

    /**
     * Stop — unsubscribe from state changes.
     */
    stop(): void {
        if (!this._isStarted) return;
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
    private update(): void {
        if (!this.textNode || this._isDestroyed) return;

        const rawText = String(this.contentFactory() ?? '');
        const displayText = this.isEscapeHTML ? escapeHTML(rawText) : rawText;

        if (this.textNode.textContent !== displayText) {
            this.textNode.textContent = displayText;
        }
    }

    /**
     * Destroy — cleanup everything.
     */
    destroy(): void {
        if (this._isDestroyed) return;
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

    get isOneElement(): boolean { return true; }
    set isOneElement(_: boolean) {}
    get isOneOutput(): boolean { return true; }
    set isOneOutput(_: boolean) {}
}