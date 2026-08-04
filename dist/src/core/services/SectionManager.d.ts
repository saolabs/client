import type { SectionInterface, SectionManagerInterface } from "../contracts/SectionInterface";
import type { YieldInterface } from "../contracts/ElementInterface";
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
export declare class SectionManagerService implements SectionManagerInterface {
    sections: Map<string, SectionInterface>;
    activeSections: Map<string, SectionInterface>;
    yields: Map<string, YieldInterface>;
    subscribers: Map<string, ((section: SectionInterface) => void)[]>;
    /** name+viewId -> unsubscribe fn (only for reactive sections, active while started) */
    private unsubscribers;
    /** yield id -> tracked nodes/elements mounted between its markers (for clear/start/stop) */
    private mounted;
    add(section: SectionInterface): void;
    active(name: string, viewId: string): void;
    subscribe(name: string, callback: (section: SectionInterface) => void): () => void;
    unsubscribe(name: string, callback?: (section: SectionInterface) => void): void;
    addYield(id: string, yieldEl: YieldInterface): void;
    /** XOÁ THẬT yields của một view bị destroy — destroy rồi mới rời Map. */
    removeYieldsOfView(viewId: string): void;
    /** Resolve the current value of a named section — for `this.yieldContent()` in attrs/props. */
    resolve(name: string, defaultValue?: any): any;
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
    mountViewSections(viewId: string): void;
    /** Hydrate counterpart: trust server-rendered content, only let nested elements self-claim. */
    hydrateViewSections(viewId: string): void;
    private findYieldsByName;
    /** Re-apply every yield bound to `name` — used after a reactive section change. */
    private applyByName;
    private mountSectionIntoYield;
    private applyText;
    /** Same insertion pattern as BlockManagerService.mountBlockIntoOutlet(). */
    private mountHtml;
    /** Hydrate: claim only — DOM already there from SSR, never insert/clear. */
    private hydrateApplyToYield;
    private clearYield;
    /** Activate reactive sections (subscribe) + start any mounted html-content children. Call after mount/hydrate. */
    startAll(): void;
    /** Deactivate — unsubscribe + stop mounted children. */
    stopAll(): void;
    private subscribeIfReactive;
    /** Notify `subscribe(name, cb)` listeners — both when a different section becomes active
     *  (see `active()`) and when the currently active section's own value changes. Consumers:
     *  `Html.ts` attribute/prop bindings built from `@yield(...)` (no stateKeys of their own —
     *  the section they depend on is only known at runtime), subscribed via `yieldName`. */
    private notify;
    unmountView(viewId: string): void;
    /**
     * Push `meta:*` sections to HeadService — SPA navigation never runs Blade,
     * so nothing else keeps `<title>`/`<meta>` (outside the client's mounted
     * tree entirely) in sync with the active page after the first load. This
     * is the declarative convenience layer over HeadService: a page can
     * either call `@section('meta:title', ...)` in its template, or reach
     * `app('Head')` directly (e.g. from an async data callback) — both end up
     * writing through the same service, so they never fight each other.
     */
    private syncHeadSections;
    /** Revert every page-scoped head tag before mounting a new page's chain. Call once per navigation. */
    resetPageHead(): void;
    destroy(): void;
}
export declare const SectionManager: SectionManagerService;
export default SectionManager;
//# sourceMappingURL=SectionManager.d.ts.map