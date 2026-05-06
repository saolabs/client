import { InitMode, InitModes } from "../contracts/common";
import { ComponentInterface } from "../contracts/ComponentInterface";
import { HtmlInterface, OneChildrenFactory } from "../contracts/ElementInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { ViewInterface } from "../contracts/ViewInterface";
import { generateUUID } from "../helpers/utils";
import { OneObjectType } from "../types/utils";

export class Component implements ComponentInterface {
    oneType: OneObjectType = 'Component';
    ctx: ViewControllerInterface;
    parent: HtmlInterface | null;
    domChildren: Node[] = []; // For compatibility with HtmlInterface; Component itself doesn't have a single root element
    stateKeys: string[];
    data: Record<string, any>;
    openTag: Comment;
    closeTag: Comment;
    viewRef: ViewInterface | null = null;
    id: string;
    path: string | null = null; // For dynamic imports
    type: 'default' | 'if' | 'when' = 'default';
    condition: {stateKeys: string[], checker: () => any} | null = null; // For 'when' type components
    initMode: InitMode = InitModes.CREATE; // Default initialization mode
    subscribeFn: () => void = () => {};
    unsubscribeFn: () => void = () => {};
    dataFactory: ((parentElement: HtmlInterface | null) => Record<string, any>) | null = null; 

    constructor({
        ctx,
        parent = null,
        id = null,
        stateKeys = [],
        data = {},
        dataFactory = null,
        path = null,
        type = 'default',
        condition = null,
        initMode = InitModes.CREATE,
    }: {
        ctx: ViewControllerInterface;
        parent?: HtmlInterface | null;
        id?: string | null;
        stateKeys?: string[];
        data?: Record<string, any>;
        dataFactory?: ((parentElement: HtmlInterface | null) => Record<string, any>) | null;
        path?: string | null;
        type?: 'default' | 'if' | 'when';
        condition?: {stateKeys: string[], checker: () => any} | null;
        initMode?: InitMode;
    }) {
        this.ctx = ctx;
        this.parent = parent;
        this.stateKeys = stateKeys;
        this.data = data || {};
        this.openTag = document.createComment(`component-start`);
        this.closeTag = document.createComment(`component-end`);
        this.id = `${ctx.viewId}-${id ?? generateUUID(10)}`; // Unique ID for debugging
        this.dataFactory = dataFactory;
        this.path = path;
        this.type = type;
        this.condition = condition;
        this.initMode = initMode ?? InitModes.CREATE;
    }

    mergeData(newData: Record<string, any>): void {
        this.data = { ...this.data, ...newData };
    }

    setDataFactory(factory: (parentElement: HtmlInterface | null) => Record<string, any>) {
        this.dataFactory = factory;
    }
    setCondition(condition: {stateKeys: string[], checker: () => any}) {
        this.condition = condition;
    }
    setStateKeys(stateKeys: string[]) {
        this.stateKeys = stateKeys;
    }
    setParentElement(parent: HtmlInterface | null): void {
        this.parent = parent;
    }

    setView(view: ViewInterface) {
        this.viewRef = view;
    }
    setParent(parent: HtmlInterface | null): void {
        this.parent = parent;
    }

    start(): void {
    }

    stop(): void {
    }

    render(): void {
        // To be implemented by specific components
    }

    destroy(): void {
        // To be implemented by specific components
    }
    get isOneElement(): boolean {
        return true;
    }
    set isOneElement(value: boolean) {
        // No-op, just for type compatibility
    }
    get isOneComponent(): boolean {
        return true;
    }
    set isOneComponent(value: boolean) {
        // No-op, just for type compatibility
    }
}