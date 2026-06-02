import type { BlockInterface, BlockOutletInterface, BlockRenderFactory } from "../contracts/BlockInterface";
import type { FragmentInterface, HtmlInterface, SaoChildrenFactory, SaoElementEventHandler, SaoNodeInterface, OutputInterface, TextInterface, WrapperInterface, YieldInterface } from "../contracts/ElementInterface";
import type { LoopContextInterface } from "../contracts/LoopContextInterface";
import type { ReactiveChildrenFactory, ReactiveInterface } from "../contracts/ReactiveInterface";
import type { ViewControllerInterface, ViewType, ViewConfig, ViewRuntimeConfig, ViewControllerConfig } from "../contracts/ViewControllerInterface";
import type { ViewInterface, ViewRenderFactory } from "../contracts/ViewInterface";
import type { ViewStateInterface } from "../contracts/ViewStateInterface";
import type { SaoObjectType } from "../types/utils";
import { ViewState } from "./ViewState";
import { LoopContext } from "./LoopContext";
import { Reactive } from "../elements/Reactive";
import BlockManager, { BlockManagerService } from "../services/BlockManager";
import { Component } from "../elements/Component";
import { generateUUID } from "../helpers/utils";
import { Output } from "../elements/Output";
import { View } from "./View";
import { ApplicationInterface } from "../contracts/ApplicationInterface";
import { SectionConstruvtorArgs, SectionContentRenderer, SectionContentType, SectionInterface, SectionItemType } from "../contracts/SectionInterface";
import { Section } from "./Section";
import { InitMode } from "../contracts/common";
import { Block, BlockOutlet, Fragment, Html, TextElement } from "../elements";
import { Wrapper } from "../elements/Wrapper";
import { YieldElement } from "../elements/Yield";
import { app } from "../helpers/app";
import { ComponentInterface } from "../contracts/ComponentInterface";

type ElementChild = ReactiveInterface | ComponentInterface | HtmlInterface | TextInterface | FragmentInterface | OutputInterface | BlockOutletInterface | YieldInterface | SaoNodeInterface;

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
export class ViewController implements ViewControllerInterface {

    // ─── Identity ───────────────────────────────────────────────
    saoType: SaoObjectType = 'ViewController';
    public viewId: string;
    public path: string;
    public viewType: ViewType;

    // ─── Core References ────────────────────────────────────────
    /** The View instance this controller manages */
    public view: ViewInterface;
    /** Reactive state manager */
    public states: ViewState;
    /** App container reference (set later by framework) */
    private __App: ApplicationInterface;

    // ─── View Hierarchy ─────────────────────────────────────────
    /** Parent view controller (for nested views) */
    public parent: ViewControllerInterface | null = null;
    /** Child view controllers (for nested views) */
    public children: ViewControllerInterface[] = [];
    /** Layout (super) view's controller */
    public superView: ViewControllerInterface | null = null;
    /** Path to layout (super) view — e.g. 'layouts.main' */
    public superViewPath: string | null = null;
    /** Whether this controller IS a layout */
    public isSuperView: boolean = false;
    /** For layouts: the original page view's controller (for block mounting) */
    public originView: ViewControllerInterface | null = null;


    // ─── Data & Config ──────────────────────────────────────────
    /** Raw input data from route/parent */
    public data: Record<string, any> = {};
    /** User-defined config from setup() */
    private config: ViewConfig = {};
    /** Typed runtime config from compiled $__setup__ */
    private runtimeConfig: ViewRuntimeConfig | null = {};
    /** Track own properties to avoid conflicts when setting user config */
    private ownProperties: Set<string> = new Set(['__ctrl__']);

    // ─── DOM & Rendering ────────────────────────────────────────


    /** Root Html element — the container this view renders into */
    private rootElement: HtmlInterface | null = null;

    private parentElement: HtmlInterface | null = null; // For non-root views, track the parent element for correct mounting

