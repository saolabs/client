import type { SaoObjectType } from "../types/utils";
import type { ViewControllerInterface } from "./ViewControllerInterface";
import type { ReactiveInterface } from "./ReactiveInterface";

// ─── Element Interfaces ──────────────────────────────────────────

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
    clearHTML(): void;
    appendElement(element: HTMLElement | Comment | Text): void;
    getElement(): HTMLElement;
    renderChildren(): SaoElementChildren;
    render(): HTMLElement;
}

/** Text node wrapper */
export interface TextInterface extends SaoNodeInterface {
    element: Text;
    text: string;


    domChildren: Node[];
    update(newText: string): void;
    render(): HTMLElement | Text | Comment;
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
    /** Render — chạy childrenFactory, trả về danh sách children đã tạo. */
    render(): SaoElementChildren;
    appendTo(parent: HtmlInterface): void;
    mountTo(parent: HtmlInterface): void;
    clear(): void;
    setChildrenFactory(factory: SaoChildrenFactory): void;
    children: SaoElementChildren;
    openTag: Comment;
    closeTag: Comment;

}

// ─── Element Config Types ────────────────────────────────────────

/**
 * Contract chuẩn (RUNTIME_CONTRACT.md §1.1): type = 'static' | 'binding'.
 * 'value' giữ làm legacy alias của 'static' đến v0.2.
 */
export type BindingConfigType = 'static' | 'binding' | 'value';

export type SaoElementConfig = {
    attrs?: {
        [key: string]: {
            type: BindingConfigType;
            value?: any;
            stateKeys?: string[];
            factory?: () => any;
        }
    },
    props?: {
        [key: string]: {
            type: BindingConfigType;
            value?: any;
            stateKeys?: string[];
            factory?: () => any;
        }
    },
    events?: {
        [key: string]: SaoElementEventHandler;
    },
    classes?: {
        [className: string]: {
            type: 'static' | 'binding';
            value?: boolean;
            stateKeys?: string[];
            factory?: () => boolean;
        }
    } | Array<{
        type: 'static' | 'binding';
        value?: string;
        stateKeys?: string[];
        factory?: () => boolean;
    }>,
    styles?: {
        [prop: string]: {
            type: BindingConfigType;
            value?: string;
            stateKeys?: string[];
            factory?: () => string;
        }
    },
    [key: string]: any;
}

export type HtmlElementConfig = SaoElementConfig & {
    ctx: ViewControllerInterface;
    parentElement?: HtmlInterface | null;
    parent?: HtmlInterface | null;
}

// ─── Event Handler ──────────────────────────────────────────────

export type SaoElementEventHandler = Array<{
    handler: string | ((event: Event) => any);
    params?: (any | ((event: Event) => any[]))[];
} | ((event: Event) => any)>;

export type SaoElement = WrapperInterface | HtmlInterface | ReactiveInterface | TextInterface | FragmentInterface;
export type DOMElement = HTMLElement | SVGElement | DocumentFragment | Text | Comment;
// ─── Children Types ─────────────────────────────────────────────

/** All possible rendered child node types */
export type SaoElementChildren = Array<SaoElement | SaoNodeInterface | DOMElement>;

/** What a children factory can return (before mounting).
 *  SaoNodeInterface bao phủ các marker-based element (Output, Component, Block...)
 *  mà compiled output vẫn trả về trong children factories. */
export type SaoChildrenFactoryOutput = Array<SaoElement | SaoNodeInterface | DOMElement | string | number | null | undefined>;

/** Factory function that produces children given parent element */
export type SaoChildrenFactory = (parentElement: HtmlInterface | null) => SaoChildrenFactoryOutput;
