import type { BlockInterface, BlockOutletInterface, BlockRenderFactory } from "../contracts/BlockInterface";
import type { FragmentInterface, HtmlInterface, OneChildrenFactory, OneElementEventHandler, OneNodeInterface, OutputInterface, TextInterface, WrapperInterface, YieldInterface } from "../contracts/ElementInterface";
import type { ReactiveChildrenFactory, ReactiveInterface } from "../contracts/ReactiveInterface";
import type { ViewControllerInterface, ViewType, ViewConfig, ViewRuntimeConfig, ViewControllerConfig } from "../contracts/ViewControllerInterface";
import type { ViewInterface, ViewRenderFactory } from "../contracts/ViewInterface";
import type { OneObjectType } from "../types/utils";
import { ViewState } from "./ViewState";
import { LoopContext } from "./LoopContext";
import { Component } from "../elements/Component";
import { ApplicationInterface } from "../contracts/ApplicationInterface";
import { SectionContentRenderer, SectionContentType, SectionInterface, SectionItemType } from "../contracts/views";
import { InitMode } from "../contracts/common";
import { BlockOutlet } from "../elements";
import { ComponentInterface } from "../contracts/ComponentInterface";
type ElementChild = ReactiveInterface | ComponentInterface | HtmlInterface | TextInterface | FragmentInterface | OutputInterface | BlockOutletInterface | YieldInterface | OneNodeInterface;
/**
 * ViewController — the brain behind a View.
 *
 * Manages:
 *   - Reactive state (ViewState) — useState, subscribe, batch flush
 *   - DOM element tree — via Html, Reactive, TextElement, Fragment
 *   - Event delegation — addEventListener with centralized cleanup
 *   - Loop contexts — @foreach, @for, @while with LoopContext stack
 *   - Block management — for layout views with @useBlock
 *   - Lifecycle — setup, render, destroy
 *   - Reactive scheduling — batched DOM updates via requestAnimationFrame
 *
 * KEY DIFFERENCE from core/ViewController:
 *   OLD: render() returns HTML string → innerHTML → scan DOM for bindings
 *   NEW: render() builds element tree directly → Reactive regions update in-place
 *
 * Compiled .one output calls methods like:
 *   this.__ctrl__.addEventListener(el, 'click', handlers)
 *   this.__ctrl__.states.__.useState(0, 'count')
 *   this.__ctrl__.__foreach(items, (item, key, index, loop) => [...])
 */
