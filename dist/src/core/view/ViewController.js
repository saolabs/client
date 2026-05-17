import { ViewState } from "./ViewState";
import { LoopContext } from "./LoopContext";
import { Reactive } from "../elements/Reactive";
import BlockManager from "../services/BlockManager";
import { Component } from "../elements/Component";
import { generateUUID } from "../hellpers/utils";
import { Output } from "../elements/Output";
import { Section } from "./Section";
import { Block, BlockOutlet, Fragment, Html } from "../elements";
import { Wrapper } from "../elements/Wrapper";
import { YieldElement } from "../elements/Yield";
import { app } from "../hellpers/app";
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
export class ViewController {
    // ─── Constructor ────────────────────────────────────────────
    constructor(view, path = '', viewType = 'view', viewId = null) {
        // ─── Identity ───────────────────────────────────────────────
        this.saoType = 'ViewController';
        // ─── View Hierarchy ─────────────────────────────────────────
        /** Parent view controller (for nested views) */
        this.parent = null;
        /** Child view controllers (for nested views) */
        this.children = [];
        /** Layout (super) view's controller */
        this.superView = null;
        /** Path to layout (super) view — e.g. 'layouts.main' */
        this.superViewPath = null;
        /** Whether this controller IS a layout */
        this.isSuperView = false;
        /** For layouts: the original page view's controller (for block mounting) */
        this.originView = null;
        // ─── Data & Config ──────────────────────────────────────────
        /** Raw input data from route/parent */
        this.data = {};
        /** User-defined config from setup() */
        this.config = {};
        /** Typed runtime config from compiled $__setup__ */
        this.runtimeConfig = {};
        /** Track own properties to avoid conflicts when setting user config */
        this.ownProperties = new Set(['__ctrl__']);
        // ─── DOM & Rendering ────────────────────────────────────────
        /** Root Html element — the container this view renders into */
        this.rootElement = null;
        this.parentElement = null; // For non-root views, track the parent element for correct mounting
        /** Root element tree returned by renderFactory (Fragment, Html, etc.) */
        this._rootTree = null;
        /** Compiled render factory — produces the element tree */
        this.renderFactory = null;
        /** Compiled prerender factory — produces the prerender element tree */
        this.prerenderFactory = null;
        this.childrenFactory = null;
        /** Stored render output for lifecycle management */
        this.renderOutput = null;
        /** Stored prerender output for hydration or caching */
        this.prerenderOutput = null;
        /** DOM children — for compatibility with HtmlInterface */
        this.domChildren = [];
        /** Flag: currently in a virtual render (for hydration or caching) */
        this.isVirtualRendering = false;
        this.initMode = 'create';
        // ─── Reactive System ────────────────────────────────────────
        /** Pending reactive updates — deduped, flushed in one RAF */
        this.pendingReactiveUpdates = new Set();
        this.hasScheduledUpdate = false;
        /** Centralized AbortController for all event listeners */
        this.eventAbortController = new AbortController();
        // ─── Loop ───────────────────────────────────────────────────
        /** Current loop context stack (@foreach, @for, @while) */
        this.loopContext = null;
        // ─── Layout (Sections & Blocks) ─────────────────────────────
        /** Section management across views */
        this.sections = new Map();
        /** Block slots in layout views */
        this.blocks = new Map();
        this.elements = new Map();
        this.preloadElement = null; // For pre-rendering elements before the main render
        this.mainElement = null; // The main rendered element tree
        // ─── Lifecycle Flags ────────────────────────────────────────
        /** Whether this view is currently active (mounted in DOM) */
        this.isActive = false;
        /** Whether initial data has been committed */
        this._isDataCommitted = false;
        /** Whether the view has been mounted */
        this._isMounted = false;
        /** Whether the view has been fully destroyed */
        this._isDestroyed = false;
        /** For future use: scanning DOM for bindings */
        this.isScanMode = false;
        // --- Route params for reference in blocks and sections (set by ViewManager on navigate) ---
        this.urlPath = null;
        this.callingMethod = null; // For debugging: track which method is currently executing
        this.__App = app();
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
    setup(config) {
        this.runtimeConfig = config;
        // Extract metadata
        if (config.viewId)
            this.viewId = config.viewId;
        if (config.path)
            this.path = config.path;
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
    getConfig(key, defaultValue) {
        if (key) {
            return this.runtimeConfig?.[key] ?? (this.config[key] ?? defaultValue);
        }
        return { ...this.runtimeConfig, ...this.config };
    }
    /** Set static view config shared by all instances of a compiled view class. */
    setStaticConfig(config) {
        this.config = config || {};
    }
    /** Set user-defined properties/methods on the View instance */
    setUserDefinedConfig(userConfig) {
        for (const [key, value] of Object.entries(userConfig)) {
            if (!this.ownProperties.has(key)) {
                this.view[key] = typeof value === 'function' && value.bind
                    ? value.bind(this.view)
                    : value;
            }
        }
    }
    /** Set the compiled render factory */
    setRenderFactory(factory) {
        this.renderFactory = factory;
    }
    /** Set root element — the container this view renders into */
    setRootElement(rootElement) {
        this.rootElement = rootElement;
    }
    setParentElement(parent) {
        this.parentElement = parent;
    }
    /** Render the view's element tree into rootElement.
     *
     * The compiled render factory (bound to this ViewController) returns
     * the root element tree (typically a Fragment). We set its parent
     * to rootElement, call render() to build DOM, and store the reference
     * for start/stop lifecycle management.
     */
    render() {
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
    prerender() {
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
    hydrate() {
        this.initMode = 'hydrate';
    }
    hydrateRender() {
        this.initMode = 'hydrate';
        let output = this.render();
        this.initMode = 'create';
        return output;
    }
    hydratePrerender() {
        this.initMode = 'hydrate';
        let output = this.prerender();
        this.initMode = 'create';
        return output;
    }
    mount(root) {
    }
    unmount() {
    }
    /**
     * Start — activate reactive subscriptions throughout the element tree.
     * Called AFTER render() and commitData().
     *
     * Flow: render() → commitData() → start()
     * This ensures initial state values are set before subscriptions fire.
     */
    start() {
        if (this._isDestroyed || !this._rootTree)
            return;
        // Recursively start all children (Output, TextElement, Html, Reactive, Fragment)
        if ('start' in this._rootTree && typeof this._rootTree.start === 'function') {
            this._rootTree.start();
        }
        // Fire onMounted hook
        if (typeof this.view.onMounted === 'function') {
            try {
                this.view.onMounted();
            }
            catch (e) {
                console.error(`[ViewController] onMounted error in "${this.path}":`, e);
            }
        }
    }
    /**
     * Stop — deactivate reactive subscriptions (for caching/deactivation).
     * DOM stays intact but reactive updates are paused.
     */
    stop() {
        if (this._isDestroyed || !this._rootTree)
            return;
        // Recursively stop all children
        if ('stop' in this._rootTree && typeof this._rootTree.stop === 'function') {
            this._rootTree.stop();
        }
        // Fire onDeactivated hook
        if (typeof this.view.onDeactivated === 'function') {
            try {
                this.view.onDeactivated();
            }
            catch (e) {
                console.error(`[ViewController] onDeactivated error in "${this.path}":`, e);
            }
        }
    }
    /** Full destroy — cleanup everything */
    destroy() {
        if (this._isDestroyed)
            return;
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
            }
            catch (e) {
                console.error(`[ViewController] onDestroy error in "${this.path}":`, e);
            }
        }
        // Nullify references
        this.rootElement = null;
        this.renderFactory = null;
        this.prerenderFactory = null;
        this._isMounted = false;
    }
    // ─── Data Lifecycle ─────────────────────────────────────────
    /**
     * Commit initial data — set initial state values.
     * Called by ViewManager AFTER render + block mounting.
     *
     * Flow: commitConstructorData() → update$xxx(initial) → lockUpdateRealState()
     */
    commitData() {
    }
    /**
     * Update data from external source (navigate same view, different params).
     * Flow: unlock → updateVariableData(newData) → re-set states → lock
     */
    updateData(newData) {
        this.runtimeConfig?.updateVariableData?.(newData);
    }
    /**
     * Update single data item.
     */
    updateDataItem(key, value) {
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
    addEventListener(element, event, handlers) {
        for (const h of handlers) {
            let fn;
            if (typeof h === 'function') {
                fn = h;
            }
            else if (typeof h === 'object' && h !== null) {
                const handlerDef = h;
                if (typeof handlerDef.handler === 'string') {
                    // Method name on view
                    const methodName = handlerDef.handler;
                    const view = this.view;
                    fn = ((event) => {
                        if (typeof view[methodName] === 'function') {
                            const params = handlerDef.params
                                ? handlerDef.params.map(p => {
                                    if (typeof p === 'function')
                                        return p(event);
                                    return p === '@EVENT' ? event : p;
                                })
                                : [event];
                            view[methodName](...params);
                        }
                    });
                }
                else if (typeof handlerDef.handler === 'function') {
                    const originalHandler = handlerDef.handler;
                    if (handlerDef.params) {
                        fn = ((event) => {
                            const params = handlerDef.params.map((p) => {
                                if (typeof p === 'function')
                                    return p(event);
                                return p === '@EVENT' ? event : p;
                            });
                            originalHandler.apply(this.view, params);
                        });
                    }
                    else {
                        fn = originalHandler;
                    }
                }
                else {
                    continue;
                }
            }
            else {
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
    scheduleUpdate(reactive) {
        if (this._isDestroyed)
            return;
        this.pendingReactiveUpdates.add(reactive);
        if (!this.hasScheduledUpdate) {
            this.hasScheduledUpdate = true;
            requestAnimationFrame(() => this.flushReactiveUpdates());
        }
    }
    flushReactiveUpdates() {
        if (this._isDestroyed)
            return;
        this.hasScheduledUpdate = false;
        const updates = Array.from(this.pendingReactiveUpdates);
        this.pendingReactiveUpdates.clear();
        for (const reactive of updates) {
            try {
                reactive.render();
            }
            catch (e) {
                console.error(`[ViewController] Reactive update error in "${this.path}":`, e);
            }
        }
    }
    section(name, config, contentRenderFactory) {
        if (this.sections.has(name)) {
            const section = this.sections.get(name);
            if (section) {
                return section;
            }
        }
        config.ctx = this;
        config.name = name;
        config.renderFactory = contentRenderFactory;
        const section = new Section(config);
        this.sections.set(name, section);
        return section;
    }
    // template methods called by compiled output — these build the element tree directly
    block(id, name, contentRenderFactory) {
        if (!id) {
            id = `b-${name}`;
        }
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
    blockOutlet(id = null, name, parentElement) {
        const initMode = this.initMode;
        if (!id) {
            id = `ob-${name}`;
        }
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
    mountBlock(id = null, name, parent) {
        return this.blockOutlet(id, name, parent);
    }
    /**
     * @useBlock(name) — register a block slot in the layout.
     * Creates a Reactive region between markers that will hold the block content.
     * BlockManager.mountAll() later inserts the page view's block content here.
     */
    useBlock(id = null, name, parent) {
        return this.blockOutlet(id, name, parent);
    }
    yield(id, name, defaultValue = null, parentElement = null) {
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
    yieldContent(name, defaultValue = null) {
        return this.App.View?.yieldContent?.(name, defaultValue) ?? defaultValue;
    }
    wrapper(factory) {
        const callingMethod = this.callingMethod;
        let key = callingMethod === 'prerender' ? 'preloadElement' : 'mainElement';
        let wrapper = this[key];
        if (!wrapper) {
            wrapper = new Wrapper({ ctx: this, initMode: this.initMode, parentElement: this.parentElement, childrenFactory: factory });
            this[key] = wrapper;
        }
        else {
            wrapper.setChildrenFactory(factory);
        }
        return wrapper;
    }
    fragment(id = null, parentElement, childrenFactory) {
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
    html(id = null, tagName, parentElement, config, childrenFactory) {
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
    reactive(id, type, parentReactive, parentElement, stateKeys, childrenFactory) {
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
        const reactive = new Reactive({
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
    output(id, parent, isEscapeHTML = true, stateKeys = [], contentFactory = () => '') {
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
    text(text) {
        return document.createTextNode(text);
    }
    include(id = null, path = '', parentElement, stateKeys, dataFactory) {
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
    includeIf(id = null, path, parentElement, stateKeys, dataFactory) {
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
    includeWhen(id, condition, path, parentElement, stateKeys, dataFactory) {
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
    extendView(path, data = {}) {
        this.superViewPath = path;
        const superView = this.App.View?.view(path, data, true);
        if (superView) {
            this.setSuperView(superView?.__ctrl__);
            return superView;
        }
        // If super view not found, log error and return null
        return superView;
    }
    // ─── Loop Directives ────────────────────────────────────────
    /** Create and push a new LoopContext onto the stack */
    __setLoopContext(length) {
        const parent = this.loopContext;
        this.loopContext = new LoopContext(parent);
        this.loopContext.setCount(length);
        return this.loopContext;
    }
    /** Pop the current LoopContext, restore parent */
    __resetLoopContext() {
        if (this.loopContext?.parent) {
            const parent = this.loopContext.parent;
            this.loopContext.parent = null;
            Object.freeze(this.loopContext);
            this.loopContext = parent;
        }
        else if (this.loopContext) {
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
    __foreach(list, callback) {
        if (!list || typeof list !== 'object')
            return [];
        const result = [];
        try {
            if (Array.isArray(list)) {
                const loopCtx = this.__setLoopContext(list.length);
                loopCtx.setType('increment');
                list.forEach((item, index) => {
                    loopCtx.setCurrentTimes(index);
                    const output = callback(item, String(index), index, loopCtx);
                    if (output !== undefined && output !== null) {
                        if (Array.isArray(output))
                            result.push(...output);
                        else
                            result.push(output);
                    }
                });
            }
            else {
                const keys = Object.keys(list);
                const loopCtx = this.__setLoopContext(keys.length);
                loopCtx.setType('increment');
                keys.forEach((key, index) => {
                    loopCtx.setCurrentTimes(index);
                    const output = callback(list[key], key, index, loopCtx);
                    if (output !== undefined && output !== null) {
                        if (Array.isArray(output))
                            result.push(...output);
                        else
                            result.push(output);
                    }
                });
            }
        }
        catch (e) {
            console.error(`[ViewController] @foreach error in "${this.path}":`, e);
        }
        finally {
            this.__resetLoopContext();
        }
        return result;
    }
    __forelse(list, callback, emptyCallback = () => []) {
        if (this.App.Helper.count(list) === 0) {
            return emptyCallback();
        }
        return this.__foreach(list, callback);
    }
    __each(list, callback) {
        return this.__foreach(list, callback);
    }
    /**
     * @for directive
     */
    __for(loopType = 'increment', start = 0, end = 0, execute = () => []) {
        const loopCtx = this.__setLoopContext(end);
        loopCtx.setType(loopType);
        let result;
        try {
            result = typeof execute === 'function' ? execute(loopCtx) : [];
        }
        catch (e) {
            console.error(`[ViewController] @for error in "${this.path}":`, e);
            result = [];
        }
        finally {
            this.__resetLoopContext();
        }
        return result;
    }
    /**
     * @while directive
     */
    __while(execute, maxIterations = 10000) {
        const loopCtx = this.__setLoopContext(-1);
        loopCtx.setType('increment');
        let result;
        try {
            result = typeof execute === 'function' ? execute(loopCtx) : [];
        }
        catch (e) {
            console.error(`[ViewController] @while error in "${this.path}":`, e);
            result = [];
        }
        finally {
            if (loopCtx.count === -1) {
                loopCtx.count = loopCtx.iteration;
            }
            this.__resetLoopContext();
        }
        return result;
    }
    // mounting
    // ─── Config & App Access ────────────────────────────────────
    setApp(app) {
        this.__App = app;
    }
    getParentView() {
        return this.parent ? this.parent.view : null;
    }
    getChildrenViews() {
        return this.children.map(child => child.view);
    }
    getSuperView() {
        return this.superView ? this.superView.view : null;
    }
    getOriginView() {
        return this.originView?.view || null;
    }
    setOriginView(origin) {
        this.originView = origin;
    }
    setSuperView(superView) {
        this.superView = superView;
    }
    setIsSuperView(isSuper) {
        this.isSuperView = isSuper;
    }
    setParent(parent) {
        this.parent = parent;
    }
    addChild(child) {
        this.children.push(child);
    }
    /**
     * For nested views: set the chain of super views up to the root, so each view has a reference to its layout parents.
     * Called by ViewManager after creating the view and its super view(s).
     */
    setChainFromOrigin() {
        if (this.superView) {
            this.superView.setOriginView(this);
            this.superView.setChainFromOrigin();
        }
    }
    /**
     * When a view is destroyed, it should eject itself from the origin chain to prevent memory leaks.
     */
    ejectOriginChain() {
        if (this.originView) {
            const origin = this.originView;
            this.originView = null;
            origin.ejectOriginChain();
        }
    }
    get App() {
        return this.__App;
    }
    get isMounted() {
        return this._isMounted;
    }
    get isDestroyed() {
        return this._isDestroyed;
    }
    /** Whether this view has a super view (layout) */
    get hasSuperView() {
        return this.superViewPath !== null && this.superViewPath !== '';
    }
    // ─── Private ────────────────────────────────────────────────
    generateViewId() {
        return `v_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    }
}
//# sourceMappingURL=ViewController.js.map