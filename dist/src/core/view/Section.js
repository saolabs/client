/**
 * Section — a `@section(name, ...)` declaration.
 *
 * A thin data holder: it does NOT render or subscribe itself. Sections are
 * declared by a page/layout (often before its matching @yield even exists —
 * same cross-controller ordering as Block/BlockOutlet), so SectionManager
 * owns evaluation, DOM insertion, and reactive re-apply (mirrors how
 * BlockManager owns Block/BlockOutlet mounting instead of Block itself).
 */
export class Section {
    constructor({ ctx, name, type = 'static', contentType = 'text', stateKeys, renderFactory }) {
        this.ctx = null;
        this.ctx = ctx ?? null;
        this.viewId = ctx?.viewId ?? '';
        this.name = name;
        this.type = type;
        this.contentType = contentType;
        this.stateKeys = stateKeys ?? [];
        this.renderFactory = renderFactory;
    }
    /** Evaluate current content. `parentElement` only meaningful for contentType 'html'. */
    evaluate(parentElement) {
        return this.renderFactory(parentElement ?? null);
    }
}
//# sourceMappingURL=Section.js.map