    /** Root element tree returned by renderFactory (Fragment, Html, etc.) */
    private _rootTree: any = null;
    /** Compiled render factory — produces the element tree */
    private renderFactory: ViewRenderFactory | null = null;
    /** Compiled prerender factory — produces the prerender element tree */
    private prerenderFactory: ViewRenderFactory | null = null;

    public childrenFactory: SaoChildrenFactory | null = null;

    /** Stored render output for lifecycle management */
    public renderOutput: any = null;
    /** Stored prerender output for hydration or caching */
    public prerenderOutput: any = null;
    /** DOM children — for compatibility with HtmlInterface */
    public domChildren: Node[] = [];
    /** Flag: currently in a virtual render (for hydration or caching) */
    public isVirtualRendering: boolean = false;
    public initMode: InitMode = 'create';

    // ─── Reactive System ────────────────────────────────────────
    /** Pending reactive updates — deduped, flushed in one RAF */
    private pendingReactiveUpdates: Set<ReactiveInterface> = new Set();
    private hasScheduledUpdate = false;
    /** Centralized AbortController for all event listeners */
    private eventAbortController: AbortController = new AbortController();

    // ─── Loop ───────────────────────────────────────────────────
    /** Current loop context stack (@foreach, @for, @while) */
    public loopContext: LoopContext | null = null;

    // ─── Layout (Sections & Blocks) ─────────────────────────────
    /** Section management across views */
    public sections: Map<string, SectionInterface> = new Map();
    /** Block slots in layout views */
    public blocks: Map<string, BlockInterface> = new Map();

    public elements: Map<string, ElementChild> = new Map();

    public preloadElement: WrapperInterface | null = null; // For pre-rendering elements before the main render
    public mainElement: WrapperInterface | null = null; // The main rendered element tree
    private wrapperInstance: WrapperInterface | null = null; // For caching the wrapper instance used in render/prerender
    // ─── Lifecycle Flags ────────────────────────────────────────
    /** Whether this view is currently active (mounted in DOM) */
    public isActive: boolean = false;
    /** Whether initial data has been committed */
    private _isDataCommitted = false;
    /** Whether the view has been mounted */
    private _isMounted = false;
    /** Whether the view has been fully destroyed */
    private _isDestroyed = false;
    /** For future use: scanning DOM for bindings */
    protected isScanMode: boolean = false;

    // --- Route params for reference in blocks and sections (set by ViewManager on navigate) ---
    public urlPath: string | null = null;

    public callingMethod: string | null = null; // For debugging: track which method is currently executing


    // ─── Constructor ────────────────────────────────────────────

    constructor(view: ViewInterface, path: string = '', viewType: ViewType = 'view', viewId: string | null = null) {
        this.__App = app<ApplicationInterface>();
        this.view = view;
        this.path = path;
        this.viewType = viewType;
        this.viewId = viewId ?? this.generateViewId();
        this.states = new ViewState(this);
    }

    // ─── Lifecycle ──────────────────────────────────────────────

    /**
     * Setup — called by compiled $__setup__ with full config.
     * 
     * Lưu config, extract metadata, lưu render factory.
     * CHƯA gọi commitConstructorData — đợi ViewManager gọi commitData().
     */
    setup(config: ViewRuntimeConfig): void {
        this.runtimeConfig = config as ViewRuntimeConfig;

        // Extract metadata
        if (config.viewId) this.viewId = config.viewId;
        if (config.path) this.path = config.path;
        this.data = config.data || {};
        this.superViewPath = config.superView || null;

        // Store render factory
        if (typeof config.render === 'function') {
            this.setRenderFactory(config.render.bind(this));
        }

        if (typeof config.prerender === 'function') {
            this.prerenderFactory = config.prerender.bind(this);
        }

    }

    getConfig(key?: string, defaultValue?: any): ViewControllerConfig | any {
        if (key) {
            return this.runtimeConfig?.[key] ?? (this.config[key] ?? defaultValue);
        }
        return { ...this.runtimeConfig, ...this.config };
    }

