import type { SectionInterface, SectionManagerInterface } from "../contracts/SectionInterface";
import type { YieldInterface } from "../contracts/ElementInterface";
import HeadService from "./HeadService";

const HEAD_SECTION_PREFIX = 'meta:';

/**
 * SectionManager — connects `@section(name, ...)` declarations to `@yield(name, ...)`
 * markers, cross-controller (a page declares a section, a layout — or nothing —
 * yields it), mirroring how BlockManager connects Block ↔ BlockOutlet.
 *
 * Two content shapes (RUNTIME_CONTRACT):
 *   - contentType 'text' (short `@section(name, value)`) — resolves to a plain
 *     string. Used as: (a) a single text node between the yield's markers,
 *     (b) the `.value` of a `<textarea>` when the yield's immediate DOM parent
 *     is a textarea (mutating child text nodes of a live textarea does not
 *     reliably update what's displayed once the dirty-value flag is set — every
 *     framework sets `.value` directly instead), (c) resolved synchronously via
 *     `resolve()` for `this.yieldContent()` used inside an attribute/prop factory.
 *   - contentType 'html' (long `@section(name) ... @endsection`) — a children
 *     array, mounted between the yield's markers the same way BlockManager
 *     mounts block content into an outlet.
 *
 * Head metadata (`meta:title`, `meta:description`, ...): the app shell's
 * `<head>` is plain Laravel Blade (native `@yield`), entirely outside the
 * client's mounted tree — SSR already gets it right for free. SPA navigation
 * bypasses Blade though, so `syncHeadSections()` pushes any `meta:*` section
 * straight to `document.title` / `<meta>` on every mount and on every reactive
 * update, keeping the tab title and metadata "live" across client-side routes.
 */
export class SectionManagerService implements SectionManagerInterface {
    sections: Map<string, SectionInterface> = new Map();       // key: name + viewId
    activeSections: Map<string, SectionInterface> = new Map(); // key: name
    yields: Map<string, YieldInterface> = new Map();            // key: yield element id
    subscribers: Map<string, ((section: SectionInterface) => void)[]> = new Map();

    /** name+viewId -> unsubscribe fn (only for reactive sections, active while started) */
    private unsubscribers: Map<string, () => void> = new Map();
    /** yield id -> tracked nodes/elements mounted between its markers (for clear/start/stop) */
    private mounted: Map<string, any[]> = new Map();

    add(section: SectionInterface): void {
        const key = section.name + (section.viewId ?? '');
        if (!this.sections.has(key)) {
            this.sections.set(key, section);
        }
        this.active(section.name, section.viewId ?? '');
    }

    active(name: string, viewId: string): void {
        const key = name + viewId;
        const section = this.sections.get(key);
        if (!section) return;
        this.activeSections.set(name, section);
        this.notify(section);
    }

    subscribe(name: string, callback: (section: SectionInterface) => void): () => void {
        if (!this.subscribers.has(name)) this.subscribers.set(name, []);
        this.subscribers.get(name)!.push(callback);
        return () => this.unsubscribe(name, callback);
    }

    unsubscribe(name: string, callback?: (section: SectionInterface) => void): void {
        if (!this.subscribers.has(name)) return;
        if (!callback) {
            this.subscribers.delete(name);
            return;
        }
        const listeners = this.subscribers.get(name)!.filter(fn => fn !== callback);
        if (listeners.length === 0) this.subscribers.delete(name);
        else this.subscribers.set(name, listeners);
    }

    addYield(id: string, yieldEl: YieldInterface): void {
        this.yields.set(id, yieldEl);
    }

    /** XOÁ THẬT yields của một view bị destroy — destroy rồi mới rời Map. */
    removeYieldsOfView(viewId: string): void {
        for (const [id, y] of Array.from(this.yields)) {
            if ((y as any).ctx?.viewId === viewId) {
                this.clearYield(y);
                (y as any).destroy?.();   // idempotent — gỡ khỏi ctrl.elements
                this.yields.delete(id);
            }
        }
    }

    /** Resolve the current value of a named section — for `this.yieldContent()` in attrs/props. */
    resolve(name: string, defaultValue: any = null): any {
        const section = this.activeSections.get(name);
        if (!section?.renderFactory) return defaultValue;
        const value = section.renderFactory(null);
        return value === undefined || value === null ? defaultValue : value;
    }

