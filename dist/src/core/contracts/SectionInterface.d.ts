import type { SaoElementChildren } from "../types/utils";
import type { ViewControllerInterface } from "./ViewControllerInterface";
import type { HtmlInterface } from "./ElementInterface";
export type SectionItemType = 'static' | 'dynamic' | 'async' | 'reactive';
export type SectionContentType = 'text' | 'html';
export type SectionContentRenderer = (parentElement?: HtmlInterface | null | undefined) => string | SaoElementChildren;
export type SectionConstruvtorArgs = {
    ctx?: ViewControllerInterface | null;
    name: string;
    type: SectionItemType;
    contentType?: SectionContentType;
    stateKeys?: string[];
    renderFactory: SectionContentRenderer;
    [key: string]: any;
};
export interface SectionInterface {
    ctx?: ViewControllerInterface | null;
    /** Owning view instance — mirrors Block/BlockOutlet keying (`name` + `viewId`). */
    viewId?: string | null;
    name: string;
    type: SectionItemType;
    contentType?: SectionContentType;
    stateKeys?: string[];
    renderFactory?: SectionContentRenderer;
}
export interface SectionManagerInterface {
    sections: Map<string, SectionInterface>;
    subscribers: Map<string, ((section: SectionInterface) => void)[]>;
    add(section: SectionInterface): void;
    subscribe(name: string, callback: (section: SectionInterface) => void): () => void;
    unsubscribe(name: string, callback?: (section: SectionInterface) => void): void;
    /** Register a @yield(...) marker so mountViewSections() can find it by name. */
    addYield(id: string, yieldEl: any): void;
    /** Resolve the current value of a named section synchronously — used by `this.yieldContent()` in attribute/prop bindings. */
    resolve(name: string, defaultValue?: any): any;
    /** Mount sections owned by one controller (page or layout) into their matching yields. Mirrors BlockManagerService.mountViewBlocks(). */
    mountViewSections(viewId: string): void;
    /** Hydrate counterpart — claim SSR content, no DOM insertion, only (re)subscribe. */
    hydrateViewSections(viewId: string): void;
    startAll(): void;
    stopAll(): void;
    unmountView(viewId: string): void;
    removeYieldsOfView(viewId: string): void;
    /** Revert every page-scoped head tag (title/meta) before mounting a new page's chain. */
    resetPageHead(): void;
    destroy(): void;
}
//# sourceMappingURL=SectionInterface.d.ts.map