    /** Set static view config shared by all instances of a compiled view class. */
    setStaticConfig(config: ViewConfig): void {
        this.config = config || {};
    }

    /** Set user-defined properties/methods on the View instance */
    setUserDefinedConfig(userConfig: Record<string, any>): void {
        for (const [key, value] of Object.entries(userConfig)) {
            if (!this.ownProperties.has(key)) {
                (this.view as any)[key] = typeof value === 'function' && value.bind
                    ? value.bind(this.view)
                    : value;
            }
        }
    }

    /** Set the compiled render factory */
    setRenderFactory(factory: ViewRenderFactory): void {
        this.renderFactory = factory;
    }

    /** Set root element — the container this view renders into */
    setRootElement(rootElement: HtmlInterface): void {
        this.rootElement = rootElement;
    }

    setParentElement(parent: HtmlInterface | null): void {
        this.parentElement = parent;
    }

    /** Render the view's element tree into rootElement.
     * 
     * The compiled render factory (bound to this ViewController) returns
     * the root element tree (typically a Fragment). We set its parent
     * to rootElement, call render() to build DOM, and store the reference
     * for start/stop lifecycle management.
     */
    render(): any {
        const oldCallingMethod = this.callingMethod;
        this.callingMethod = 'render';
        let output = this.renderFactory ? this.renderFactory() : null;
        if (this.isVirtualRendering) {
            return output;
        }
        this.renderOutput = output;
        this.callingMethod = oldCallingMethod;
        return output;
    }

    prerender(): any {
        const oldCallingMethod = this.callingMethod;
        this.callingMethod = 'prerender';
        let output = this.prerenderFactory ? this.prerenderFactory() : null;
        if (this.isVirtualRendering) {
            return output;
        }
        this.prerenderOutput = output;
        this.callingMethod = oldCallingMethod;
        return output;
    }

    hydrate(): any {
        this.initMode = 'hydrate';
    }

    hydrateRender(): any {
        this.initMode = 'hydrate';
        let output = this.render();
        this.initMode = 'create';
        return output;
    }
    hydratePrerender(): any {
        this.initMode = 'hydrate';
        let output = this.prerender();
        this.initMode = 'create';
        return output;
    }

    mount(root: HTMLElement): void {

    }

    unmount(): void {

    }

    /**
     * Start — activate reactive subscriptions throughout the element tree.
     * Called AFTER render() and commitData().
     * 
     * Flow: render() → commitData() → start()
     * This ensures initial state values are set before subscriptions fire.
     */
    start(): void {
        if (this._isDestroyed || !this._rootTree) return;

        // Recursively start all children (Output, TextElement, Html, Reactive, Fragment)
        if ('start' in this._rootTree && typeof this._rootTree.start === 'function') {
            this._rootTree.start();
        }

        // Fire onMounted hook
        if (typeof this.view.onMounted === 'function') {
            try {
                this.view.onMounted();
            } catch (e) {
                console.error(`[ViewController] onMounted error in "${this.path}":`, e);
            }
        }
    }

    /**
     * Stop — deactivate reactive subscriptions (for caching/deactivation).
     * DOM stays intact but reactive updates are paused.
     */
    stop(): void {
        if (this._isDestroyed || !this._rootTree) return;

        // Recursively stop all children
        if ('stop' in this._rootTree && typeof this._rootTree.stop === 'function') {
            this._rootTree.stop();
        }

        // Fire onDeactivated hook
        if (typeof this.view.onDeactivated === 'function') {
            try {
                this.view.onDeactivated();
            } catch (e) {
                console.error(`[ViewController] onDeactivated error in "${this.path}":`, e);
            }
        }
    }

