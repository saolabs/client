import type { SaoObjectType } from "../types/utils";
import type { ViewControllerInterface } from "./ViewControllerInterface";
import type { ViewInterface } from "./ViewInterface";
import type { HtmlInterface } from "./ElementInterface";
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
//# sourceMappingURL=ComponentInterface.d.ts.map