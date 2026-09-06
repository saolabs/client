import type { SaoObjectType } from "../types/utils.js";
import type { ViewControllerInterface } from "./ViewControllerInterface.js";
import type { ViewInterface } from "./ViewInterface.js";
import type { HtmlInterface } from "./ElementInterface.js";

// ─── Component Interface ─────────────────────────────────────────

export interface ComponentInterface {
    saoType: SaoObjectType;
    id: string;
    ctx: ViewControllerInterface;
    viewRef: ViewInterface | null;
    parent: HtmlInterface | null;
    data: Record<string, any>;
    openTag: Comment;
    closeTag: Comment;
    stateKeys: string[];
    subscribeFn: () => void;
    unsubscribeFn: () => void;
    render(): void;
    destroy(): void;
    setParent(parent: HtmlInterface | null): void;
    isSaoElement: boolean;
    isOneComponent: boolean;
    [key: string]: any;
}