    /** Full destroy — cleanup everything */
    destroy(): void {
        if (this._isDestroyed) return;
        this._isDestroyed = true;

        // Stop reactive subscriptions first
        this.stop();

        // Cancel pending updates
        this.pendingReactiveUpdates.clear();
        this.hasScheduledUpdate = false;

        // Abort all event listeners
        this.eventAbortController.abort();

        // Destroy root tree
        if (this._rootTree && 'destroy' in this._rootTree && typeof this._rootTree.destroy === 'function') {
            this._rootTree.destroy();
        }
        this._rootTree = null;


        // Destroy state
        this.states.__.destroy();

        // Cleanup loop context stack
        this.loopContext = null;

        // Fire onDestroy hook
        if (typeof this.view.onDestroy === 'function') {
            try {
                this.view.onDestroy();
            } catch (e) {
                console.error(`[ViewController] onDestroy error in "${this.path}":`, e);
            }
        }

        // Nullify references
        this.rootElement = null;
        this.renderFactory = null;
        this.prerenderFactory = null;
        this._isMounted = false;
    }

    active(): void {
        this.isActive = true;
        // Fire onActivated hook
    }
    deactive(): void {
        this.isActive = false;
        // Fire onDeactivated hook
    }

    // ─── Data Lifecycle ─────────────────────────────────────────

    /**
     * Commit initial data — set initial state values.
     * Called by ViewManager AFTER render + block mounting.
     * 
     * Flow: commitConstructorData() → update$xxx(initial) → lockUpdateRealState()
     */
    commitData(): void {
    }

    /**
     * Update data from external source (navigate same view, different params).
     * Flow: unlock → updateVariableData(newData) → re-set states → lock
     */
    updateData(newData: Record<string, any>): void {
        this.runtimeConfig?.updateVariableData?.(newData);
    }

    /**
     * Update single data item.
     */
    updateDataItem(key: string, value: any): void {
    }

    // ─── Event Management ───────────────────────────────────────

    /**
     * Register event listeners on an element.
     * All listeners are tracked via AbortController for centralized cleanup.
     * 
     * Handlers can be:
     *   - Direct function: (event) => { ... }
     *   - Object with handler + params: { handler: fn, params: [...] }
     *   - Object with string handler (method name on view): { handler: 'handleClick' }
     */
    addEventListener(element: HTMLElement, event: string, handlers: SaoElementEventHandler): void {
        for (const h of handlers) {
            let fn: EventListener;

            if (typeof h === 'function') {
                fn = h as EventListener;
            } else if (typeof h === 'object' && h !== null) {
                const handlerDef = h as { handler: string | ((event: Event) => any); params?: any[] };
                if (typeof handlerDef.handler === 'string') {
                    // Method name on view
                    const methodName = handlerDef.handler;
                    const view = this.view;
                    fn = ((event: Event) => {
                        if (typeof (view as any)[methodName] === 'function') {
                            const params = handlerDef.params
                                ? handlerDef.params.map(p => {
                                    if (typeof p === 'function') return p(event);
                                    return p === '@EVENT' ? event : p;
                                })
                                : [event];
                            (view as any)[methodName](...params);
                        }
                    }) as EventListener;
                } else if (typeof handlerDef.handler === 'function') {
                    const originalHandler = handlerDef.handler;
                    if (handlerDef.params) {
                        fn = ((event: Event) => {
                            const params = handlerDef.params!.map((p: any) => {
                                if (typeof p === 'function') return p(event);
                                return p === '@EVENT' ? event : p;
                            });
                            (originalHandler as Function).apply(this.view, params);
                        }) as EventListener;
                    } else {
                        fn = originalHandler as EventListener;
                    }
                } else {
                    continue;
                }
            } else {
                continue;
            }

            element.addEventListener(event, fn, { signal: this.eventAbortController.signal });
        }
    }

    // ─── Reactive Scheduling ────────────────────────────────────

    /**
     * Schedule a reactive region for re-render.
     * Multiple calls in the same frame are batched into a single RAF.
     */
    scheduleUpdate(reactive: ReactiveInterface): void {
        if (this._isDestroyed) return;

        this.pendingReactiveUpdates.add(reactive);

        if (!this.hasScheduledUpdate) {
            this.hasScheduledUpdate = true;
            requestAnimationFrame(() => this.flushReactiveUpdates());
        }
    }

