import type { HtmlInterface, TextInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { SaoObjectType } from "../types/utils";
/**
 * TextElement — wraps a DOM Text node.
 *
 * Supports reactive text updates without re-creating the node.
 * When `update(newText)` is called, only the textContent changes —
 * no DOM removal/insertion needed.
 */
export declare class TextElement implements TextInterface {
    saoType: SaoObjectType;
    element: Text;
    parent: HtmlInterface | null;
    private ctx;
    private statekeys;
    private unsubscribe;
    protected generateText: () => string;
    _text: string;
    shouldEscapeHTML: boolean;
    isStarted: boolean;
    domChildren: Node[];
    constructor({ ctx, parent, stateKeys, generateText, isEscapeHTML }: {
        ctx: ViewControllerInterface;
        parent?: HtmlInterface | null;
        stateKeys?: string[];
        generateText?: () => string;
        isEscapeHTML?: boolean;
    });
    /** Start reactive text updates */
    start(): void;
    stop(): void;
    setParentElement(parent: HtmlInterface | null): void;
    /** Update text content in-place */
    update(newText: string): void;
    render(): void;
    remove(): void;
    destroy(): void;
    get text(): string;
    set text(newText: string);
    get isSaoElement(): boolean;
    set isSaoElement(value: boolean);
    get isOneText(): boolean;
    set isOneText(value: boolean);
}
//# sourceMappingURL=TextElement.d.ts.map