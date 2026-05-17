import type { SaoElementChildren, SaoObjectType } from "../types/utils";
import type { ViewControllerInterface } from "./ViewControllerInterface";
import type { HtmlInterface, FragmentInterface, SaoChildrenFactoryOutput, SaoNodeInterface } from "./ElementInterface";
import { InitMode } from "./common";

export type SectionItemType = 'static' | 'dynamic' | 'async' | 'reactive';
export type SectionContentType = 'text' | 'html'
export type SectionContentRenderer = (parentElement?: HtmlInterface | null | undefined) => string | SaoElementChildren;
export type SectionConstruvtorArgs = {
    ctx?: ViewControllerInterface | null;
    name: string;
    type: SectionItemType;
    contentType?: SectionContentType;
    stateKeys?: string[];
    renderFactory: SectionContentRenderer;
    [key: string]: any;
}
export interface SectionInterface {
    ctx? : ViewControllerInterface | null;
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
}