    private flushReactiveUpdates(): void {
        if (this._isDestroyed) return;
        this.hasScheduledUpdate = false;

        const updates = Array.from(this.pendingReactiveUpdates);
        this.pendingReactiveUpdates.clear();

        for (const reactive of updates) {
            try {
                reactive.render();
            } catch (e) {
                console.error(`[ViewController] Reactive update error in "${this.path}":`, e);
            }
        }
    }


    // Element & Block Creation Methods — called by compiled output to build the element tree directly, instead of returning HTML strings.

    pushBlockAndSections(): void {
        // This method is called by compiled output after rendering blocks and sections, to ensure they are registered in the manager before any child views try to access them.


    }

    /**
     * 
     * @param name 
     * @param config 
     * @param contentRenderFactory 
     * @returns 
     */
    section(name: string, config: { type: SectionItemType; contentType?: SectionContentType; stateKeys?: string[], [key: string]: any }, contentRenderFactory: SectionContentRenderer): SectionInterface {
        if (this.sections.has(name)) {
            const section = this.sections.get(name);
            if (section) {
                return section;
            }
        }
        config.ctx = this;
        config.name = name;
        config.renderFactory = contentRenderFactory;
        const section = new Section(config as SectionConstruvtorArgs);
        this.sections.set(name, section);
        return section;
    }


    // template methods called by compiled output — these build the element tree directly

    block(id: string | null, name: string, contentRenderFactory: BlockRenderFactory): BlockInterface {
        if (!id) {
            id = `block-${name}`;
        }
        id = `${this.viewId}-${id}`;
        const existing = this.blocks.get(id);
        const initMode = this.initMode;
        if (existing) {
            existing.contentRenderFactory = contentRenderFactory;
            BlockManager.active(name, this.viewId);
            existing.initMode = initMode;
            return existing;
        }
        const block = new Block({ ctx: this, name, id, initMode, contentRenderFactory });
        this.blocks.set(id, block);
        BlockManager.add(block);
        return block;
    }


    blockOutlet(id: string | null = null, name: string, parentElement: HtmlInterface | null): BlockOutletInterface {
        const initMode = this.initMode;
        if (!id) {
            id = `ob-${name}`;
        }
        id = `${this.viewId}-${id}`;
        const existing = this.elements.get(id);
        if (existing instanceof BlockOutlet) {
            existing.setParentElement(parentElement);
            existing.initMode = initMode;
            return existing;
        }
        const outlet = new BlockOutlet({ ctx: this, name, id, parentElement, initMode });
        this.elements.set(id, outlet);
        // do something if needed
        return outlet;
    }


    mountBlock(id: string | null = null, name: string, parent: HtmlInterface | null): BlockOutletInterface {
        return this.blockOutlet(id, name, parent);
    }


    /**
     * @useBlock(name) — register a block slot in the layout.
     * Creates a Reactive region between markers that will hold the block content.
     * BlockManager.mountAll() later inserts the page view's block content here.
     */
    useBlock(id: string | null = null, name: string, parent: HtmlInterface): BlockOutletInterface {
        return this.blockOutlet(id, name, parent);
    }

    yield(id: string, name: string, defaultValue: any = null, parentElement: HtmlInterface | null = null): YieldInterface {
        const existing = this.elements.get(id);
        if (existing instanceof YieldElement) {
            existing.setParentElement(parentElement);
            existing.defaultValue = defaultValue;
            return existing;
        }
        const yieldEl = new YieldElement({ ctx: this, name, initMode: this.initMode, id, defaultValue });
        yieldEl.setParentElement(parentElement);
        this.elements.set(id, yieldEl);
        return yieldEl;
    }

    yieldContent(name: string, defaultValue: any = null): any {
        return this.App.View?.yieldContent?.(name, defaultValue) ?? defaultValue;
    }

