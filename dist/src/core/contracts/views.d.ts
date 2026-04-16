import { HtmlInterface, OneElementChildren } from "./ElementInterface";
import { ViewControllerInterface } from "./utils";
export type SectionItemType = 'static' | 'dynamic' | 'async' | 'reactive';
export type SectionContentType = 'text' | 'html';
export type SectionContentRenderer = (parentElement?: HtmlInterface | null | undefined) => string | OneElementChildren;
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
    name: string;
    type: SectionItemType;
    contentType?: SectionContentType;
    stateKeys?: string[];
    renderFactory?: SectionContentRenderer;
}
//# sourceMappingURL=views.d.ts.map