    /**
     * Mount every yield owned by one controller (page or layout — matches the
     * controller Router/ViewManager is currently activating).
     *
     * Render happens for the whole chain before any mounting does (page
     * registers its sections while building its tree, THEN returns
     * `extendView(layout)`, whose own render builds the yields) — so by mount
     * time `activeSections` already holds every section in the chain
     * regardless of call order. Only the yield side needs to be scoped to
     * `viewId`, so each controller's own markers get touched exactly once,
     * mirroring BlockManagerService.mountViewBlocks()'s per-owner pass.
     */
    mountViewSections(viewId: string): void {
        for (const [, yieldEl] of this.yields) {
            if ((yieldEl as any).ctx?.viewId !== viewId) continue;
            this.mountSectionIntoYield(this.activeSections.get(yieldEl.name) ?? null, yieldEl);
        }
        this.syncHeadSections();
    }

    /** Hydrate counterpart: trust server-rendered content, only let nested elements self-claim. */
    hydrateViewSections(viewId: string): void {
        for (const [, yieldEl] of this.yields) {
            if ((yieldEl as any).ctx?.viewId !== viewId) continue;
            const section = this.activeSections.get(yieldEl.name) ?? null;
            if (section) this.hydrateApplyToYield(section, yieldEl);
        }
        this.syncHeadSections();
    }

    private findYieldsByName(name: string): YieldInterface[] {
        const found: YieldInterface[] = [];
        for (const [, y] of this.yields) if (y.name === name) found.push(y);
        return found;
    }

    /** Re-apply every yield bound to `name` — used after a reactive section change. */
    private applyByName(name: string): void {
        const section = this.activeSections.get(name) ?? null;
        for (const yieldEl of this.findYieldsByName(name)) {
            this.mountSectionIntoYield(section, yieldEl);
        }
    }

    private mountSectionIntoYield(section: SectionInterface | null, yieldEl: any): void {
        this.clearYield(yieldEl);
        if (!yieldEl.openTag?.parentNode) return; // outlet not in DOM yet

        const isTextarea = yieldEl.parent?.element?.tagName === 'TEXTAREA';

        if (!section) {
            this.applyText(yieldEl, isTextarea, String(yieldEl.defaultValue ?? ''));
            return;
        }
        if (section.contentType === 'html') {
            this.mountHtml(section, yieldEl);
        } else {
            const raw = section.renderFactory ? section.renderFactory(null) : undefined;
            const text = raw === undefined || raw === null ? String(yieldEl.defaultValue ?? '') : String(raw);
            this.applyText(yieldEl, isTextarea, text);
        }
    }

    private applyText(yieldEl: any, isTextarea: boolean, text: string): void {
        if (isTextarea) {
            // Mutating a live textarea's child text nodes does not reliably repaint
            // its displayed value once the browser's dirty-value flag is set — set
            // `.value` directly instead, the same way every DOM framework does.
            (yieldEl.parent!.element as HTMLTextAreaElement).value = text;
            return;
        }
        if (!text) return;
        const node = document.createTextNode(text);
        yieldEl.closeTag.parentNode?.insertBefore(node, yieldEl.closeTag);
        this.mounted.set(yieldEl.id, [node]);
    }

    /** Same insertion pattern as BlockManagerService.mountBlockIntoOutlet(). */
    private mountHtml(section: SectionInterface, yieldEl: any): void {
        const insertBeforeClose = (node: Node) => yieldEl.closeTag.parentNode?.insertBefore(node, yieldEl.closeTag);
        const content = section.renderFactory!(yieldEl.parent);
        if (!Array.isArray(content)) return;

        const children: any[] = [];
        for (const child of content) {
            if (child === null || child === undefined) continue;
            if (typeof child === 'string' || typeof child === 'number') {
                insertBeforeClose(document.createTextNode(String(child)));
            } else if (child instanceof Node) {
                insertBeforeClose(child);
            } else if (typeof child === 'object') {
                if ('element' in child && (child as any).element) {
                    insertBeforeClose((child as any).element);
                    children.push(child);
                    child.render();
                } else if ('openTag' in child) {
                    if ('parent' in child) (child as any).parent = yieldEl.parent;
                    if ('parentElement' in child) (child as any).parentElement = yieldEl.parent;
                    insertBeforeClose((child as any).openTag);
                    insertBeforeClose((child as any).closeTag);
                    children.push(child);
                    child.render();
                }
            }
        }
        this.mounted.set(yieldEl.id, children);
    }

    /** Hydrate: claim only — DOM already there from SSR, never insert/clear. */
    private hydrateApplyToYield(section: SectionInterface, yieldEl: YieldInterface): void {
        if (section.contentType !== 'html') return; // text: leave server's text node as-is
        const content = section.renderFactory ? section.renderFactory((yieldEl as any).parent) : null;
        if (!Array.isArray(content)) return;
        const children: any[] = [];
        for (const child of content) {
            if (child === null || child === undefined) continue;
            if (typeof child === 'string' || typeof child === 'number') continue; // text: server already has it
            if (child instanceof Node) continue;
            if (typeof child === 'object') {
                if ('element' in child && (child as any).element) {
                    children.push(child);
                    (child as any).render();
                } else if ('openTag' in child) {
                    if ('parent' in child) (child as any).parent = (yieldEl as any).parent;
                    if ('parentElement' in child) (child as any).parentElement = (yieldEl as any).parent;
                    children.push(child);
                    (child as any).render();
                }
            }
        }
        this.mounted.set((yieldEl as any).id, children);
    }