    wrapper(factory: SaoChildrenFactory): WrapperInterface {
        const callingMethod = this.callingMethod;
        let key: 'preloadElement' | 'mainElement' = callingMethod === 'prerender' ? 'preloadElement' : 'mainElement';
        let wrapper = this.wrapperInstance;
        if (!wrapper) {
            wrapper = new Wrapper({ ctx: this, initMode: this.initMode, parentElement: this.parentElement, childrenFactory: factory });
            this.wrapperInstance = wrapper;
        } else {
            wrapper.setChildrenFactory(factory);
        }
        this[key] = wrapper;
        return wrapper;
    }


    fragment(id: string | null = null, parentElement: HtmlInterface | null, childrenFactory: SaoChildrenFactory): FragmentInterface {
        if (!id) {
            id = `fr-${generateUUID(5)}`;
        }
        const existing = this.elements.get(id);
        if (existing instanceof Fragment) {
            if (childrenFactory) {
                existing.setChildrenFactory(childrenFactory);
            }
            return existing;
        }
        const initMode = this.initMode;
        const fragment = new Fragment({ ctx: this, id, initMode, parentElement, childrenFactory });
        this.elements.set(id, fragment);
        return fragment;
    }


    /**
     * Template and Directive Helpers
     * These methods are called by the compiled output for loops, conditionals, and other directives.
     */

    html(id: string | null = null, tagName: string, parentElement: HtmlInterface | null, config: any, childrenFactory?: SaoChildrenFactory): SaoNodeInterface {
        if (!id) {
            id = `el-${tagName}-${generateUUID(5)}`;
        }
        const existing = this.elements.get(id);
        if (existing instanceof Html) {
            existing.updateConfig(config);
            if (childrenFactory) {
                existing.setChildrenFactory(childrenFactory);
            }
            return existing;
        }
        const element = new Html({ ctx: this, tagName, id, parentElement, initMode: this.initMode, config, childrenFactory });
        this.elements.set(id, element);
        return element;
    }


    reactive(id: string | null, type: string, parentReactive: ReactiveInterface | null, parentElement: HtmlInterface | null, stateKeys: string[], childrenFactory: ReactiveChildrenFactory): ReactiveInterface {
        // check
        if (!id) {
            id = `r-${type}-${generateUUID(5)}`;
        }
        const existing = this.elements.get(id);
        if (existing instanceof Reactive) {
            existing.setChildrenFactory(childrenFactory);
            existing.setStateKeys(stateKeys);
            return existing;
        }
        const reactive: ReactiveInterface = new Reactive({
            type,
            id,
            ctx: this,
            parentReactive,
            parentElement,
            stateKeys,
            childrenFactory
        });
        this.elements.set(id, reactive);
        return reactive;
    }

    output(id: string | null, parent: HtmlInterface | null, isEscapeHTML: boolean = true, stateKeys: string[] = [], contentFactory: () => string = () => ''): OutputInterface {
        if (!id) {
            id = `o-${generateUUID(5)}`;
        }
        const existing = this.elements.get(id);
        if (existing instanceof Output) {
            existing.setStateKeys(stateKeys);
            existing.contentFactory = contentFactory;
            return existing;
        }
        const output = new Output({
            ctx: this,
            id,
            parent,
            stateKeys,
            isEscapeHTML,
            contentFactory,
        });
        this.elements.set(id, output);
        return output;
    }

    text(text: string): Text {
        return document.createTextNode(text) as Text;
    }

    include(
        id: string | null = null,
        path: string = '',
        parentElement: HtmlInterface | null,
        stateKeys: string[],
        dataFactory: (parentElement: HtmlInterface | null) => Record<string, any>
    ): Component {
        if (!id) {
            id = `cpn-${generateUUID(5)}`;
        }
        const existing = this.elements.get(id);
        if (existing instanceof Component) {
            existing.setDataFactory(dataFactory);
            if (stateKeys) {
                existing.setStateKeys(stateKeys);
            }
            return existing;
        }
        let component = new Component({
            ctx: this,
            id: id ?? generateUUID(10),
            stateKeys,
            parent: parentElement,
            dataFactory,
            path,
            type: 'default',
        });
        this.elements.set(id, component);

        return component;
    }

