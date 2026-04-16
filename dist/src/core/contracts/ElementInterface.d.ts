import type { OneObjectType } from "../types/utils";
import type { ViewControllerInterface } from "./ViewControllerInterface";
import type { ReactiveInterface } from "./ReactiveInterface";
/** Base for any renderable node in the tree */
export interface OneNodeInterface {
    oneType: OneObjectType;
    parent: HtmlInterface | null;
    render(): void;
    destroy(): void;
    isOneElement: boolean;
    setParentElement(parent: HtmlInterface | null): void;
    [key: string]: any;
}
/** Native HTML element wrapper */
export interface HtmlInterface extends OneNodeInterface {
    element: HTMLElement;
    domChildren: Node[];
    [key: string]: any;
}
/** Text node wrapper */
export interface TextInterface extends OneNodeInterface {
    element: Text;
    text: string;
    domChildren: Node[];
    update(newText: string): void;
}
export interface OutputInterface extends OneNodeInterface {
    ctx: ViewControllerInterface;
    parent: HtmlInterface | null;
    stateKeys: string[];
    openTag: Comment;
    closeTag: Comment;
    domChildren: Node[];
    [key: string]: any;
}
export interface YieldInterface extends OneNodeInterface {
    ctx: ViewControllerInterface;
    parent: HtmlInterface | null;
    name: string;
    contentFactory: () => OneChildrenFactoryOutput;
    setContentFactory(factory: () => OneChildrenFactoryOutput): void;
    openTag: Comment;
    closeTag: Comment;
    domChildren: Node[];
    [key: string]: any;
}
/** Fragment — renders multiple root nodes into a parent without a wrapping tag */
export interface FragmentInterface extends OneNodeInterface {
    nodes: Node[];
    domChildren: Node[];
    [key: string]: any;
}
/** Wrapper — renders multiple root nodes into a parent without a wrapping tag */
export interface WrapperInterface extends OneNodeInterface {
    nodes: Node[];
    domChildren: Node[];
    [key: string]: any;
}
export type OneElementConfig = {
    attrs?: {
        [key: string]: {
            type: 'value' | 'binding';
            value?: any;
            stateKeys?: string[];
            factory?: () => any;
        };
    };
    props?: {
        [key: string]: {
            type: 'value' | 'binding';
            value?: any;
            stateKeys?: string[];
            factory?: () => any;
        };
    };
    events?: {
        [key: string]: OneElementEventHandler;
    };
    classes?: {
        [className: string]: {
            type: 'static' | 'binding';
            value?: boolean;
            stateKeys?: string[];
            factory?: () => boolean;
        };
    } | Array<{
        type: 'static' | 'binding';
        value?: string;
        stateKeys?: string[];
        factory?: () => boolean;
    }>;
    styles?: {
        [prop: string]: {
            type: 'value' | 'binding';
            value?: string;
            stateKeys?: string[];
            factory?: () => string;
        };
    };
    [key: string]: any;
};
export type HtmlElementConfig = OneElementConfig & {
    ctx: ViewControllerInterface;
    parentElement?: HtmlInterface | null;
    parent?: HtmlInterface | null;
};
export type OneElementEventHandler = Array<{
    handler: string | ((event: Event) => any);
    params?: (any | ((event: Event) => any[]))[];
} | ((event: Event) => any)>;
/** All possible rendered child node types */
export type OneElementChildren = Array<HtmlInterface | ReactiveInterface | TextInterface | FragmentInterface | HTMLElement | SVGElement | DocumentFragment | Text | Comment>;
/** What a children factory can return (before mounting) */
export type OneChildrenFactoryOutput = Array<HtmlInterface | ReactiveInterface | TextInterface | FragmentInterface | string | number | HTMLElement | SVGElement | DocumentFragment | Text | Comment>;
/** Factory function that produces children given parent element */
export type OneChildrenFactory = (parentElement: HtmlInterface | null) => OneChildrenFactoryOutput;
//# sourceMappingURL=ElementInterface.d.ts.map