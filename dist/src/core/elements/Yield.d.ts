import { InitMode } from "../contracts/common";
import { HtmlInterface, YieldInterface } from "../contracts/ElementInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { SaoObjectType } from "../types/utils";
export declare class YieldElement implements YieldInterface {
    saoType: SaoObjectType;
    ctx: ViewControllerInterface;
    name: string;
    id: string;
    openTag: Comment;
    closeTag: Comment;
    initMode: InitMode;
    domChildren: Node[];
    parent: HtmlInterface | null;
    defaultValue: string;
    /** Registry guard — thiếu field này thì aliveFromRegistry tái dùng Yield đã destroy */
    __destroyed__: boolean;
    constructor({ ctx, name, initMode, id, defaultValue }: {
        ctx: ViewControllerInterface;
        name: string;
        initMode?: InitMode;
        id?: string | null;
        defaultValue?: string;
    });
    private createMarkers;
    setParentElement(parent: HtmlInterface | null): void;
    /** Idempotent: markers already in DOM (hydrate claim, or same-layout reuse) → keep as-is. */
    render(): void;
    destroy(): void;
    get isSaoElement(): boolean;
    set isSaoElement(_: boolean);
    get isOneYield(): boolean;
    set isOneYield(_: boolean);
}
//# sourceMappingURL=Yield.d.ts.map