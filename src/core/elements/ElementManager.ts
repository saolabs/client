import type { BlockRenderFactory } from "../contracts/BlockInterface.js";
import type { HtmlInterface, SaoElementConfig, SaoChildrenFactory } from "../contracts/ElementInterface.js";
import type { ReactiveRenderFn } from "../contracts/ReactiveInterface.js";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface.js";
import { Html } from "./Html.js";
import { TextElement } from "./TextElement.js";
import { Reactive } from "./Reactive.js";
import { Fragment } from "./Fragment.js";
import { Block } from "./Block.js";

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
    /** Custom element factories (for user-defined components) */
    private factories: Map<string, (...args: any[]) => any> = new Map();

    // ─── Element Shorthand Factories ────────────────────────────



    // ─── Custom Component Registry ─────────────────────────────

    /** Register a custom component factory */
    set(name: string, factory: (...args: any[]) => any): void {
        this.factories.set(name, factory);
    }

    /** Get a custom component factory */
    get(name: string): ((...args: any[]) => any) | undefined {
        return this.factories.get(name);
    }

    /** Check if a custom component is registered */
    has(name: string): boolean {
        return this.factories.has(name);
    }
}

export const ElementManager = new ElementManagerService();
export default ElementManager;