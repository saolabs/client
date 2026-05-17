export class Section {
    constructor({ ctx, name, type = 'static', contentType = 'text', stateKeys, renderFactory }) {
        this.ctx = null;
        this.subscribeFn = null;
        this.unsubscribeFn = null;
        this.content = null; // Can be string or SaoElementChildren depending on contentType
        this.parentElement = null; // For dynamic/reactive sections that need a parent element reference
        this.isStarted = false; // Flag to indicate if this section is static (renders once) or dynamic/reactive (renders on state change)
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
    render(parentElement) {
        this.parentElement = parentElement ?? null;
        this.content = this.renderFactory(this.parentElement);
    }
    start() {
        if (this.isStarted)
            return; // No need to subscribe for static sections
        this.isStarted = true;
        if ((this.type === 'reactive' || this.type === 'dynamic') && this.stateKeys && this.ctx) {
            this.subscribeFn = () => {
                this.render(this.parentElement);
            };
            this.unsubscribeFn = this.ctx.states.subscribe(this.stateKeys, this.subscribeFn);
        }
    }
    stop() {
        if (!this.isStarted)
            return;
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
//# sourceMappingURL=Section.js.map