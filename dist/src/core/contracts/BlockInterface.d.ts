import type { OneObjectType } from "../types/utils";
import type { ViewControllerInterface } from "./ViewControllerInterface";
import type { HtmlInterface, FragmentInterface, OneChildrenFactoryOutput, OneNodeInterface } from "./ElementInterface";
import { InitMode } from "./common";
export type BlockConstructorParams = {
    ctx: ViewControllerInterface;
    name: string;
    viewId?: string | null;
    contentRenderFactory?: BlockRenderFactory;
    id?: string | null;
    initMode?: InitMode;
};
export interface BlockInterface {
    oneType: OneObjectType;
    /** Unique block slot name (e.g. 'content', 'sidebar') */
    name: string;
    id: string;
    ctx: ViewControllerInterface;
    viewId: string | null;
    openTag: Comment;
    closeTag: Comment;
    fragment: FragmentInterface | null;
    parentElement: HtmlInterface | null;
    domChildren: Node[];
    isOneElement: boolean;
    isOneBlock: boolean;
    initMode?: InitMode;
    /** Initialize the block (e.g. during hydration) */
    init(): void;
    /** Render the block's content into the parent element */
    render(): void;
    /** Mount the block's content into the DOM, finding matching outlets */
    mount(mountCtx: ViewControllerInterface, parentElement: HtmlInterface): any;
    /** Unmount the block's content from the DOM */
    unmount(): void;
    /** Destroy the block and clean up resources */
    destroy(): void;
    /** Update the block's content (e.g. on state change) */
    update(): void;
    /** Set the block's parent element (used for mounting) */
    setParentElement(parentElement: HtmlInterface | null): void;
    contentRenderFactory: BlockRenderFactory | null;
}
export interface BlockOutletInterface extends OneNodeInterface {
    oneType: OneObjectType;
    id: string;
    name: string;
    parent: HtmlInterface | null;
    openTag: Comment;
    closeTag: Comment;
    parentElement: HtmlInterface | null;
    ctx: ViewControllerInterface;
    initMode: InitMode;
    isOneElement: boolean;
    isOneBlockOutlet: boolean;
    /** Render the outlet's markers into the parent element */
    render(): any;
    hydrate(): any;
    destroy(): any;
    start(): any;
    stop(): any;
    setParentElement(parentElement: HtmlInterface | null): any;
}
export interface BlockManagerInterface {
}
export type BlockRenderFactory = (parentElement: HtmlInterface) => OneChildrenFactoryOutput;
//# sourceMappingURL=BlockInterface.d.ts.map