    private clearYield(yieldEl: any): void {
        const children = this.mounted.get(yieldEl.id) ?? [];
        for (const child of children) {
            if (child && typeof child.destroy === 'function') child.destroy();
        }
        this.mounted.delete(yieldEl.id);

        if (yieldEl.openTag?.parentNode) {
            let current = yieldEl.openTag.nextSibling;
            while (current && current !== yieldEl.closeTag) {
                const next = current.nextSibling;
                current.remove();
                current = next;
            }
        }
    }

    /** Activate reactive sections (subscribe) + start any mounted html-content children. Call after mount/hydrate. */
    startAll(): void {
        for (const section of this.activeSections.values()) {
            this.subscribeIfReactive(section);
        }
        for (const children of this.mounted.values()) {
            for (const child of children) {
                if (child && typeof child.start === 'function') child.start();
            }
        }
    }

    /** Deactivate — unsubscribe + stop mounted children. */
    stopAll(): void {
        for (const unsub of this.unsubscribers.values()) unsub();
        this.unsubscribers.clear();
        for (const children of this.mounted.values()) {
            for (const child of children) {
                if (child && typeof child.stop === 'function') child.stop();
            }
        }
    }

    private subscribeIfReactive(section: SectionInterface): void {
        const key = section.name + (section.viewId ?? '');
        if (this.unsubscribers.has(key)) return;
        if ((section.type === 'reactive' || section.type === 'dynamic')
            && section.stateKeys?.length && section.ctx) {
            const unsub = section.ctx.states.__.subscribe(section.stateKeys, () => {
                this.applyByName(section.name);
                this.syncHeadSections();
                this.notify(section);
            });
            this.unsubscribers.set(key, unsub);
        }
    }

    /** Notify `subscribe(name, cb)` listeners — both when a different section becomes active
     *  (see `active()`) and when the currently active section's own value changes. Consumers:
     *  `Html.ts` attribute/prop bindings built from `@yield(...)` (no stateKeys of their own —
     *  the section they depend on is only known at runtime), subscribed via `yieldName`. */
    private notify(section: SectionInterface): void {
        const listeners = this.subscribers.get(section.name);
        if (listeners) listeners.forEach(fn => fn(section));
    }

    unmountView(viewId: string): void {
        for (const [name, section] of Array.from(this.activeSections)) {
            if (section.viewId === viewId) this.activeSections.delete(name);
        }
        for (const [key, section] of Array.from(this.sections)) {
            if (section.viewId !== viewId) continue;
            const unsub = this.unsubscribers.get(key);
            if (unsub) { unsub(); this.unsubscribers.delete(key); }
            this.sections.delete(key);
        }
    }

    /**
     * Push `meta:*` sections to HeadService — SPA navigation never runs Blade,
     * so nothing else keeps `<title>`/`<meta>` (outside the client's mounted
     * tree entirely) in sync with the active page after the first load. This
     * is the declarative convenience layer over HeadService: a page can
     * either call `@section('meta:title', ...)` in its template, or reach
     * `app('Head')` directly (e.g. from an async data callback) — both end up
     * writing through the same service, so they never fight each other.
     */
    private syncHeadSections(): void {
        for (const [name, section] of this.activeSections) {
            if (!name.startsWith(HEAD_SECTION_PREFIX) || !section.renderFactory) continue;
            const raw = section.renderFactory(null);
            if (raw === undefined || raw === null) continue;
            const value = String(raw);
            const key = name.slice(HEAD_SECTION_PREFIX.length);
            if (key === 'title') HeadService.setTitle(value);
            else HeadService.setMeta(key, value);
        }
    }

    /** Revert every page-scoped head tag before mounting a new page's chain. Call once per navigation. */
    resetPageHead(): void {
        HeadService.resetPage();
    }

    destroy(): void {
        for (const unsub of this.unsubscribers.values()) unsub();
        this.unsubscribers.clear();
        for (const [, y] of this.yields) this.clearYield(y);
        this.sections.clear();
        this.activeSections.clear();
        this.yields.clear();
        this.subscribers.clear();
        this.mounted.clear();
    }
}

export const SectionManager = new SectionManagerService();
export default SectionManager;
