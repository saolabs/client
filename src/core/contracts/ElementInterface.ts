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
    defaultValue: string;
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
            /** `@yield(name, ...)` used as the whole attribute value — no static stateKeys
             *  (the section it resolves to is only known at runtime), so Html subscribes to
             *  SectionManager by name instead. */
            yieldName?: string;
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
    /**
     * `@click.prevent.stop(...)` — bucket RIÊNG cạnh `events` để shape
     * `events: {click: [...]}` (contract sẵn có) không đổi; view compile trước
     * khi có modifier không có key này và chạy y nguyên.
     */
    eventModifiers?: {
        [key: string]: EventModifier[];
    },
    /** `@bind(key)`/`@val(key)` — two-way binding, own bucket (sibling of attrs/props/events). */
    bind?: {
        key: string;
    },
    /**
     * `@transition('fade')` — tiền tố class enter/leave (`fade-enter-from`, ...).
     * Bucket riêng như `bind`/`eventModifiers`; vắng mặt = hành vi cũ y nguyên.
     */
    transition?: {
        name: string;
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

/**
 * Modifier của `@click.prevent.stop(...)`. Phải khớp `EVENT_MODIFIERS` trong
 * `compiler/src/sao2js/template_ast.py` — compiler chỉ emit tên trong tập đó.
 */
export type EventModifier = 'prevent' | 'stop' | 'self' | 'once';

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

/**
 * Lazy payload passed from a parent component to one ChildrenNode placeholder.
 * A factory is deliberately not executed while component data is resolved; the
 * child view invokes it only when its render traversal reaches the placeholder.
 */
export type SaoChildrenSlotFactory = SaoChildrenFactory;
export type SaoChildrenSlotContent = SaoChildrenSlotFactory | string | number | null | undefined;
