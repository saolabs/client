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
export declare class ElementManagerService {
    /** Custom element factories (for user-defined components) */
    private factories;
    /** Register a custom component factory */
    set(name: string, factory: (...args: any[]) => any): void;
    /** Get a custom component factory */
    get(name: string): ((...args: any[]) => any) | undefined;
    /** Check if a custom component is registered */
    has(name: string): boolean;
}
export declare const ElementManager: ElementManagerService;
export default ElementManager;
//# sourceMappingURL=ElementManager.d.ts.map