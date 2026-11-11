import type { HtmlInterface, TextInterface } from "../contracts/ElementInterface.js";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface.js";
import { SaoObjectType } from "../types/utils.js";
export declare class TextElement implements TextInterface {
    saoType: SaoObjectType;
    private _element;
    parent: HtmlInterface | null;
    private ctx;
    private statekeys;
    private unsubscribe;
    /** null = chữ tĩnh, giá trị nằm sẵn trong `_text`. */
    protected generateText: (() => string) | null;
    _text: string;
    shouldEscapeHTML: boolean;
    isStarted: boolean;
    readonly isStatic: boolean;
    domChildren: Node[];
    constructor({ ctx, parent, stateKeys, generateText, text, isEscapeHTML }: {
        ctx: ViewControllerInterface;
        parent?: HtmlInterface | null;
        stateKeys?: string[];
        generateText?: (() => string) | null;
        text?: string;
        isEscapeHTML?: boolean;
    });
    /**
     * Text node tạo LƯỜI. Mỗi lượt re-render compiler gọi lại `this.text(...)`
     * cho mọi đoạn chữ tĩnh, rồi `reuseStaticText` bỏ ngay bản mới để giữ node
     * cũ — tạo sẵn DOM node ở constructor là tạo ra để vứt.
     */
    get element(): Text;
    set element(node: Text);
    /** Start reactive text updates */
    start(): void;
    stop(): void;
    setParentElement(parent: HtmlInterface | null): void;
    /** Update text content in-place */
    update(newText: string): void;
    render(): HTMLElement | Text | Comment;
    replaceStaticText(text: string): void;
    remove(): void;
    /** Registry guard — element đã destroy không được reuse */
    __destroyed__: boolean;
    destroy(): void;
    get text(): string;
    set text(newText: string);
    get isSaoElement(): boolean;
    set isSaoElement(value: boolean);
    get isOneText(): boolean;
    set isOneText(value: boolean);
}
//# sourceMappingURL=TextElement.d.ts.map