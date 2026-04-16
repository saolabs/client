import type { OneObjectType } from "../types/utils";
import type { ViewControllerInterface } from "./ViewControllerInterface";
import type { ViewInterface } from "./ViewInterface";
import type { HtmlInterface } from "./ElementInterface";

// ─── Component Interface ─────────────────────────────────────────

export interface ComponentInterface {
    oneType: OneObjectType;
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
    isOneElement: boolean;
    isOneComponent: boolean;
    [key: string]: any;
}
