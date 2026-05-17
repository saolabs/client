import type { BlockOutletInterface } from "../contracts/BlockInterface";
import { InitMode } from "../contracts/common";
import type { HtmlInterface } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { SaoObjectType } from "../types/utils";
export declare class BlockOutlet implements BlockOutletInterface {
    saoType: SaoObjectType;
    id: string;
    name: string;
    openTag: Comment;
    closeTag: Comment;
    parent: HtmlInterface | null;
    parentElement: HtmlInterface | null;
    ctx: ViewControllerInterface;
    initMode: InitMode;
    constructor({ ctx, parentElement, name, id, initMode }: {
        ctx: ViewControllerInterface;
        parentElement?: HtmlInterface | null;
        name: string;
        id?: string | null;
        initMode?: InitMode;
    });
    hydrate(): void;
    render(): void;
    destroy(): void;
    start(): void;
    stop(): void;
    setParentElement(parentElement: HtmlInterface | null): void;
    get isSaoElement(): boolean;
    set isSaoElement(value: boolean);
    get isOneBlockOutlet(): boolean;
    set isOneBlockOutlet(value: boolean);
}
//# sourceMappingURL=BlockOutlet.d.ts.map