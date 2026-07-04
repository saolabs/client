import { InitMode, InitModes } from "../contracts/common";
import type { HtmlInterface, OutputInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { generateUUID } from "../helpers/utils";
import markerRegistry from "../services/MarkerRegistry";
import type { SaoObjectType } from "../types/utils";

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
    saoType: SaoObjectType = 'Output';
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

        if (this.initMode === InitModes.HYDRATE) {
            // ── SSR Hydration: tìm markers đã có trong DOM ──────────────────
            // Blade emit: <!--o:{viewId}-{id}-s--> ... <!--o:{viewId}-{id}-e-->
            // Nếu tìm thấy → claim, kèm text node giữa markers.
            // Nếu không → tạo mới (partial hydration fallback).
            const claimed = this.claimSSRMarkers();
            if (claimed) {
                this.openTag = claimed.open;
                this.closeTag = claimed.close;
                this.textNode = claimed.textNode;
            } else {
                this.openTag = markerRegistry.createMarkerStart('output', this.id);
                this.closeTag = markerRegistry.createMarkerEnd('output', this.id);
            }
        } else {
            // ── CSR: tạo markers mới ─────────────────────────────────────────
            this.openTag = markerRegistry.createMarkerStart('output', this.id);
            this.closeTag = markerRegistry.createMarkerEnd('output', this.id);
        }
    }

    /**
     * Tìm cặp comment markers và text node từ server-rendered HTML.
     *
     * Duyệt comment nodes trong parent element, tìm cặp khớp format chuẩn §5.1:
     *   open:  `s:o:{this.id}-s`
     *   close: `s:o:{this.id}-e`
     *
     * Nếu có text node giữa 2 markers → claim luôn để không tạo thừa.
     */
    private claimSSRMarkers(): { open: Comment; close: Comment; textNode: Text | null } | null {
        const searchRoot = this.parent?.element ?? document.body;
        const walker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_COMMENT);

        const openText = markerRegistry.openComment('output', this.id);
        const closeText = markerRegistry.closeComment('output', this.id);
        let openNode: Comment | null = null;

        let node: Comment | null;
        while ((node = walker.nextNode() as Comment | null)) {
            const value = node.nodeValue?.trim() ?? '';

            if (!openNode && value === openText) {
                openNode = node;
                continue;
            }
            if (openNode && value === closeText) {
                // Tìm text node giữa open và close markers
                let textNode: Text | null = null;
                let sibling = openNode.nextSibling;
                while (sibling && sibling !== node) {
                    if (sibling.nodeType === Node.TEXT_NODE) {
                        textNode = sibling as Text;
                        break;
                    }
                    sibling = sibling.nextSibling;
                }
                return { open: openNode, close: node, textNode };
            }
        }
        return null;
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

    /** Nodes của raw HTML mode ({!! !!}) — track để clear khi update */
    private rawNodes: Node[] = [];

    /**
     * Render — idempotent + position-aware (RUNTIME_CONTRACT.md §2):
     *   - Markers chưa nằm trong DOM → caller chưa đặt → tự append vào parent
     *     (đường mountElementList: thứ tự duyệt tuần tự nên vị trí đúng).
     *   - Markers ĐÃ nằm trong DOM (caller như Reactive đã chèn đúng chỗ)
     *     → chỉ render nội dung GIỮA markers. FIX(baseline#6).
     */
    render(): void {
        if (this._isDestroyed) return;

        // ── Hydrate mode: markers đã trong DOM, text node đã claim ──────
        // Chỉ cần đảm bảo markers có mặt và text đồng bộ với state hiện tại.
        // Không tạo thêm node, không clear — giữ nguyên DOM server-rendered.
        if (this.initMode === InitModes.HYDRATE && this.openTag.parentNode && this.textNode) {
            return;
        }

        if (!this.openTag.parentNode) {
            const parentEl = this.parent?.element;
            if (!parentEl) return;
            parentEl.appendChild(this.openTag);
            parentEl.appendChild(this.closeTag);
        }

        this.clearContent();

        const rawText = String(this.contentFactory() ?? '');
        if (this.isEscapeHTML) {
            this.textNode = document.createTextNode(rawText);
            this.insertBeforeClose(this.textNode);
        } else {
            this.renderRaw(rawText);
        }
    }

    /** Xoá toàn bộ nodes giữa open/close markers */
    private clearContent(): void {
        let current: Node | null = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next: Node | null = current.nextSibling;
            (current as ChildNode).remove();
            current = next;
        }
        this.textNode = null;
        this.rawNodes = [];
    }

    private insertBeforeClose(node: Node): void {
        this.closeTag.parentNode?.insertBefore(node, this.closeTag);
    }

    /** Parse HTML string → DOM nodes thật, chèn giữa markers */
    private renderRaw(html: string): void {
        if (!html) return;
        const range = document.createRange();
        const container = (this.closeTag.parentNode as HTMLElement) ?? document.body;
        range.selectNodeContents(container);
        const fragment = range.createContextualFragment(html);
        this.rawNodes = Array.from(fragment.childNodes);
        this.insertBeforeClose(fragment);
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
     * Update — re-evaluate contentFactory.
     * Escaped mode: O(1) — chỉ thay textContent.
     * Raw mode: clear giữa markers → parse + chèn lại.
     */
    private update(): void {
        if (this._isDestroyed) return;

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
            } else {
                this.renderRaw(rawText);
            }
        }
    }

    /**
     * Destroy — cleanup everything.
     */
    /** Registry guard — alias của _isDestroyed cho ViewController.aliveFromRegistry */
    public get __destroyed__(): boolean { return this._isDestroyed; }

    destroy(): void {
        if (this._isDestroyed) return;
        this._isDestroyed = true;
        this.stop();

        // Remove mọi nội dung giữa markers (text node hoặc raw nodes)
        let current: Node | null = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next: Node | null = current.nextSibling;
            (current as ChildNode).remove();
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

    get isSaoElement(): boolean { return true; }
    set isSaoElement(_: boolean) {}
    get isOneOutput(): boolean { return true; }
    set isOneOutput(_: boolean) {}
}