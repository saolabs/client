import type { BlockInterface, BlockOutletInterface, BlockRenderFactory } from "../contracts/BlockInterface";
import type { FragmentInterface, HtmlInterface, SaoChildrenFactory, SaoChildrenFactoryOutput, SaoChildrenSlotContent, SaoElementEventHandler, SaoNodeInterface, OutputInterface, TextInterface, WrapperInterface, YieldInterface } from "../contracts/ElementInterface";
import type { ReactiveChildrenFactory, ReactiveInterface } from "../contracts/ReactiveInterface";
import type { ViewControllerInterface, ViewType, ViewConfig, ViewRuntimeConfig, ViewControllerConfig } from "../contracts/ViewControllerInterface";
import type { ViewInterface, ViewRenderFactory } from "../contracts/ViewInterface";
import type { SaoObjectType } from "../types/utils";
import { ViewState } from "./ViewState";
import { LoopContext } from "./LoopContext";
import { Component } from "../elements/Component";
import { ApplicationInterface } from "../contracts/ApplicationInterface";
import { SectionContentRenderer, SectionContentType, SectionInterface, SectionItemType } from "../contracts/SectionInterface";
import { InitMode } from "../contracts/common";
import { ComponentInterface } from "../contracts/ComponentInterface";
import { ForeachSlotCache } from "../elements/ForeachSlotCache";
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
export declare class ViewController implements ViewControllerInterface {
    saoType: SaoObjectType;
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
    childrenFactory: SaoChildrenFactory | null;
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
    /** Exact listener references for cleanup when an individual Html node dies. */
    elementEventHandlers: Map<HTMLElement, Map<string, EventListener[]>>;
    /** Current loop context stack (@foreach, @for, @while) */
    loopContext: LoopContext | null;
    /**
     * Active ForeachSlotCache — được set bởi Reactive.renderForeach() trước khi
     * gọi childrenFactory. __foreach() đọc cache này để quyết định reuse hay create.
     * Reset về null ngay sau khi childrenFactory trả về.
     */
    _currentForeachCache: ForeachSlotCache | null;
    _foreachSkipRegistry: boolean;
    /** Section management across views */
    sections: Map<string, SectionInterface>;
    /** Block slots in layout views */
    blocks: Map<string, BlockInterface>;
    elements: Map<string, ElementChild>;
    preloadElement: WrapperInterface | null;
    mainElement: WrapperInterface | null;
    /** Wrapper instance RIÊNG cho render/prerender — dùng chung sẽ làm
     *  preloadElement === mainElement → swap skeleton→main destroy nhầm chính nó */
    private wrapperInstances;
    /** Whether this view is currently active (mounted in DOM) */
    isActive: boolean;
    /** Whether initial data has been committed */
    private _isDataCommitted;
    /** Whether the view has been mounted */
    private _isMounted;
    /** Whether the reactive element tree has been started. */
    private _isStarted;
    /** Whether the view has been fully destroyed */
    private _isDestroyed;
    /** Whether this instance's styles/scripts are currently counted in AssetManager
     *  (true = đang góp 1 ref vào real DOM). Giữ acquire/release cân bằng. */
    private _assetsLive;
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
    /** Gọi an toàn một lifecycle hook nếu user có định nghĩa trên View. */
    private callHook;
    /**
     * Mount — instance vào real DOM.
     *   - root != null: gắn DOM tree (mainElement/preloadElement) vào root.
     *   - root == null: nội dung đã được đặt sẵn (block outlets / component markers),
     *     chỉ fire hook + acquire asset.
     * Fire mounting/mounted MỘT lần mỗi vòng đời; pause→resume dùng resuming/resumed.
     */
    mount(root?: HtmlInterface | null): void;
    /** Unmount — gỡ instance khỏi real DOM (fire hook + release asset). */
    unmount(): void;
    /** Đăng ký style/script của component vào real DOM (insert khi ref 0→1). */
    private acquireAssets;
    /** Gỡ đăng ký style/script (remove khi ref 1→0). */
    private releaseAssets;
    /** Các Element gốc của instance (giữa markers của Wrapper) — để tag scoped style. */
    private getSubtreeRoots;
    /**
     * Start — activate reactive subscriptions throughout the element tree.
     * Called AFTER render() and commitData().
     *
     * Flow: render() → commitData() → start()
     * This ensures initial state values are set before subscriptions fire.
     */
    start(): void;
    private _lifecycleState;
    /** Data nhận được trong lúc paused (async fetch về muộn) — apply khi resume */
    private _bufferedData;
    /** Only children paused by this controller may be resumed by it. */
    private _pausedChildren;
    get lifecycleState(): string;
    /**
     * Pause — tạm dừng để vào PageCache:
     *   1. Flush nốt RAF pending (không mất update đang chờ)
     *   2. State listeners → dirty-mode (KHÔNG unsubscribe — ghi sổ key đổi)
     *   3. Hook onPause cho user dọn tài nguyên thô
     * DOM event listeners giữ nguyên — DOM sẽ bị detach nên vô hại.
     */
    pause(): void;
    /**
     * Resume — khôi phục từ PageCache:
     *   1. Apply buffered data (async về trong lúc paused)
     *   2. Thoát dirty-mode → flush đúng các vùng phụ thuộc dirty keys
     *   3. Hook onResume — nơi user quyết định refetch (theo TTL riêng...)
     */
    resume(): void;
    /** Flush đồng bộ các reactive update đang chờ RAF */
    flushReactiveUpdatesNow(): void;
    /**
     * Stop — deactivate reactive subscriptions (for caching/deactivation).
     * DOM stays intact but reactive updates are paused.
     */
    stop(): void;
    /** Full destroy — cleanup everything */
    destroy(): void;
    active(): void;
    deactive(): void;
    /**
     * `this` context cho các hàm compiled config (updateVariableData dùng
     * this.config.updateVariableItemData và this.data).
     */
    private makeConfigThis;
    /**
     * Commit initial data — set initial state values.
     * Called by ViewManager AFTER render + block mounting.
     *
     * Flow: commitConstructorData() → update$xxx(initial) → lockUpdateRealState()
     * FIX(Phase2): trước đây method này RỖNG — compiled commitConstructorData
     * không bao giờ được gọi.
     */
    commitData(): void;
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
    updateData(newData: Record<string, any>): void;
    /** Áp data vào biến data (trait) từng key — không đụng state, không đụng lock */
    private applyDataTrait;
    /**
     * Update single data item — cùng contract với updateData (xem trên).
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
    addEventListener(element: HTMLElement, event: string, handlers: SaoElementEventHandler): void;
    removeEventListener(element: HTMLElement, event: string): void;
    /**
     * Schedule a reactive region for re-render.
     * Multiple calls in the same frame are batched into a single RAF.
     */
    scheduleUpdate(reactive: ReactiveInterface): void;
    private flushReactiveUpdates;
    pushBlockAndSections(): void;
    /**
     *
     * @param name
     * @param config
     * @param contentRenderFactory
     * @returns
     */
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
    useBlock(id: string | null | undefined, name: string, parent: HtmlInterface): BlockOutletInterface;
    yield(id: string, name: string, defaultValue?: any, parentElement?: HtmlInterface | null): YieldInterface;
    yieldContent(name: string, defaultValue?: any): any;
    wrapper(factory: SaoChildrenFactory): WrapperInterface;
    fragment(id: string | null | undefined, parentElement: HtmlInterface | null, childrenFactory: SaoChildrenFactory): FragmentInterface;
    /**
     * Template and Directive Helpers
     * These methods are called by the compiled output for loops, conditionals, and other directives.
     */
    html(id: string | null | undefined, tagName: string, parentElement: HtmlInterface | null, config: any, childrenFactory?: SaoChildrenFactory): SaoNodeInterface;
    reactive(id: string | null, type: string, parentReactive: ReactiveInterface | null, parentElement: HtmlInterface | null, stateKeys: string[], childrenFactory: ReactiveChildrenFactory): ReactiveInterface;
    output(id: string | null, parent: HtmlInterface | null, isEscapeHTML?: boolean, stateKeys?: string[], contentFactory?: () => string): OutputInterface;
    /**
     * FIX(baseline#2): trả về TextElement (có saoType) thay vì raw Text node.
     * Raw Text node bị mountElementList/Reactive.render bỏ qua → text tĩnh biến mất.
     */
    text(text: string): TextInterface;
    /**
     * Registry guard: element đã destroy không được reuse — trả về corpse
     * (events đã abort, markers đã gỡ) gây render rỗng / stale closure.
     * Xem docs/RUNTIME_CONTRACT.md §2.
     */
    private aliveFromRegistry;
    /** Deterministic fallback counter for the (contract-violating) missing-id path. */
    private _missingIncludeIdCounter;
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
    private resolveIncludeId;
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
     * @children / {{ $children }} — materialize slot content from the parent
     * include only when render traversal reaches ChildrenNode (compiler emit:
     * `...this.__children(__ONE_CHILDREN_CONTENT__, parentElement)`).
     *
     * content có 2 dạng (xem COMPILER _gen_children_slot):
     *   - function `(parentElement) => elements` — element factory từ
     *     @importInclude/custom tag phía parent. Factory đóng gói `this` của
     *     PARENT ctrl → elements thuộc parent scope (state/registry parent),
     *     giống React children.
     *   - string — SSR data hoặc default '' → render text tĩnh (rỗng → []).
     */
    __children(content: SaoChildrenSlotContent, parentElement: HtmlInterface | null): SaoChildrenFactoryOutput;
    __foreach<T>(list: T[] | Record<string, T>, callback: (item: T, key: string, index: number, loop: LoopContext) => any, keyFn?: (item: T, index: number) => any): any[];
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
    __showBinding(_stateKeys: string[], condition: any): string;
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
    __styleBinding(_stateKeys: string[], styles: [string, any][]): string;
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
    }>): string;
    setApp(app: ApplicationInterface): void;
    getParentView(): ViewInterface | null;
    getChildrenViews(): ViewInterface[];
    getSuperView(): ViewInterface | null;
    getOriginView(): ViewInterface | null;
    setOriginView(origin: ViewControllerInterface): void;
    setSuperView(superView: ViewControllerInterface): void;
    setIsSuperView(isSuper: boolean): void;
    setParent(parent: ViewControllerInterface | null): void;
    addChild(child: ViewControllerInterface): void;
    removeChild(child: ViewControllerInterface): void;
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