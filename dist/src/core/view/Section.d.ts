import { HtmlInterface } from "../contracts/ElementInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { SectionConstruvtorArgs, SectionContentRenderer, SectionContentType, SectionInterface, SectionItemType } from "../contracts/views";
export declare class Section implements SectionInterface {
    ctx: ViewControllerInterface | undefined | null;
    name: string;
    type: SectionItemType;
    contentType: SectionContentType;
    stateKeys?: string[];
    renderFactory: SectionContentRenderer;
    subscribeFn: (() => void) | null;
    unsubscribeFn: (() => void) | null;
    content: any;
    parentElement: HtmlInterface | undefined | null;
    isStarted: boolean;
    constructor({ ctx, name, type, contentType, stateKeys, renderFactory }: SectionConstruvtorArgs);
    initialize(): void;
    render(parentElement?: HtmlInterface | null | undefined): void;
    start(): void;
    stop(): void;
}
/**
 * Note: The "Section" concept is being phased out in favor of a more flexible Block/BlockOutlet system.
 * Sections are still supported for backward compatibility but may be deprecated in future versions.
 * For new development, consider using Blocks instead of Sections for better flexibility and composability.
 *
 * --- CHANGELOG ---
 * vX.X.X - Introduced Block/BlockOutlet system as a more flexible alternative to Sections.
 *   - Sections are now considered legacy and may be deprecated in future versions.
 *   - ViewController's section management is being refactored to support Blocks instead of Sections.
 *   - Updated documentation and examples to encourage use of Blocks over Sections.
 *
 * --- FUTURE PLANS ---
 * - Phase out Sections entirely in favor of Blocks, which offer more composability and dynamic capabilities.
 * - Provide migration guides for existing users to transition from Sections to Blocks.
 * - Enhance Block system with features like nested blocks, dynamic block registration, and improved lifecycle management.
 *
 * --- CURRENT RECOMMENDATION ---
 * For new views, prefer using Blocks and BlockOutlets for layout composition instead of Sections. Sections will still work but are not recommended for new development.
 */ 
//# sourceMappingURL=Section.d.ts.map