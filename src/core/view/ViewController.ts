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
import { ForeachSlotCache } from "../elements/ForeachSlotCache";
import AssetManager, { StyleSpec, ScriptSpec } from "../services/AssetManager";

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
    /** Exact listener references for cleanup when an individual Html node dies. */
    public elementEventHandlers: Map<HTMLElement, Map<string, EventListener[]>> = new Map();

    // ─── Loop ───────────────────────────────────────────────────
    /** Current loop context stack (@foreach, @for, @while) */
    public loopContext: LoopContext | null = null;

    /**
     * Active ForeachSlotCache — được set bởi Reactive.renderForeach() trước khi
     * gọi childrenFactory. __foreach() đọc cache này để quyết định reuse hay create.
     * Reset về null ngay sau khi childrenFactory trả về.
     */
    public _currentForeachCache: ForeachSlotCache | null = null;
    public _foreachSkipRegistry: boolean = false;

    // ─── Layout (Sections & Blocks) ─────────────────────────────
    /** Section management across views */
    public sections: Map<string, SectionInterface> = new Map();
    /** Block slots in layout views */
    public blocks: Map<string, BlockInterface> = new Map();

    public elements: Map<string, ElementChild> = new Map();

    public preloadElement: WrapperInterface | null = null; // For pre-rendering elements before the main render
    public mainElement: WrapperInterface | null = null; // The main rendered element tree
    /** Wrapper instance RIÊNG cho render/prerender — dùng chung sẽ làm
     *  preloadElement === mainElement → swap skeleton→main destroy nhầm chính nó */
    private wrapperInstances: { render: WrapperInterface | null; prerender: WrapperInterface | null } = { render: null, prerender: null };
    // ─── Lifecycle Flags ────────────────────────────────────────
    /** Whether this view is currently active (mounted in DOM) */
    public isActive: boolean = false;
    /** Whether initial data has been committed */
    private _isDataCommitted = false;
    /** Whether the view has been mounted */
    private _isMounted = false;
    /** Whether the reactive element tree has been started. */
    private _isStarted = false;
    /** Whether the view has been fully destroyed */
    private _isDestroyed = false;
    /** Whether this instance's styles/scripts are currently counted in AssetManager
     *  (true = đang góp 1 ref vào real DOM). Giữ acquire/release cân bằng. */
    private _assetsLive = false;
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
        // FIX(baseline#9): gán _rootTree để start()/stop()/destroy() theo controller hoạt động.
        // Chỉ gán khi output là element tree (Wrapper) — không gán khi return superView (View).
        if (output && typeof (output as any).start === 'function' && (output as any).saoType !== 'View') {
            this._rootTree = output;
        }
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
        // Skeleton là tree đang live cho tới khi async render thay thế nó.
        // Controller phải start/pause/destroy được tree này như render tree thường.
        if (output && typeof (output as any).start === 'function' && (output as any).saoType !== 'View') {
            this._rootTree = output;
        }
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
    private callHook(name: string): void {
        const fn = (this.view as any)?.[name];
        if (typeof fn === 'function') {
            try {
                const result = fn.call(this.view);
                // Lifecycle transitions are deliberately synchronous. If a user hook
                // is async, do not block navigation, but never leave a rejected promise
                // unhandled either.
                if (result && typeof result.then === 'function') {
                    Promise.resolve(result).catch((e) => {
                        console.error(`[ViewController] async hook "${name}" error in "${this.path}":`, e);
                    });
                }
            }
            catch (e) { console.error(`[ViewController] hook "${name}" error in "${this.path}":`, e); }
        }
    }

    /**
     * Mount — instance vào real DOM.
     *   - root != null: gắn DOM tree (mainElement/preloadElement) vào root.
     *   - root == null: nội dung đã được đặt sẵn (block outlets / component markers),
     *     chỉ fire hook + acquire asset.
     * Fire mounting/mounted MỘT lần mỗi vòng đời; pause→resume dùng resuming/resumed.
     */
    mount(root: HtmlInterface | null = null): void {
        if (this._isDestroyed) return;
        const firstMount = !this._isMounted;
        if (firstMount) this.callHook('mounting');

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
        if (firstMount) this.callHook('mounted');
    }

    /** Unmount — gỡ instance khỏi real DOM (fire hook + release asset). */
    unmount(): void {
        if (this._isDestroyed || !this._isMounted) return;
        this.callHook('unmounting');
        this.releaseAssets();
        this._isMounted = false;
        this.callHook('unmounted');
    }

    // ─── Style/Script asset (AssetManager, ref-count theo path) ──

    /** Đăng ký style/script của component vào real DOM (insert khi ref 0→1). */
    private acquireAssets(): void {
        if (this._assetsLive) return;
        const styles = this.getConfig('styles') as StyleSpec[] | undefined;
        const scripts = this.getConfig('scripts') as ScriptSpec[] | undefined;
        if ((!styles || !styles.length) && (!scripts || !scripts.length)) return;
        this._assetsLive = true;
        AssetManager.acquire(this.path, styles, scripts, this.getSubtreeRoots());
    }

    /** Gỡ đăng ký style/script (remove khi ref 1→0). */
    private releaseAssets(): void {
        if (!this._assetsLive) return;
        this._assetsLive = false;
        const styles = this.getConfig('styles') as StyleSpec[] | undefined;
        const scripts = this.getConfig('scripts') as ScriptSpec[] | undefined;
        AssetManager.release(this.path, styles, scripts);
    }

    /** Các Element gốc của instance (giữa markers của Wrapper) — để tag scoped style. */
    private getSubtreeRoots(): Node[] {
        const wrapper: any = this.mainElement ?? this.preloadElement;
        const open: Node | null = wrapper?.openTag ?? null;
        const close: Node | null = wrapper?.closeTag ?? null;
        if (!open || !close || !open.parentNode) return [];
        const roots: Node[] = [];
        let cur: Node | null = open.nextSibling;
        while (cur && cur !== close) {
            if (cur.nodeType === 1) roots.push(cur);
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
    start(): void {
        if (this._isDestroyed || this._isStarted) return;
        // Page extends layout không có _rootTree (render trả về superView) —
        // tree thật của nó là block content, được BlockManager.startAll() kích hoạt.
        if (!this._rootTree && this.blocks.size === 0) return;

        this.callHook('starting');
        this._isStarted = true;

        // Recursively start all children (Output, TextElement, Html, Reactive, Fragment)
        if (this._rootTree && 'start' in this._rootTree && typeof this._rootTree.start === 'function') {
            this._rootTree.start();
        }

        this._lifecycleState = 'active';
        this.isActive = true;

        this.callHook('started');
        this.callHook('onMounted'); // legacy alias
    }

    // ─── Pause / Resume (PageCache lifecycle) ───────────────────
    // State machine: created → active ⇄ paused → destroyed
    // Thiết kế: ROUTE_RENDER_FLOW.md §7. pause/resume là API công khai;
    // stop()/start() là chi tiết nội bộ + đường mount ban đầu.

    private _lifecycleState: 'created' | 'active' | 'paused' | 'destroyed' = 'created';
    /** Data nhận được trong lúc paused (async fetch về muộn) — apply khi resume */
    private _bufferedData: Record<string, any> | null = null;
    /** Only children paused by this controller may be resumed by it. */
    private _pausedChildren: ViewControllerInterface[] = [];

    get lifecycleState(): string {
        return this._lifecycleState;
    }

    /**
     * Pause — tạm dừng để vào PageCache:
     *   1. Flush nốt RAF pending (không mất update đang chờ)
     *   2. State listeners → dirty-mode (KHÔNG unsubscribe — ghi sổ key đổi)
     *   3. Hook onPause cho user dọn tài nguyên thô
     * DOM event listeners giữ nguyên — DOM sẽ bị detach nên vô hại.
     */
    pause(): void {
        if (this._lifecycleState !== 'active') {
            if (this._lifecycleState === 'paused') return;
            console.warn(`[ViewController] pause() bị bỏ qua: "${this.path}" đang ở trạng thái "${this._lifecycleState}".`);
            return;
        }

        this.callHook('pausing');

        // 1. Flush nốt mọi update đang chờ → DOM là snapshot nhất quán
        this.states.__.flushNow();
        this.flushReactiveUpdatesNow();

        // Parent pauses before descendants; descendants finish before parent.
        // Snapshot prevents resuming children that were already inactive on entry.
        this._pausedChildren = this.children.filter((child) => child.lifecycleState === 'active');
        for (let i = this._pausedChildren.length - 1; i >= 0; i--) {
            this._pausedChildren[i].pause();
        }

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
    resume(): void {
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

        // Resume outside-in: parent state is live before child subscriptions flush.
        const pausedChildren = this._pausedChildren;
        this._pausedChildren = [];
        for (const child of pausedChildren) {
            if (child.lifecycleState === 'paused') child.resume();
        }

        // 4. Hook
        this.callHook('resumed');
        this.callHook('onResume'); // legacy alias
    }

    /** Flush đồng bộ các reactive update đang chờ RAF */
    flushReactiveUpdatesNow(): void {
        if (this.hasScheduledUpdate || this.pendingReactiveUpdates.size > 0) {
            this.flushReactiveUpdates();
            this.hasScheduledUpdate = false;
        }
    }

    /**
     * Stop — deactivate reactive subscriptions (for caching/deactivation).
     * DOM stays intact but reactive updates are paused.
     */
    stop(): void {
        if (!this._isStarted) return;

        this.callHook('stopping');
        this._isStarted = false;

        // Recursively stop all children
        if (this._rootTree && 'stop' in this._rootTree && typeof this._rootTree.stop === 'function') {
            this._rootTree.stop();
        }

        this.isActive = false;

        this.callHook('stopped');
        this.callHook('onDeactivated'); // legacy alias
    }

    /** Full destroy — cleanup everything */
    destroy(): void {
        if (this._isDestroyed) return;

        this.callHook('destroying');

        // stop() must run while the instance is still valid so user cleanup hooks
        // and the element tree are not skipped.
        this.stop();

        // Gỡ style/script nếu instance còn đang giữ ref (chưa qua pause)
        this.releaseAssets();

        this._isDestroyed = true;
        this._lifecycleState = 'destroyed';

        // Cancel pending updates
        this.pendingReactiveUpdates.clear();
        this.hasScheduledUpdate = false;

        // Abort all event listeners
        this.eventAbortController.abort();
        this.elementEventHandlers.clear();

        // Sắp gỡ DOM khỏi real DOM
        const wasMounted = this._isMounted;
        if (wasMounted) this.callHook('unmounting');

        // Destroy root tree
        if (this._rootTree && 'destroy' in this._rootTree && typeof this._rootTree.destroy === 'function') {
            this._rootTree.destroy();
        }
        this._rootTree = null;
        this._isMounted = false;

        // A child controller can exist outside _rootTree (for layout/block paths).
        // Destroy remaining children in reverse ownership order; destroy is idempotent.
        for (let i = this.children.length - 1; i >= 0; i--) {
            this.children[i].destroy();
        }
        this.children = [];
        this._pausedChildren = [];

        if (wasMounted) this.callHook('unmounted');

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

        const parent = this.parent;
        this.parent = null;
        parent?.removeChild(this);

        // Nullify references
        this.rootElement = null;
        this.renderFactory = null;
        this.prerenderFactory = null;
        this._isMounted = false;

        this.callHook('destroyed');
    }

    active(): void {
        this.isActive = true;
    }
    deactive(): void {
        this.isActive = false;
    }

    // ─── Data Lifecycle ─────────────────────────────────────────

    /**
     * `this` context cho các hàm compiled config (updateVariableData dùng
     * this.config.updateVariableItemData và this.data).
     */
    private makeConfigThis(): any {
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
    commitData(): void {
        if (this._isDataCommitted || this._isDestroyed) return;
        const fn = this.runtimeConfig?.commitConstructorData;
        if (typeof fn === 'function') {
            try {
                fn.call(this.makeConfigThis());
            } catch (e) {
                console.error(`[ViewController] commitData error in "${this.path}":`, e);
            }
        }
        // Lock ENFORCE ở runtime — không phụ thuộc compiler emit lockUpdateRealState()
        // cuối commitConstructorData (view không có state → compiled fn rỗng, không lock).
        // Từ đây update$xxx chỉ chạy được trong cửa sổ unlock của updateData.
        this.states.__.lockUpdateRealState();
        this._isDataCommitted = true;
    }

    /**
     * Update data from external source (navigate same view, props từ parent...).
     *
     * Contract data vs state (mô hình React — data:props từ ngoài, state:của instance):
     *   - TRƯỚC commitData (constructor phase): chỉ merge vào this.data. Factory
     *     đã destructure __data__ lúc khởi tạo; state sẽ do commitData() init MỘT
     *     lần. KHÔNG chạy updateVariableData ở đây — nếu chạy, sequence
     *     unlock→lock của nó làm commitConstructorData về sau thành no-op
     *     (update$xxx bị lock chặn) → state init phụ thuộc data rỗng hay không.
     *   - SAU commitData: đường props-update chuẩn — unlock → updateVariableData
     *     (trait cập nhật biến data + notify các key dẫn xuất từ data) → lock.
     *     Instance state (init bằng literal) KHÔNG được reset ở đây — đó là
     *     trách nhiệm của compiled updateVariableData (COMPILER_CONTRACT).
     * Khi paused: buffer lại, apply lúc resume (ROUTE_RENDER_FLOW §8.2).
     */
    updateData(newData: Record<string, any>): void {
        if (this._isDestroyed) return;
        if (this._lifecycleState === 'paused') {
            this._bufferedData = { ...(this._bufferedData ?? {}), ...newData };
            return;
        }
        this.data = { ...this.data, ...newData };
        if (!this._isDataCommitted) {
            // Constructor phase (data mount / async data về TRƯỚC commit):
            // áp data vào biến data qua TRAIT-ONLY (updateVariableItemData từng key)
            // — closure vars nhận giá trị mới để commitData init state từ đó.
            // KHÔNG chạy updateVariableData (tránh re-init state) và KHÔNG
            // đụng lock (commitData cần cửa unlock của constructor phase).
            this.applyDataTrait(newData);
            return;
        }
        const fn = this.runtimeConfig?.updateVariableData;
        if (typeof fn === 'function') {
            this.states.__.unlockUpdateRealState();
            try {
                fn.call(this.makeConfigThis(), newData);
            } catch (e) {
                console.error(`[ViewController] updateData error in "${this.path}":`, e);
            } finally {
                this.states.__.lockUpdateRealState();
            }
        }
    }

    /** Áp data vào biến data (trait) từng key — không đụng state, không đụng lock */
    private applyDataTrait(newData: Record<string, any>): void {
        const itemFn = this.runtimeConfig?.updateVariableItemData;
        if (typeof itemFn !== 'function') return;
        for (const key of Object.keys(newData)) {
            try {
                itemFn.call(this.makeConfigThis(), key, newData[key]);
            } catch (e) {
                console.error(`[ViewController] applyDataTrait error in "${this.path}" (key: ${key}):`, e);
            }
        }
    }

    /**
     * Update single data item — cùng contract với updateData (xem trên).
     */
    updateDataItem(key: string, value: any): void {
        this.data[key] = value;
        if (!this._isDataCommitted) {
            // Constructor phase: trait-only, không đụng lock (như updateData)
            this.applyDataTrait({ [key]: value });
            return;
        }
        const fn = this.runtimeConfig?.updateVariableItemData;
        if (typeof fn === 'function') {
            this.states.__.unlockUpdateRealState();
            try {
                fn.call(this.makeConfigThis(), key, value);
            } catch (e) {
                console.error(`[ViewController] updateDataItem error in "${this.path}":`, e);
            } finally {
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
    addEventListener(element: HTMLElement, event: string, handlers: SaoElementEventHandler): void {
        // Compiled Html supplies the complete handler list for one event. Replacing
        // the previous set makes render/hydrate initialization idempotent.
        this.removeEventListener(element, event);
        const registered: EventListener[] = [];
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
            registered.push(fn);
        }

        if (registered.length > 0) {
            let events = this.elementEventHandlers.get(element);
            if (!events) {
                events = new Map();
                this.elementEventHandlers.set(element, events);
            }
            events.set(event, registered);
        }
    }

    removeEventListener(element: HTMLElement, event: string): void {
        const events = this.elementEventHandlers.get(element);
        const listeners = events?.get(event) ?? [];
        for (const listener of listeners) {
            element.removeEventListener(event, listener);
        }
        events?.delete(event);
        if (events?.size === 0) this.elementEventHandlers.delete(element);
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
        if (existing instanceof BlockOutlet && !(existing as any).__destroyed__) {
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
        const which: 'render' | 'prerender' = this.callingMethod === 'prerender' ? 'prerender' : 'render';
        const key: 'preloadElement' | 'mainElement' = which === 'prerender' ? 'preloadElement' : 'mainElement';
        let wrapper = this.wrapperInstances[which];
        if (!wrapper || (wrapper as any).__destroyed__) {
            wrapper = new Wrapper({ ctx: this, initMode: this.initMode, parentElement: this.parentElement, childrenFactory: factory });
            this.wrapperInstances[which] = wrapper;
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

    html(id: string | null = null, tagName: string, parentElement: HtmlInterface | null, config: any, childrenFactory?: SaoChildrenFactory): SaoNodeInterface {
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


    reactive(id: string | null, type: string, parentReactive: ReactiveInterface | null, parentElement: HtmlInterface | null, stateKeys: string[], childrenFactory: ReactiveChildrenFactory): ReactiveInterface {
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
        const reactive: ReactiveInterface = new Reactive({
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

    output(id: string | null, parent: HtmlInterface | null, isEscapeHTML: boolean = true, stateKeys: string[] = [], contentFactory: () => string = () => ''): OutputInterface {
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
    text(text: string): TextInterface {
        return new TextElement({ ctx: this, stateKeys: [], generateText: () => text });
    }

    /**
     * Registry guard: element đã destroy không được reuse — trả về corpse
     * (events đã abort, markers đã gỡ) gây render rỗng / stale closure.
     * Xem docs/RUNTIME_CONTRACT.md §2.
     */
    private aliveFromRegistry<T>(id: string, ctor: abstract new (...args: any[]) => T): T | null {
        if (this._foreachSkipRegistry) return null;
        const existing = this.elements.get(id);
        if (existing instanceof ctor && !(existing as any).__destroyed__) {
            return existing as T;
        }
        return null;
    }

    /** Deterministic fallback counter for the (contract-violating) missing-id path. */
    private _missingIncludeIdCounter = 0;

    /**
     * Resolve the hydrate id for an @include component.
     *
     * The compiler ALWAYS emits a deterministic id (md5[:8] of the position-based
     * base id) so the client marker `s:c:{viewId}-{id}` matches the server-rendered
     * one. A missing id therefore means a compiler/runtime contract violation — and
     * in HYDRATE mode it guarantees a marker mismatch (claimSSRMarkers finds nothing
     * → silent CSR re-render / duplicated DOM).
     *
     * Never invent a RANDOM id here: a random id also makes every `elements.get(id)`
     * lookup miss, so the component is recreated on each render (cache broken). We
     * surface the violation loudly and fall back to a render-stable deterministic id
     * so behaviour stays idempotent even in the broken case.
     */
    private resolveIncludeId(id: string | null, kind: string, path: string): string {
        if (id) return id;
        console.error(
            `[Saola] ${kind}(): missing hydrate id for view "${path}". The compiler must ` +
            `pass a deterministic id — marker sync with the server is broken for this component.`
        );
        return `cpn-missing-${this._missingIncludeIdCounter++}`;
    }

    include(
        id: string | null = null,
        path: string = '',
        parentElement: HtmlInterface | null,
        stateKeys: string[],
        dataFactory: (parentElement: HtmlInterface | null) => Record<string, any>
    ): Component {
        id = this.resolveIncludeId(id, 'include', path);
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
            id,
            stateKeys,
            parent: parentElement,
            dataFactory,
            path,
            type: 'default',
            initMode: this.initMode,
        });
        this.elements.set(id, component);

        return component;
    }

    includeIf(id: string | null = null, path: string, parentElement: HtmlInterface | null, stateKeys: string[], dataFactory: (parentElement: HtmlInterface | null) => Record<string, any>): Component {
        id = this.resolveIncludeId(id, 'includeIf', path);
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
            id,
            stateKeys,
            parent: parentElement,
            dataFactory,
            path,
            type: 'if',
            initMode: this.initMode,
        });
        this.elements.set(id, component);
        return component;
    }

    includeWhen(id: string | null, condition: { stateKeys: string[], checker: () => any }, path: string, parentElement: HtmlInterface | null, stateKeys: string[], dataFactory: (parentElement: HtmlInterface | null) => Record<string, any>): Component {
        id = this.resolveIncludeId(id, 'includeWhen', path);
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
            id,
            stateKeys,
            parent: parentElement,
            dataFactory,
            path,
            type: 'when',
            condition,
            initMode: this.initMode,
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
     * # Cache-aware re-render (Phase 5 + 5b)
     * Khi `_currentForeachCache` được set (bởi Reactive), __foreach claim slot
     * cho từng item:
     *   - Hit (key khớp + item ref giống) → reuse elements cũ (không recreate DOM)
     *   - Miss → gọi callback → tạo elements mới → store vào cache
     *
     * Cache key:
     *   - `keyFn` (compiler emit từ @key(expr)) → field keying (`item.id`)
     *   - không có → object reference của item (identity keying)
     * Duplicate keys/primitive items phân biệt bằng occurrence (ForeachSlotCache).
     * Ref đổi nhưng key trùng → recreate (closure đóng gói item cũ) — slot cũ
     * được Reactive.prunePass destroy.
     *
     * @example Compiled output (@key(item.id)):
     * ctrl.__foreach(items, (item, key, index, loop) => [
     *     this.html(`id-${item.id}`, 'div', p, {}, () => [this.text(item.name)])
     * ], (item) => item.id)
     */
    /**
     * @children — render slot content từ parent include (compiler emit:
     * `...this.__children(__ONE_CHILDREN_CONTENT__, parentElement)`).
     *
     * content có 2 dạng (xem COMPILER _gen_children_slot):
     *   - function `(parentElement) => elements` — element factory từ
     *     @importInclude/custom tag phía parent. Factory đóng gói `this` của
     *     PARENT ctrl → elements thuộc parent scope (state/registry parent),
     *     giống React children.
     *   - string — SSR data hoặc default '' → render text tĩnh (rỗng → []).
     */
    __children(content: any, parentElement: HtmlInterface | null): any[] {
        if (typeof content === 'function') {
            const out = content(parentElement);
            if (out === null || out === undefined) return [];
            return Array.isArray(out) ? out : [out];
        }
        if (content === null || content === undefined || content === '') return [];
        return [this.text(String(content))];
    }

    __foreach<T>(
        list: T[] | Record<string, T>,
        callback: (item: T, key: string, index: number, loop: LoopContext) => any,
        keyFn?: (item: T, index: number) => any
    ): any[] {
        if (!list || typeof list !== 'object') return [];

        // Lấy cache đang active (null = không có cache, dùng behavior cũ)
        const cache = this._currentForeachCache;

        const result: any[] = [];
        try {
            if (Array.isArray(list)) {
                const loopCtx = this.__setLoopContext(list.length);
                loopCtx.setType('increment');

                list.forEach((item, index) => {
                    loopCtx.setCurrentTimes(index);

                    // ── Cache-aware path ──────────────────────────────────────
                    let claimOcc = 0;
                    let cacheKey: any = item;
                    if (cache) {
                        cacheKey = keyFn ? keyFn(item, index) : item;
                        const { slot, occ } = cache.claim(cacheKey, item);
                        claimOcc = occ;
                        if (slot) {
                            // HIT: reuse elements cũ — closure vẫn trỏ đúng object ref.
                            result.push(...slot.elements);
                            return; // skip callback
                        }
                    }

                    // ── Cache MISS hoặc không dùng cache ─────────────────────
                    if (cache) this._foreachSkipRegistry = true;
                    const output = callback(item, String(index), index, loopCtx);
                    if (cache) this._foreachSkipRegistry = false;
                    if (output !== undefined && output !== null) {
                        const elements = Array.isArray(output) ? output : [output];
                        result.push(...elements);

                        if (cache) {
                            cache.store(cacheKey, claimOcc, item, elements);
                        }
                    }
                });
            } else {
                // Object iteration — cache không áp dụng (keys thay vì refs)
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
    __showBinding(_stateKeys: string[], condition: any): string {
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
    __styleBinding(_stateKeys: string[], styles: [string, any][]): string {
        if (!Array.isArray(styles)) return '';
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
    __classBinding(configs: Array<{
        type: 'static' | 'binding';
        value: string;
        states?: string[];
        checker?: () => any;
    }>): string {
        if (!Array.isArray(configs)) return '';
        const classes: string[] = [];
        for (const config of configs) {
            if (!config?.value) continue;
            if (config.type === 'static') {
                classes.push(config.value);
            } else if (config.type === 'binding') {
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
    setParent(parent: ViewControllerInterface | null): void {
        this.parent = parent;
    }
    addChild(child: ViewControllerInterface): void {
        if (!this.children.includes(child)) this.children.push(child);
    }
    removeChild(child: ViewControllerInterface): void {
        const index = this.children.indexOf(child);
        if (index >= 0) this.children.splice(index, 1);
        if (child.parent === this) child.setParent(null);
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
