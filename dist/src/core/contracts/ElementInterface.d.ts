import type { SaoObjectType } from "../types/utils";
import type { ViewControllerInterface } from "./ViewControllerInterface";
import type { ReactiveInterface } from "./ReactiveInterface";
/** Base for any renderable node in the tree */
export interface SaoNodeInterface {
    saoType: SaoObjectType;
    parent: HtmlInterface | null;
    render(): void;
    destroy(): void;
    isSaoElement: boolean;
    setParentElement(parent: HtmlInterface | null): void;
    [key: string]: any;
}
/** Native HTML element wrapper */
export interface HtmlInterface extends SaoNodeInterface {
    element: HTMLElement;
    domChildren: Node[];
    [key: string]: any;
}
/** Text node wrapper */
export interface TextInterface extends SaoNodeInterface {
    element: Text;
    text: string;
    domChildren: Node[];
    update(newText: string): void;
}
export interface OutputInterface extends SaoNodeInterface {
    ctx: ViewControllerInterface;
    parent: HtmlInterface | null;
    stateKeys: string[];
    openTag: Comment;
    closeTag: Comment;
    domChildren: Node[];
    [key: string]: any;
}
export interface YieldInterface extends SaoNodeInterface {
    ctx: ViewControllerInterface;
    parent: HtmlInterface | null;
    name: string;
    contentFactory: () => SaoChildrenFactoryOutput;
    setContentFactory(factory: () => SaoChildrenFactoryOutput): void;
    openTag: Comment;
    closeTag: Comment;
    domChildren: Node[];
    [key: string]: any;
}
/** Fragment — renders multiple root nodes into a parent without a wrapping tag */
export interface FragmentInterface extends SaoNodeInterface {
    nodes: Node[];
    domChildren: Node[];
    [key: string]: any;
}
/** Wrapper — renders multiple root nodes into a parent without a wrapping tag */
export interface WrapperInterface extends SaoNodeInterface {
    nodes: Node[];
    domChildren: Node[];
    [key: string]: any;
}
export type SaoElementConfig = {
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
        [key: string]: SaoElementEventHandler;
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
export type HtmlElementConfig = SaoElementConfig & {
    ctx: ViewControllerInterface;
    parentElement?: HtmlInterface | null;
    parent?: HtmlInterface | null;
};
export type SaoElementEventHandler = Array<{
    handler: string | ((event: Event) => any);
    params?: (any | ((event: Event) => any[]))[];
} | ((event: Event) => any)>;
/** All possible rendered child node types */
export type SaoElementChildren = Array<HtmlInterface | ReactiveInterface | TextInterface | FragmentInterface | HTMLElement | SVGElement | DocumentFragment | Text | Comment>;
/** What a children factory can return (before mounting) */
export type SaoChildrenFactoryOutput = Array<HtmlInterface | ReactiveInterface | TextInterface | FragmentInterface | string | number | HTMLElement | SVGElement | DocumentFragment | Text | Comment>;
/** Factory function that produces children given parent element */
export type SaoChildrenFactory = (parentElement: HtmlInterface | null) => SaoChildrenFactoryOutput;
//# sourceMappingURL=ElementInterface.d.ts.map