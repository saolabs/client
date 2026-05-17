import { HtmlInterface } from "../contracts/ElementInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { SectionConstruvtorArgs, SectionContentRenderer, SectionContentType, SectionInterface, SectionItemType } from "../contracts/views";

export class Section implements SectionInterface {
    ctx: ViewControllerInterface | undefined | null = null;
    name: string;
    type: SectionItemType;
    contentType: SectionContentType;
    stateKeys?: string[];
    
    renderFactory: SectionContentRenderer;
    subscribeFn: (() => void) | null = null;
    unsubscribeFn: (() => void) | null = null;

    content: any = null; // Can be string or SaoElementChildren depending on contentType

    parentElement: HtmlInterface | undefined | null = null; // For dynamic/reactive sections that need a parent element reference

    isStarted: boolean = false; // Flag to indicate if this section is static (renders once) or dynamic/reactive (renders on state change)

    constructor({ ctx, name, type = 'static', contentType = 'text', stateKeys, renderFactory }: SectionConstruvtorArgs) {
        this.ctx = ctx ?? null;
        this.name = name;
        this.type = type;
        this.contentType = contentType;
        this.stateKeys = stateKeys;
        this.renderFactory = renderFactory;
        
        this.initialize();
    }

    initialize() {
        if (this.type === 'static') {
            this.render();
        }
        this.start();

    }

    render(parentElement?: HtmlInterface | null | undefined) {
        this.parentElement = parentElement ?? null;
        this.content = this.renderFactory(this.parentElement);
    }

    start() {
        if(this.isStarted) return; // No need to subscribe for static sections
        this.isStarted = true;
        if ((this.type === 'reactive' || this.type === 'dynamic') && this.stateKeys && this.ctx) {
            this.subscribeFn = () => {
                this.render(this.parentElement);
            };
            this.unsubscribeFn = this.ctx.states.subscribe(this.stateKeys, this.subscribeFn);
        }
        
    }

    stop() {
        if (!this.isStarted) return;
        this.isStarted = false;
        if (this.unsubscribeFn) {
            this.unsubscribeFn();
            this.unsubscribeFn = null;
        }
    }
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