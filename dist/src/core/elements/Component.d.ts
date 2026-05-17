import { InitMode } from "../contracts/common";
import { ComponentInterface } from "../contracts/ComponentInterface";
import { HtmlInterface } from "../contracts/ElementInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { ViewInterface } from "../contracts/ViewInterface";
import { SaoObjectType } from "../types/utils";
export declare class Component implements ComponentInterface {
    saoType: SaoObjectType;
    ctx: ViewControllerInterface;
    parent: HtmlInterface | null;
    domChildren: Node[];
    stateKeys: string[];
    data: Record<string, any>;
    openTag: Comment;
    closeTag: Comment;
    viewRef: ViewInterface | null;
    id: string;
    path: string | null;
    type: 'default' | 'if' | 'when';
    condition: {
        stateKeys: string[];
        checker: () => any;
    } | null;
    initMode: InitMode;
    subscribeFn: () => void;
    unsubscribeFn: () => void;
    dataFactory: ((parentElement: HtmlInterface | null) => Record<string, any>) | null;
    constructor({ ctx, parent, id, stateKeys, data, dataFactory, path, type, condition, initMode, }: {
        ctx: ViewControllerInterface;
        parent?: HtmlInterface | null;
        id?: string | null;
        stateKeys?: string[];
        data?: Record<string, any>;
        dataFactory?: ((parentElement: HtmlInterface | null) => Record<string, any>) | null;
        path?: string | null;
        type?: 'default' | 'if' | 'when';
        condition?: {
            stateKeys: string[];
            checker: () => any;
        } | null;
        initMode?: InitMode;
    });
    mergeData(newData: Record<string, any>): void;
    setDataFactory(factory: (parentElement: HtmlInterface | null) => Record<string, any>): void;
    setCondition(condition: {
        stateKeys: string[];
        checker: () => any;
    }): void;
    setStateKeys(stateKeys: string[]): void;
    setParentElement(parent: HtmlInterface | null): void;
    setView(view: ViewInterface): void;
    setParent(parent: HtmlInterface | null): void;
    start(): void;
    stop(): void;
    render(): void;
    destroy(): void;
    get isSaoElement(): boolean;
    set isSaoElement(value: boolean);
    get isOneComponent(): boolean;
    set isOneComponent(value: boolean);
}
//# sourceMappingURL=Component.d.ts.map