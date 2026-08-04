import { HtmlInterface } from "../contracts/ElementInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { SectionConstruvtorArgs, SectionContentRenderer, SectionContentType, SectionInterface, SectionItemType } from "../contracts/SectionInterface";
/**
 * Section — a `@section(name, ...)` declaration.
 *
 * A thin data holder: it does NOT render or subscribe itself. Sections are
 * declared by a page/layout (often before its matching @yield even exists —
 * same cross-controller ordering as Block/BlockOutlet), so SectionManager
 * owns evaluation, DOM insertion, and reactive re-apply (mirrors how
 * BlockManager owns Block/BlockOutlet mounting instead of Block itself).
 */
export declare class Section implements SectionInterface {
    ctx: ViewControllerInterface | undefined | null;
    /** Owning view instance — keys this section as `name + viewId` in SectionManager, same as Block. */
    viewId: string;
    name: string;
    type: SectionItemType;
    contentType: SectionContentType;
    stateKeys: string[];
    renderFactory: SectionContentRenderer;
    constructor({ ctx, name, type, contentType, stateKeys, renderFactory }: SectionConstruvtorArgs);
    /** Evaluate current content. `parentElement` only meaningful for contentType 'html'. */
    evaluate(parentElement?: HtmlInterface | null): string | import("../contracts/ElementInterface").SaoElementChildren;
}
//# sourceMappingURL=Section.d.ts.map