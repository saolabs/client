import { InitMode } from "../contracts/common";
import { HtmlInterface, OneChildrenFactoryOutput, YieldInterface } from "../contracts/ElementInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { OneObjectType } from "../types/utils";
export declare class YieldElement implements YieldInterface {
    oneType: OneObjectType;
    ctx: ViewControllerInterface;
    name: string;
    id: string;
    contentFactory: () => OneChildrenFactoryOutput;
    openTag: Comment;
    closeTag: Comment;
    initMode: InitMode;
    domChildren: Node[];
    parent: HtmlInterface | null;
    defaultValue: string;
    constructor({ ctx, name, initMode, id, defaultValue }: {
        ctx: ViewControllerInterface;
        name: string;
        initMode?: InitMode;
        id?: string | null;
        defaultValue?: string;
    });
    private createMarkers;
    setParentElement(parent: HtmlInterface | null): void;
    setContentFactory(factory: () => OneChildrenFactoryOutput): void;
    render(): void;
    destroy(): void;
    get isOneElement(): boolean;
    set isOneElement(_: boolean);
    get isOneYield(): boolean;
    set isOneYield(_: boolean);
}
//# sourceMappingURL=Yield.d.ts.map