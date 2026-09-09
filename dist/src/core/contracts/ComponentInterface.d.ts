import type { SaoObjectType } from "../types/utils.js";
import type { ViewControllerInterface } from "./ViewControllerInterface.js";
import type { ViewInterface } from "./ViewInterface.js";
import type { HtmlInterface } from "./ElementInterface.js";
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
    listeners: Record<string, (...args: any[]) => any>;
    subscribeFn: () => void;
    unsubscribeFn: () => void;
    render(): void;
    destroy(): void;
    setParent(parent: HtmlInterface | null): void;
    isSaoElement: boolean;
    isOneComponent: boolean;
    [key: string]: any;
}
//# sourceMappingURL=ComponentInterface.d.ts.map