    includeIf(id: string | null = null, path: string, parentElement: HtmlInterface | null, stateKeys: string[], dataFactory: (parentElement: HtmlInterface | null) => Record<string, any>): Component {
        if (!id) {
            id = `c-${generateUUID(5)}`;
        }
        const existing = this.elements.get(id);
        if (existing instanceof Component) {
            existing.setDataFactory(dataFactory);
            if (stateKeys) {
                existing.setStateKeys(stateKeys);
            }
            return existing;
        }
        let component = new Component({
            ctx: this,
            id: id ?? generateUUID(10),
            stateKeys,
            parent: parentElement,
            dataFactory,
            path,
            type: 'if',
        });
        this.elements.set(id, component);
        return component;
    }

    includeWhen(id: string | null, condition: { stateKeys: string[], checker: () => any }, path: string, parentElement: HtmlInterface | null, stateKeys: string[], dataFactory: (parentElement: HtmlInterface | null) => Record<string, any>): Component {
        if (!id) {
            id = `cpn-${generateUUID(5)}`;
        }
        const existing = this.elements.get(id);
        if (existing instanceof Component) {
            existing.setDataFactory(dataFactory);
            existing.setCondition(condition);
            if (stateKeys) {
                existing.setStateKeys(stateKeys);
            }
            return existing;
        }
        let component = new Component({
            ctx: this,
            id: id ?? generateUUID(10),
            stateKeys,
            parent: parentElement,
            dataFactory,
            path,
            type: 'when',
            condition,
        });
        this.elements.set(id, component);
        return component;
    }

    extendView(path: string, data: Record<string, any> = {}): ViewInterface | null {
        this.superViewPath = path;
        const superView: ViewInterface = this.App.View?.view(path, data, true);
        if (superView) {
            this.setSuperView(superView?.__ctrl__);
            return superView;
        }

        // If super view not found, log error and return null
        return superView;
    }


    // ─── Loop Directives ────────────────────────────────────────

    /** Create and push a new LoopContext onto the stack */
    __setLoopContext(length: number): LoopContext {
        const parent = this.loopContext;
        this.loopContext = new LoopContext(parent);
        this.loopContext.setCount(length);
        return this.loopContext;
    }

    /** Pop the current LoopContext, restore parent */
    __resetLoopContext(): LoopContext | null {
        if (this.loopContext?.parent) {
            const parent = this.loopContext.parent;
            this.loopContext.parent = null;
            Object.freeze(this.loopContext);
            this.loopContext = parent;
        } else if (this.loopContext) {
            Object.freeze(this.loopContext);
            this.loopContext = null;
        }
        return this.loopContext;
    }

    /**
     * @foreach directive — iterate over array or object.
     * Returns array of children (not HTML string like the old system).
     * 
     * @example Compiled output:
     * ctrl.__foreach(items, (item, key, index, loop) => [
     *     em.h(ctrl, parent, 'div', {}, () => [em.t(`Item: ${item}`)])
     * ])
     */
    __foreach<T>(
        list: T[] | Record<string, T>,
        callback: (item: T, key: string, index: number, loop: LoopContext) => any
    ): any[] {
        if (!list || typeof list !== 'object') return [];

        const result: any[] = [];
        try {
            if (Array.isArray(list)) {
                const loopCtx = this.__setLoopContext(list.length);
                loopCtx.setType('increment');
                list.forEach((item, index) => {
                    loopCtx.setCurrentTimes(index);
                    const output = callback(item, String(index), index, loopCtx);
                    if (output !== undefined && output !== null) {
                        if (Array.isArray(output)) result.push(...output);
                        else result.push(output);
                    }
                });
            } else {
                const keys = Object.keys(list);
                const loopCtx = this.__setLoopContext(keys.length);
                loopCtx.setType('increment');
                keys.forEach((key, index) => {
                    loopCtx.setCurrentTimes(index);
                    const output = callback((list as Record<string, T>)[key], key, index, loopCtx);
                    if (output !== undefined && output !== null) {
                        if (Array.isArray(output)) result.push(...output);
                        else result.push(output);
                    }
                });
            }
        } catch (e) {
            console.error(`[ViewController] @foreach error in "${this.path}":`, e);
        } finally {
            this.__resetLoopContext();
        }
        return result;
    }

