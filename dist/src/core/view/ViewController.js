import { ViewState } from "./ViewState";
import { LoopContext } from "./LoopContext";
import { Reactive } from "../elements/Reactive";
import BlockManager from "../services/BlockManager";
import { Component } from "../elements/Component";
import { generateUUID } from "../helpers/utils";
import { Output } from "../elements/Output";
import { Section } from "./Section";
import { Block, BlockOutlet, Fragment, Html, TextElement } from "../elements";
import { Wrapper } from "../elements/Wrapper";
import { YieldElement } from "../elements/Yield";
import { app } from "../helpers/app";
import AssetManager from "../services/AssetManager";
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
        /**
         * Active ForeachSlotCache — được set bởi Reactive.renderForeach() trước khi
         * gọi childrenFactory. __foreach() đọc cache này để quyết định reuse hay create.
         * Reset về null ngay sau khi childrenFactory trả về.
         */
        this._currentForeachCache = null;
        this._foreachSkipRegistry = false;
        // ─── Layout (Sections & Blocks) ─────────────────────────────
        /** Section management across views */
        this.sections = new Map();
        /** Block slots in layout views */
        this.blocks = new Map();
        this.elements = new Map();
        this.preloadElement = null; // For pre-rendering elements before the main render
        this.mainElement = null; // The main rendered element tree
        this.wrapperInstance = null; // For caching the wrapper instance used in render/prerender
        // ─── Lifecycle Flags ────────────────────────────────────────
        /** Whether this view is currently active (mounted in DOM) */
        this.isActive = false;
        /** Whether initial data has been committed */
        this._isDataCommitted = false;
        /** Whether the view has been mounted */
        this._isMounted = false;
        /** Whether the view has been fully destroyed */
        this._isDestroyed = false;
        /** Whether this instance's styles/scripts are currently counted in AssetManager
         *  (true = đang góp 1 ref vào real DOM). Giữ acquire/release cân bằng. */
        this._assetsLive = false;
        /** For future use: scanning DOM for bindings */
        this.isScanMode = false;
        // --- Route params for reference in blocks and sections (set by ViewManager on navigate) ---
        this.urlPath = null;
        this.callingMethod = null; // For debugging: track which method is currently executing
        // ─── Pause / Resume (PageCache lifecycle) ───────────────────
        // State machine: created → active ⇄ paused → destroyed
        // Thiết kế: ROUTE_RENDER_FLOW.md §7. pause/resume là API công khai;
        // stop()/start() là chi tiết nội bộ + đường mount ban đầu.
        this._lifecycleState = 'created';
        /** Data nhận được trong lúc paused (async fetch về muộn) — apply khi resume */
        this._bufferedData = null;
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
        // FIX(baseline#9): gán _rootTree để start()/stop()/destroy() theo controller hoạt động.
        // Chỉ gán khi output là element tree (Wrapper) — không gán khi return superView (View).
        if (output && typeof output.start === 'function' && output.saoType !== 'View') {
            this._rootTree = output;
        }
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
    // ─── Lifecycle Hooks Dispatcher ─────────────────────────────
    // Bộ hook vòng đời (mẫu examples/sao/app.sao) — mỗi transition một cặp
    // before/after. Hook là method tuỳ chọn trên View (this.view[name]):
    //   mount   → mounting / mounted       (DOM gắn vào real DOM)
    //   start   → starting / started       (subscribe reactive + attach events)
    //   pause   → pausing  / paused        (vào PageCache — rời real DOM)
    //   resume  → resuming / resumed       (khôi phục từ PageCache)
    //   stop    → stopping / stopped       (huỷ subscribe — deactivate)
    //   unmount → unmounting / unmounted   (gỡ DOM khỏi real DOM)
    //   destroy → destroying / destroyed   (cleanup toàn bộ)
    // Legacy alias (tương thích test/app cũ): onMounted≈started, onPause≈paused,
    // onResume≈resumed, onDeactivated≈stopped, onDestroy≈destroyed.
    /** Gọi an toàn một lifecycle hook nếu user có định nghĩa trên View. */
    callHook(name) {
        const fn = this.view?.[name];
        if (typeof fn === 'function') {
            try {
                fn.call(this.view);
            }
            catch (e) {
                console.error(`[ViewController] hook "${name}" error in "${this.path}":`, e);
            }
        }
    }
    /**
     * Mount — instance vào real DOM.
     *   - root != null: gắn DOM tree (mainElement/preloadElement) vào root.
     *   - root == null: nội dung đã được đặt sẵn (block outlets / component markers),
     *     chỉ fire hook + acquire asset.
     * Fire mounting/mounted MỘT lần mỗi vòng đời; pause→resume dùng resuming/resumed.
     */
    mount(root = null) {
        if (this._isDestroyed)
            return;
        const firstMount = !this._isMounted;
        if (firstMount)
            this.callHook('mounting');
        if (root) {
            this.setParentElement(root);
            const el = this.mainElement ?? this.preloadElement;
            if (el) {
                el.setParentElement(root);
                el.mountTo(root);
            }
        }
        this._isMounted = true;
        this.acquireAssets();
        if (firstMount)
            this.callHook('mounted');
    }
    /** Unmount — gỡ instance khỏi real DOM (fire hook + release asset). */
    unmount() {
        this.callHook('unmounting');
        this.releaseAssets();
        this._isMounted = false;
        this.callHook('unmounted');
    }
    // ─── Style/Script asset (AssetManager, ref-count theo path) ──
    /** Đăng ký style/script của component vào real DOM (insert khi ref 0→1). */
    acquireAssets() {
        if (this._assetsLive)
            return;
        const styles = this.getConfig('styles');
        const scripts = this.getConfig('scripts');
        if ((!styles || !styles.length) && (!scripts || !scripts.length))
            return;
        this._assetsLive = true;
        AssetManager.acquire(this.path, styles, scripts, this.getSubtreeRoots());
    }
    /** Gỡ đăng ký style/script (remove khi ref 1→0). */
    releaseAssets() {
        if (!this._assetsLive)
            return;
        this._assetsLive = false;
        const styles = this.getConfig('styles');
        const scripts = this.getConfig('scripts');
        AssetManager.release(this.path, styles, scripts);
    }
    /** Các Element gốc của instance (giữa markers của Wrapper) — để tag scoped style. */
    getSubtreeRoots() {
        const wrapper = this.mainElement ?? this.preloadElement;
        const open = wrapper?.openTag ?? null;
        const close = wrapper?.closeTag ?? null;
        if (!open || !close || !open.parentNode)
            return [];
        const roots = [];
        let cur = open.nextSibling;
        while (cur && cur !== close) {
            if (cur.nodeType === 1)
                roots.push(cur);
            cur = cur.nextSibling;
        }
        return roots;
    }
    /**
     * Start — activate reactive subscriptions throughout the element tree.
     * Called AFTER render() and commitData().
     *
     * Flow: render() → commitData() → start()
     * This ensures initial state values are set before subscriptions fire.
     */
    start() {
        if (this._isDestroyed)
            return;
        // Page extends layout không có _rootTree (render trả về superView) —
        // tree thật của nó là block content, được BlockManager.startAll() kích hoạt.
        if (!this._rootTree && this.blocks.size === 0)
            return;
        this.callHook('starting');
        // Recursively start all children (Output, TextElement, Html, Reactive, Fragment)
        if (this._rootTree && 'start' in this._rootTree && typeof this._rootTree.start === 'function') {
            this._rootTree.start();
        }
        this._lifecycleState = 'active';
        this.callHook('started');
        this.callHook('onMounted'); // legacy alias
    }
    get lifecycleState() {
        return this._lifecycleState;
    }
    /**
     * Pause — tạm dừng để vào PageCache:
     *   1. Flush nốt RAF pending (không mất update đang chờ)
     *   2. State listeners → dirty-mode (KHÔNG unsubscribe — ghi sổ key đổi)
     *   3. Hook onPause cho user dọn tài nguyên thô
     * DOM event listeners giữ nguyên — DOM sẽ bị detach nên vô hại.
     */
    pause() {
        if (this._lifecycleState !== 'active') {
            if (this._lifecycleState === 'paused')
                return;
            console.warn(`[ViewController] pause() bị bỏ qua: "${this.path}" đang ở trạng thái "${this._lifecycleState}".`);
            return;
        }
        this.callHook('pausing');
        // 1. Flush nốt mọi update đang chờ → DOM là snapshot nhất quán
        this.states.__.flushNow();
        this.flushReactiveUpdatesNow();
        // 2. Dirty-mode
        this.states.__.pause();
        this._lifecycleState = 'paused';
        this.isActive = false;
        // 3. Rời real DOM (sắp detach vào PageCache) → gỡ style/script (ref--)
        this.releaseAssets();
        // 4. Hook
        this.callHook('paused');
        this.callHook('onPause'); // legacy alias
    }
    /**
     * Resume — khôi phục từ PageCache:
     *   1. Apply buffered data (async về trong lúc paused)
     *   2. Thoát dirty-mode → flush đúng các vùng phụ thuộc dirty keys
     *   3. Hook onResume — nơi user quyết định refetch (theo TTL riêng...)
     */
    resume() {
        if (this._lifecycleState !== 'paused') {
            console.warn(`[ViewController] resume() bị bỏ qua: "${this.path}" đang ở trạng thái "${this._lifecycleState}".`);
            return;
        }
        this.callHook('resuming');
        this._lifecycleState = 'active';
        this.isActive = true;
        // 1. Quay lại real DOM → insert lại style/script (ref++)
        this.acquireAssets();
        // 2. Buffered async data → updateData thật (key đổi sẽ vào pending → flush ngay sau)
        const buffered = this._bufferedData;
        this._bufferedData = null;
        // 3. Thoát dirty-mode; resume() của StateManager tự notify các key dirty
        this.states.__.resume();
        if (buffered) {
            this.updateData(buffered);
        }
        // 4. Hook
        this.callHook('resumed');
        this.callHook('onResume'); // legacy alias
    }
    /** Flush đồng bộ các reactive update đang chờ RAF */
    flushReactiveUpdatesNow() {
        if (this.hasScheduledUpdate || this.pendingReactiveUpdates.size > 0) {
            this.flushReactiveUpdates();
            this.hasScheduledUpdate = false;
        }
    }
    /**
     * Stop — deactivate reactive subscriptions (for caching/deactivation).
     * DOM stays intact but reactive updates are paused.
     */
    stop() {
        if (this._isDestroyed || !this._rootTree)
            return;
        this.callHook('stopping');
        // Recursively stop all children
        if ('stop' in this._rootTree && typeof this._rootTree.stop === 'function') {
            this._rootTree.stop();
        }
        this.callHook('stopped');
        this.callHook('onDeactivated'); // legacy alias
    }
    /** Full destroy — cleanup everything */
    destroy() {
        if (this._isDestroyed)
            return;
        this.callHook('destroying');
        // Gỡ style/script nếu instance còn đang giữ ref (chưa qua pause)
        this.releaseAssets();
        this._isDestroyed = true;
        this._lifecycleState = 'destroyed';
        // Stop reactive subscriptions first
        this.stop();
        // Cancel pending updates
        this.pendingReactiveUpdates.clear();
        this.hasScheduledUpdate = false;
        // Abort all event listeners
        this.eventAbortController.abort();
        // Sắp gỡ DOM khỏi real DOM
        this.callHook('unmounting');
        // Destroy root tree
        if (this._rootTree && 'destroy' in this._rootTree && typeof this._rootTree.destroy === 'function') {
            this._rootTree.destroy();
        }
        this._rootTree = null;
        this._isMounted = false;
        this.callHook('unmounted');
        // Destroy state
        this.states.__.destroy();
        // Cleanup loop context stack
        this.loopContext = null;
        // Fire onDestroy hook (legacy alias của 'destroyed')
        this.callHook('onDestroy');
        // Gỡ block content + outlets của view này khỏi BlockManager (tránh leak qua navigation)
        BlockManager.unmountView(this.viewId);
        BlockManager.removeOutletsOfView(this.viewId);
        // Clear element registry — tránh giữ reference corpse elements (memory leak)
        this.elements.clear();
        this.sections.clear();
        this.blocks.clear();
        // Nullify references
        this.rootElement = null;
        this.renderFactory = null;
        this.prerenderFactory = null;
        this._isMounted = false;
        this.callHook('destroyed');
    }
    active() {
        this.isActive = true;
    }
    deactive() {
        this.isActive = false;
    }
    // ─── Data Lifecycle ─────────────────────────────────────────
    /**
     * `this` context cho các hàm compiled config (updateVariableData dùng
     * this.config.updateVariableItemData và this.data).
     */
    makeConfigThis() {
        return {
            config: this.runtimeConfig,
            data: this.data,
            ctrl: this,
            view: this.view,
        };
    }
    /**
     * Commit initial data — set initial state values.
     * Called by ViewManager AFTER render + block mounting.
     *
     * Flow: commitConstructorData() → update$xxx(initial) → lockUpdateRealState()
     * FIX(Phase2): trước đây method này RỖNG — compiled commitConstructorData
     * không bao giờ được gọi.
     */
    commitData() {
        if (this._isDataCommitted || this._isDestroyed)
            return;
        const fn = this.runtimeConfig?.commitConstructorData;
        if (typeof fn === 'function') {
            try {
                fn.call(this.makeConfigThis());
            }
            catch (e) {
                console.error(`[ViewController] commitData error in "${this.path}":`, e);
            }
        }
        this._isDataCommitted = true;
    }
    /**
     * Update data from external source (navigate same view, different params).
     * Flow: unlock → updateVariableData(newData) → re-set states → lock.
     * Khi paused: buffer lại, apply lúc resume (ROUTE_RENDER_FLOW §8.2).
     */
    updateData(newData) {
        if (this._isDestroyed)
            return;
        if (this._lifecycleState === 'paused') {
            this._bufferedData = { ...(this._bufferedData ?? {}), ...newData };
            return;
        }
        this.data = { ...this.data, ...newData };
        const fn = this.runtimeConfig?.updateVariableData;
        if (typeof fn === 'function') {
            this.states.__.unlockUpdateRealState();
            try {
                fn.call(this.makeConfigThis(), newData);
            }
            catch (e) {
                console.error(`[ViewController] updateData error in "${this.path}":`, e);
            }
            finally {
                this.states.__.lockUpdateRealState();
            }
        }
    }
    /**
     * Update single data item.
     */
    updateDataItem(key, value) {
        this.data[key] = value;
        const fn = this.runtimeConfig?.updateVariableItemData;
        if (typeof fn === 'function') {
            this.states.__.unlockUpdateRealState();
            try {
                fn.call(this.makeConfigThis(), key, value);
            }
            catch (e) {
                console.error(`[ViewController] updateDataItem error in "${this.path}":`, e);
            }
            finally {
                this.states.__.lockUpdateRealState();
            }
        }
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
    // Element & Block Creation Methods — called by compiled output to build the element tree directly, instead of returning HTML strings.
    pushBlockAndSections() {
        // This method is called by compiled output after rendering blocks and sections, to ensure they are registered in the manager before any child views try to access them.
    }
    /**
     *
     * @param name
     * @param config
     * @param contentRenderFactory
     * @returns
     */
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
    blockOutlet(id = null, name, parentElement) {
        const initMode = this.initMode;
        if (!id) {
            id = `ob-${name}`;
        }
        id = `${this.viewId}-${id}`;
        const existing = this.elements.get(id);
        if (existing instanceof BlockOutlet && !existing.__destroyed__) {
            existing.setParentElement(parentElement);
            existing.initMode = initMode;
            // Re-register: BlockManager có thể đã bị reset/clear giữa các lần mount
            // (addOutlet idempotent) — thiếu dòng này mountAll() sẽ không thấy outlet
            BlockManager.addOutlet(id, existing);
            return existing;
        }
        const outlet = new BlockOutlet({ ctx: this, name, id, parentElement, initMode });
        this.elements.set(id, outlet);
        BlockManager.addOutlet(id, outlet); // đăng ký để mountAll tìm được outlet theo name
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
        let wrapper = this.wrapperInstance;
        if (!wrapper) {
            wrapper = new Wrapper({ ctx: this, initMode: this.initMode, parentElement: this.parentElement, childrenFactory: factory });
            this.wrapperInstance = wrapper;
        }
        else {
            wrapper.setChildrenFactory(factory);
        }
        this[key] = wrapper;
        return wrapper;
    }
    fragment(id = null, parentElement, childrenFactory) {
        if (!id) {
            id = `fr-${generateUUID(5)}`;
        }
        const existing = this.aliveFromRegistry(id, Fragment);
        if (existing) {
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
        const existing = this.aliveFromRegistry(id, Html);
        if (existing) {
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
        // Prefix viewId để khớp marker id server phát ra (RUNTIME_CONTRACT §5):
        // compiler emit cùng hash cho JS + Blade, server hoá thành `${viewId}-${hash}`.
        // Giống output()/block()/blockOutlet() — Reactive trước đây bị thiếu bước này.
        id = `${this.viewId}-${id}`;
        const existing = this.aliveFromRegistry(id, Reactive);
        if (existing) {
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
            childrenFactory,
            initMode: this.initMode,
        });
        this.elements.set(id, reactive);
        return reactive;
    }
    output(id, parent, isEscapeHTML = true, stateKeys = [], contentFactory = () => '') {
        if (!id) {
            id = `o-${generateUUID(5)}`;
        }
        const existing = this.aliveFromRegistry(id, Output);
        if (existing) {
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
            initMode: this.initMode,
        });
        this.elements.set(id, output);
        return output;
    }
    /**
     * FIX(baseline#2): trả về TextElement (có saoType) thay vì raw Text node.
     * Raw Text node bị mountElementList/Reactive.render bỏ qua → text tĩnh biến mất.
     */
    text(text) {
        return new TextElement({ ctx: this, stateKeys: [], generateText: () => text });
    }
    /**
     * Registry guard: element đã destroy không được reuse — trả về corpse
     * (events đã abort, markers đã gỡ) gây render rỗng / stale closure.
     * Xem docs/RUNTIME_CONTRACT.md §2.
     */
    aliveFromRegistry(id, ctor) {
        if (this._foreachSkipRegistry)
            return null;
        const existing = this.elements.get(id);
        if (existing instanceof ctor && !existing.__destroyed__) {
            return existing;
        }
        return null;
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
     * # Cache-aware re-render (Phase 5)
     * Khi `_currentForeachCache` được set (bởi Reactive.renderForeach()), __foreach
     * kiểm tra cache trước mỗi item:
     *   - Cache hit (item ref giống) → trả về elements cũ (reuse, không recreate DOM)
     *   - Cache miss (item mới)     → gọi callback → tạo elements mới → lưu vào cache
     *
     * Identity keying: cache key là object reference của item, không phải index.
     * → Reorder list giữ nguyên elements cho từng item (chỉ thay đổi vị trí DOM).
     * → Immutable-data patterns (mỗi update tạo object mới) được handle tự động.
     *
     * @example Compiled output:
     * ctrl.__foreach(items, (item, key, index, loop) => [
     *     this.html('id', 'div', p, {}, () => [this.text(item.name)])
     * ])
     */
    __foreach(list, callback) {
        if (!list || typeof list !== 'object')
            return [];
        // Lấy cache đang active (null = không có cache, dùng behavior cũ)
        const cache = this._currentForeachCache;
        const result = [];
        try {
            if (Array.isArray(list)) {
                const loopCtx = this.__setLoopContext(list.length);
                loopCtx.setType('increment');
                list.forEach((item, index) => {
                    loopCtx.setCurrentTimes(index);
                    // ── Cache-aware path ──────────────────────────────────────
                    if (cache) {
                        const slot = cache.get(item);
                        if (slot) {
                            // Cache HIT: item ref giống → reuse elements cũ.
                            // Elements vẫn close over cùng object ref → data đúng.
                            result.push(...slot.elements);
                            return; // skip callback
                        }
                    }
                    // ── Cache MISS hoặc không dùng cache ─────────────────────
                    if (cache)
                        this._foreachSkipRegistry = true;
                    const output = callback(item, String(index), index, loopCtx);
                    if (cache)
                        this._foreachSkipRegistry = false;
                    if (output !== undefined && output !== null) {
                        const elements = Array.isArray(output) ? output : [output];
                        result.push(...elements);
                        if (cache) {
                            cache.set(item, elements);
                        }
                    }
                });
            }
            else {
                // Object iteration — cache không áp dụng (keys thay vì refs)
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
    // ─── Directive Binding Helpers ──────────────────────────────
    //
    // Compiler pre-processes @show/@style/@class directives thành
    // template literal calls trước khi tạo element config.
    // Ví dụ: @show($isVisible) → style="${this.__showBinding(['isVisible'], isVisible)}"
    //        @style([...])     → ${this.__styleBinding([...], [...])}
    //        @class([...])     → ${this.__classBinding([...])}  (legacy path)
    //
    // Các method này được Html._applyAttr() gọi qua factory khi render và khi
    // state thay đổi (Html đã subscribe stateKeys từ compiled config).
    // ────────────────────────────────────────────────────────────
    /**
     * __showBinding — tính CSS style string cho @show directive.
     *
     * Compiler emit (pre-process trước AST):
     *   @show($isVisible)  →  style="${this.__showBinding(['isVisible'], isVisible)}"
     *
     * Hành vi:
     *   - condition truthy  → '' (element hiện, style="" hoặc style bị remove)
     *   - condition falsy   → 'display: none;' (element ẩn)
     *
     * Reactivity được xử lý bởi Html._applyAttr() — nó subscribe stateKeys
     * và gọi lại factory khi state thay đổi. Method này chỉ compute giá trị hiện tại.
     *
     * @param _stateKeys - Danh sách state keys (đã được encode trong compiled config, không dùng ở đây)
     * @param condition  - Điều kiện hiện/ẩn (truthy = show, falsy = hide)
     */
    __showBinding(_stateKeys, condition) {
        return condition ? '' : 'display: none;';
    }
    /**
     * __styleBinding — tính inline CSS style string cho @style directive.
     *
     * Compiler emit (pre-process trước AST):
     *   @style(['color' => $textColor, 'font-size' => $fontSize])
     *   →  ${this.__styleBinding(['textColor', 'fontSize'], [['color', textColor], ['font-size', fontSize]])}
     *
     * Hành vi:
     *   - Lọc bỏ entries có value null / undefined / false / '' (không set prop đó)
     *   - Join thành "prop: value; prop: value" string
     *
     * @param _stateKeys - Danh sách state keys (đã encode trong config, không dùng ở đây)
     * @param styles     - Mảng [cssProperty, value] pairs
     *
     * @example
     *   __styleBinding([], [['color', 'red'], ['font-size', null], ['display', 'block']])
     *   // → "color: red; display: block"
     */
    __styleBinding(_stateKeys, styles) {
        if (!Array.isArray(styles))
            return '';
        return styles
            .filter(([, value]) => value !== null && value !== undefined && value !== false && value !== '')
            .map(([prop, value]) => `${prop}: ${String(value)}`)
            .join('; ');
    }
    /**
     * __classBinding — tính CSS class string cho @class binding (legacy template path).
     *
     * Chỉ được gọi bởi OLD template_processor (flat compiler) fallback path.
     * New AST path (RenderGenerator) emit class config trực tiếp vào options.classes[]
     * → Html.initializeClasses() xử lý, KHÔNG dùng __classBinding.
     *
     * Format input (từ class_binding_handler.py):
     *   [{ type: 'static', value: 'foo' },
     *    { type: 'binding', value: 'is-active', states: ['isActive'], checker: () => isActive }]
     *
     * @param configs - Mảng class config objects
     * @returns Space-joined class string
     *
     * @example
     *   __classBinding([
     *     { type: 'static', value: 'btn' },
     *     { type: 'binding', value: 'btn-primary', checker: () => isPrimary }
     *   ])
     *   // isPrimary = true → "btn btn-primary"
     *   // isPrimary = false → "btn"
     */
    __classBinding(configs) {
        if (!Array.isArray(configs))
            return '';
        const classes = [];
        for (const config of configs) {
            if (!config?.value)
                continue;
            if (config.type === 'static') {
                classes.push(config.value);
            }
            else if (config.type === 'binding') {
                // Thực thi checker để quyết định thêm class không
                if (typeof config.checker === 'function' && config.checker()) {
                    classes.push(config.value);
                }
            }
        }
        return classes.join(' ');
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