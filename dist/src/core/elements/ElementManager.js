/**
 * OneElementManager — factory/registry for creating One elements.
 *
 * Provides shorthand functions so compiled output stays clean:
 *   oem.h(ctx, parent, 'div', config, children)  → Html
 *   oem.t('Hello')                                → TextElement
 *   oem.r(ctx, parent, renderFn)                  → Reactive
 *   oem.f(ctx, parent, children)                  → Fragment
 *   oem.b(ctx, parent, 'content')                 → Block
 */
export class ElementManagerService {
    constructor() {
        /** Custom element factories (for user-defined components) */
        this.factories = new Map();
    }
    // ─── Element Shorthand Factories ────────────────────────────
    // ─── Custom Component Registry ─────────────────────────────
    /** Register a custom component factory */
    set(name, factory) {
        this.factories.set(name, factory);
    }
    /** Get a custom component factory */
    get(name) {
        return this.factories.get(name);
    }
    /** Check if a custom component is registered */
    has(name) {
        return this.factories.has(name);
    }
}
export const ElementManager = new ElementManagerService();
export default ElementManager;
//# sourceMappingURL=ElementManager.js.map