    __forelse<T>(list: T[], callback: (item: T, key: string, index: number, loop: LoopContext) => any, emptyCallback: () => any = () => []): any[] {
        if (this.App.Helper.count(list) === 0) {
            return emptyCallback();
        }
        return this.__foreach(list, callback);
    }

    __each<T>(list: T[], callback: (item: T, key: string, index: number, loop: LoopContext) => any): any[] {
        return this.__foreach(list, callback);
    }

    /**
     * @for directive
     */
    __for(
        loopType: 'increment' | 'decrement' = 'increment',
        start: number = 0,
        end: number = 0,
        execute: (loop: LoopContext) => any = () => []
    ): any {
        const loopCtx = this.__setLoopContext(end);
        loopCtx.setType(loopType);
        let result: any;
        try {
            result = typeof execute === 'function' ? execute(loopCtx) : [];
        } catch (e) {
            console.error(`[ViewController] @for error in "${this.path}":`, e);
            result = [];
        } finally {
            this.__resetLoopContext();
        }
        return result;
    }

    /**
     * @while directive
     */
    __while(execute: (loop: LoopContext) => any, maxIterations: number = 10000): any {
        const loopCtx = this.__setLoopContext(-1);
        loopCtx.setType('increment');
        let result: any;
        try {
            result = typeof execute === 'function' ? execute(loopCtx) : [];
        } catch (e) {
            console.error(`[ViewController] @while error in "${this.path}":`, e);
            result = [];
        } finally {
            if (loopCtx.count === -1) {
                (loopCtx as any).count = loopCtx.iteration;
            }
            this.__resetLoopContext();
        }
        return result;
    }


    // mounting


    // ─── Config & App Access ────────────────────────────────────

    setApp(app: ApplicationInterface): void {
        this.__App = app;
    }


    getParentView(): ViewInterface | null {
        return this.parent ? this.parent.view : null;
    }
    getChildrenViews(): ViewInterface[] {
        return this.children.map(child => child.view);
    }

    getSuperView(): ViewInterface | null {
        return this.superView ? this.superView.view : null;
    }

    getOriginView(): ViewInterface | null {
        return this.originView?.view || null;
    }

    setOriginView(origin: ViewControllerInterface): void {
        this.originView = origin;
    }
    setSuperView(superView: ViewControllerInterface): void {
        this.superView = superView;
    }
    setIsSuperView(isSuper: boolean): void {
        this.isSuperView = isSuper;
    }
    setParent(parent: ViewControllerInterface): void {
        this.parent = parent;
    }
    addChild(child: ViewControllerInterface): void {
        this.children.push(child);
    }


    /**
     * For nested views: set the chain of super views up to the root, so each view has a reference to its layout parents.
     * Called by ViewManager after creating the view and its super view(s).
     */
    setChainFromOrigin(): void {
        if (this.superView) {
            this.superView.setOriginView(this);
            this.superView.setChainFromOrigin();
        }
    }

    /**
     * When a view is destroyed, it should eject itself from the origin chain to prevent memory leaks.
     */
    ejectOriginChain(): void {
        if (this.originView) {
            const origin = this.originView;
            this.originView = null;
            origin.ejectOriginChain();
        }
    }

    get App(): ApplicationInterface {
        return this.__App as ApplicationInterface;
    }

    get isMounted(): boolean {
        return this._isMounted;
    }

    get isDestroyed(): boolean {
        return this._isDestroyed;
    }


    /** Whether this view has a super view (layout) */
    get hasSuperView(): boolean {
        return this.superViewPath !== null && this.superViewPath !== '';
    }


    // ─── Private ────────────────────────────────────────────────

    private generateViewId(): string {
        return `v_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    }
}