export declare class ViewController implements ViewControllerInterface {
    oneType: OneObjectType;
    viewId: string;
    path: string;
    viewType: ViewType;
    /** The View instance this controller manages */
    view: ViewInterface;
    /** Reactive state manager */
    states: ViewState;
    /** App container reference (set later by framework) */
    private __App;
    /** Parent view controller (for nested views) */
    parent: ViewControllerInterface | null;
    /** Child view controllers (for nested views) */
    children: ViewControllerInterface[];
    /** Layout (super) view's controller */
    superView: ViewControllerInterface | null;
    /** Path to layout (super) view — e.g. 'layouts.main' */
    superViewPath: string | null;
    /** Whether this controller IS a layout */
    isSuperView: boolean;
    /** For layouts: the original page view's controller (for block mounting) */
    originView: ViewControllerInterface | null;
    /** Raw input data from route/parent */
    data: Record<string, any>;
    /** User-defined config from setup() */
    private config;
    /** Typed runtime config from compiled $__setup__ */
    private runtimeConfig;
    /** Track own properties to avoid conflicts when setting user config */
    private ownProperties;
    /** Root Html element — the container this view renders into */
    private rootElement;
    private parentElement;
    /** Root element tree returned by renderFactory (Fragment, Html, etc.) */
    private _rootTree;
    /** Compiled render factory — produces the element tree */
    private renderFactory;
    /** Compiled prerender factory — produces the prerender element tree */
    private prerenderFactory;
    childrenFactory: OneChildrenFactory | null;
    /** Stored render output for lifecycle management */
    renderOutput: any;
    /** Stored prerender output for hydration or caching */
    prerenderOutput: any;
    /** DOM children — for compatibility with HtmlInterface */
    domChildren: Node[];
    /** Flag: currently in a virtual render (for hydration or caching) */
    isVirtualRendering: boolean;
    initMode: InitMode;
    /** Pending reactive updates — deduped, flushed in one RAF */
    private pendingReactiveUpdates;
    private hasScheduledUpdate;
    /** Centralized AbortController for all event listeners */
    private eventAbortController;
    /** Current loop context stack (@foreach, @for, @while) */
    loopContext: LoopContext | null;
    /** Section management across views */
    sections: Map<string, SectionInterface>;
    /** Block slots in layout views */
    blocks: Map<string, BlockInterface>;
    elements: Map<string, ElementChild>;
    preloadElement: WrapperInterface | null;
    mainElement: WrapperInterface | null;
    /** Whether this view is currently active (mounted in DOM) */
    isActive: boolean;
    /** Whether initial data has been committed */
    private _isDataCommitted;
    /** Whether the view has been mounted */
    private _isMounted;
    /** Whether the view has been fully destroyed */
    private _isDestroyed;
    /** For future use: scanning DOM for bindings */
    protected isScanMode: boolean;
    urlPath: string | null;
    callingMethod: string | null;
    constructor(view: ViewInterface, path?: string, viewType?: ViewType, viewId?: string | null);
    /**
     * Setup — called by compiled $__setup__ with full config.
     *
     * Lưu config, extract metadata, lưu render factory.
     * CHƯA gọi commitConstructorData — đợi ViewManager gọi commitData().
     */
    setup(config: ViewRuntimeConfig): void;
    getConfig(key?: string, defaultValue?: any): ViewControllerConfig | any;
    /** Set static view config shared by all instances of a compiled view class. */
    setStaticConfig(config: ViewConfig): void;
    /** Set user-defined properties/methods on the View instance */
    setUserDefinedConfig(userConfig: Record<string, any>): void;
    /** Set the compiled render factory */
    setRenderFactory(factory: ViewRenderFactory): void;
    /** Set root element — the container this view renders into */
    setRootElement(rootElement: HtmlInterface): void;
    setParentElement(parent: HtmlInterface | null): void;
    /** Render the view's element tree into rootElement.
     *
     * The compiled render factory (bound to this ViewController) returns
     * the root element tree (typically a Fragment). We set its parent
     * to rootElement, call render() to build DOM, and store the reference
     * for start/stop lifecycle management.
     */
    render(): any;
    prerender(): any;
    hydrate(): any;
    hydrateRender(): any;
    hydratePrerender(): any;
    mount(root: HTMLElement): void;
    unmount(): void;
    /**
     * Start — activate reactive subscriptions throughout the element tree.
     * Called AFTER render() and commitData().
     *
     * Flow: render() → commitData() → start()
     * This ensures initial state values are set before subscriptions fire.
     */
    start(): void;
    /**
     * Stop — deactivate reactive subscriptions (for caching/deactivation).
     * DOM stays intact but reactive updates are paused.
     */
    stop(): void;
    /** Full destroy — cleanup everything */
    destroy(): void;
    /**
     * Commit initial data — set initial state values.
     * Called by ViewManager AFTER render + block mounting.
     *
     * Flow: commitConstructorData() → update$xxx(initial) → lockUpdateRealState()
     */
    commitData(): void;
    /**
     * Update data from external source (navigate same view, different params).
     * Flow: unlock → updateVariableData(newData) → re-set states → lock
     */
    updateData(newData: Record<string, any>): void;
    /**
     * Update single data item.
     */
    updateDataItem(key: string, value: any): void;
    /**
     * Register event listeners on an element.
     * All listeners are tracked via AbortController for centralized cleanup.
     *
     * Handlers can be:
     *   - Direct function: (event) => { ... }
     *   - Object with handler + params: { handler: fn, params: [...] }
     *   - Object with string handler (method name on view): { handler: 'handleClick' }
     */
    addEventListener(element: HTMLElement, event: string, handlers: OneElementEventHandler): void;
    /**
     * Schedule a reactive region for re-render.
     * Multiple calls in the same frame are batched into a single RAF.
     */
    scheduleUpdate(reactive: ReactiveInterface): void;
    private flushReactiveUpdates;
    section(name: string, config: {
        type: SectionItemType;
        contentType?: SectionContentType;
        stateKeys?: string[];
        [key: string]: any;
    }, contentRenderFactory: SectionContentRenderer): SectionInterface;
    block(id: string | null, name: string, contentRenderFactory: BlockRenderFactory): BlockInterface;
    blockOutlet(id: string | null | undefined, name: string, parentElement: HtmlInterface | null): BlockOutletInterface;
    mountBlock(id: string | null | undefined, name: string, parent: HtmlInterface | null): BlockOutletInterface;
    /**
     * @useBlock(name) — register a block slot in the layout.
     * Creates a Reactive region between markers that will hold the block content.
     * BlockManager.mountAll() later inserts the page view's block content here.
     */
    useBlock(id: string | null | undefined, name: string, parent: HtmlInterface): BlockOutlet;
    yield(id: string, name: string, defaultValue?: any, parentElement?: HtmlInterface | null): YieldInterface;
    yieldContent(name: string, defaultValue?: any): any;
    wrapper(factory: OneChildrenFactory): WrapperInterface;
    fragment(id: string | null | undefined, parentElement: HtmlInterface | null, childrenFactory: OneChildrenFactory): FragmentInterface;
    /**
     * Template and Directive Helpers
     * These methods are called by the compiled output for loops, conditionals, and other directives.
     */
    html(id: string | null | undefined, tagName: string, parentElement: HtmlInterface | null, config: any, childrenFactory?: OneChildrenFactory): OneNodeInterface;
    reactive(id: string | null, type: string, parentReactive: ReactiveInterface | null, parentElement: HtmlInterface | null, stateKeys: string[], childrenFactory: ReactiveChildrenFactory): ReactiveInterface;
    output(id: string | null, parent: HtmlInterface | null, isEscapeHTML?: boolean, stateKeys?: string[], contentFactory?: () => string): OutputInterface;
    text(text: string): Text;
    include(id: string | null | undefined, path: string | undefined, parentElement: HtmlInterface | null, stateKeys: string[], dataFactory: (parentElement: HtmlInterface | null) => Record<string, any>): Component;
    includeIf(id: string | null | undefined, path: string, parentElement: HtmlInterface | null, stateKeys: string[], dataFactory: (parentElement: HtmlInterface | null) => Record<string, any>): Component;
    includeWhen(id: string | null, condition: {
        stateKeys: string[];
        checker: () => any;
    }, path: string, parentElement: HtmlInterface | null, stateKeys: string[], dataFactory: (parentElement: HtmlInterface | null) => Record<string, any>): Component;
    extendView(path: string, data?: Record<string, any>): ViewInterface | null;
    /** Create and push a new LoopContext onto the stack */
    __setLoopContext(length: number): LoopContext;
    /** Pop the current LoopContext, restore parent */
    __resetLoopContext(): LoopContext | null;
    /**
     * @foreach directive — iterate over array or object.
     * Returns array of children (not HTML string like the old system).
     *
     * @example Compiled output:
     * ctrl.__foreach(items, (item, key, index, loop) => [
     *     em.h(ctrl, parent, 'div', {}, () => [em.t(`Item: ${item}`)])
     * ])
     */
    __foreach<T>(list: T[] | Record<string, T>, callback: (item: T, key: string, index: number, loop: LoopContext) => any): any[];
    __forelse<T>(list: T[], callback: (item: T, key: string, index: number, loop: LoopContext) => any, emptyCallback?: () => any): any[];
    __each<T>(list: T[], callback: (item: T, key: string, index: number, loop: LoopContext) => any): any[];
    /**
     * @for directive
     */
    __for(loopType?: 'increment' | 'decrement', start?: number, end?: number, execute?: (loop: LoopContext) => any): any;
    /**
     * @while directive
     */
    __while(execute: (loop: LoopContext) => any, maxIterations?: number): any;
    setApp(app: ApplicationInterface): void;
    getParentView(): ViewInterface | null;
    getChildrenViews(): ViewInterface[];
    getSuperView(): ViewInterface | null;
    getOriginView(): ViewInterface | null;
    setOriginView(origin: ViewControllerInterface): void;
    setSuperView(superView: ViewControllerInterface): void;
    setIsSuperView(isSuper: boolean): void;
    setParent(parent: ViewControllerInterface): void;
    addChild(child: ViewControllerInterface): void;
    /**
     * For nested views: set the chain of super views up to the root, so each view has a reference to its layout parents.
     * Called by ViewManager after creating the view and its super view(s).
     */
    setChainFromOrigin(): void;
    /**
     * When a view is destroyed, it should eject itself from the origin chain to prevent memory leaks.
     */
    ejectOriginChain(): void;
    get App(): ApplicationInterface;
    get isMounted(): boolean;
    get isDestroyed(): boolean;
    /** Whether this view has a super view (layout) */
    get hasSuperView(): boolean;
    private generateViewId;
}
export {};
//# sourceMappingURL=ViewController.d.ts.map