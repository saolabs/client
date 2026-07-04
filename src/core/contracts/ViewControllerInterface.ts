import type { SaoObjectType } from "../types/utils";
import type { ViewInterface, ViewRenderFactory } from "./ViewInterface";
import type { ViewStateInterface } from "./ViewStateInterface";
import type { HtmlInterface, FragmentInterface, SaoElementEventHandler, SaoElementChildren, SaoChildrenFactory, WrapperInterface } from "./ElementInterface";
import type { ReactiveInterface } from "./ReactiveInterface";
import type { BlockInterface } from "./BlockInterface";
import type { LoopContextInterface } from "./LoopContextInterface";
import { SectionInterface } from "../contracts/SectionInterface";
import type { ForeachSlotCache } from "../elements/ForeachSlotCache";
import type { InitMode } from "./common";

// ─── ViewController Interface ────────────────────────────────────

export type ViewType = 'view' | 'layout' | 'component' | 'template';

export interface ViewControllerInterface {
    saoType: SaoObjectType;
    view: ViewInterface;
    viewId: string;
    path: string;
    viewType: ViewType;
    states: ViewStateInterface;
    loopContext: LoopContextInterface | null;
    /** Raw input data reference */
    data: Record<string, any>;
    /** Whether this view defines a super view (layout) */
    hasSuperView: boolean;

    /**
     * Active ForeachSlotCache — set bởi Reactive.renderForeach() trước khi gọi factory.
     * __foreach() dùng để quyết định reuse hay create elements.
     * null = không có cache active (render bình thường).
     */
    _currentForeachCache: ForeachSlotCache | null;
    /** Path to super view (layout) */
    superViewPath: string | null;

    /** Main element (Wrapper) for this view */
    mainElement: WrapperInterface | null;
    preloadElement: WrapperInterface | null;

    sections: Map<string, SectionInterface>;
    blocks: Map<string, BlockInterface>;
    urlPath: string | null;
    isActive: boolean;
    childrenFactory: SaoChildrenFactory | null;

    wrapper: (factory: SaoChildrenFactory) => WrapperInterface;

    addEventListener(element: HTMLElement, event: string, handlers: SaoElementEventHandler): void;
    /** Called by reactive system to schedule an update */
    scheduleUpdate(reactive: ReactiveInterface): void;
    /** Flush đồng bộ các reactive update đang chờ (sau mount/hydrate). */
    flushReactiveUpdatesNow(): void;
    /**
     * Chế độ khởi tạo của view: 'create' (CSR) hoặc 'hydrate' (SSR).
     * Truyền xuống mọi element con để chúng tạo mới hay claim DOM server.
     */
    initMode: InitMode;
    /** Lifecycle */
    setup(config: Record<string, any>): void;
    /** Commit initial data — set initial state values after render */
    commitData(): void;
    /** Update data from external source */
    updateData(data: Record<string, any>): void;
    /** Update single data item */
    updateDataItem(key: string, value: any): void;
    /** Mount — gắn instance vào real DOM (root!=null) + fire mounting/mounted + acquire asset */
    mount(root?: HtmlInterface | null): void;
    /** Unmount — gỡ instance khỏi real DOM + fire unmounting/unmounted + release asset */
    unmount(): void;
    /** Start reactive subscriptions */
    start(): void;
    /** Stop reactive subscriptions (for caching) */
    stop(): void;
    /** Pause — dirty-mode + buffer async, dùng khi vào PageCache (ROUTE_RENDER_FLOW §7) */
    pause(): void;
    /** Resume — flush dirty keys + apply buffered data, dùng khi restore từ PageCache */
    resume(): void;
    /** State machine: created → active ⇄ paused → destroyed */
    readonly lifecycleState: string;
    active(): void;
    deactive(): void;
    pushBlockAndSections(): void;
    /** @children slot — render children content từ parent include */
    __children(content: any, parentElement: any): any[];
    /** Loop directives */
    __foreach<T>(list: T[] | Record<string, T>, callback: (item: T, key: string, index: number, loop: any) => any, keyFn?: (item: T, index: number) => any): any[];
    __for(loopType?: string, start?: number, end?: number, execute?: (loop: any) => any): any;
    __while(execute: (loop: any) => any, maxIterations?: number): any;
    /** App reference */
    App: any;
    setApp(app: any): void;
    setUserDefinedConfig(config: Record<string, any>): void;
    /** Set root element — the container this view renders into */
    setRootElement(rootElement: HtmlInterface): void;
    setParentElement(parentElement: HtmlInterface): void;
    /** Render the view's element tree into rootElement */
    render(): ViewInterface | FragmentInterface | null;

    prerender(): ViewInterface | FragmentInterface | null;

    superView: ViewControllerInterface | null;

    /** Whether this controller IS a layout (super view) */
    isSuperView: boolean;
    /** Mark this controller as a super view (layout) */
    setIsSuperView(isSuper: boolean): void;
    /** Set the parent layout's controller */
    setSuperView(superView: ViewControllerInterface): void;
    /** Nested view tree (@include): parent controller */
    parent: ViewControllerInterface | null;
    /** Nested view tree (@include): child controllers */
    children: ViewControllerInterface[];
    setParent(parent: ViewControllerInterface): void;
    addChild(child: ViewControllerInterface): void;
    /** Track the original page view's controller for block mounting */
    originView: ViewControllerInterface | null;
    /** Set the origin (page) controller reference */
    setOriginView(origin: ViewControllerInterface): void;
    setChainFromOrigin(): void;
    ejectOriginChain(): void;
    destroy(): void;



    /** Get config value with optional default */
    getConfig(key?: string, defaultValue?: any): any;
    getConfig(): ViewControllerConfig;
}

// ─── View Config Types ───────────────────────────────────────────

export type ViewConfig = {
    hasSuperView?: boolean;
    viewType?: 'view' | 'layout' | 'component' | 'template';
    sections?: Record<string, ViewRenderFactory>;
    hasAwaitData?: boolean;
    hasFetchData?: boolean;
    useVars?: boolean;
    hasSections?: boolean;
    hasSectionPreload?: boolean;
    hasPrerender?: boolean;
    renderLongSections?: Record<string, any>;
    renderSections?: Record<string, any>;
    prerenderSections?: Record<string, any>;
    [key: string]: any;
}

export type ViewRuntimeConfig = {
    data?: Record<string, any>;

    fetch?: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: any;
    } | null;

    viewId?: string;
    path?: string;
    superView?: string | null;
    subscribe?: boolean;
    scripts?: any[];
    styles?: any[];
    resources?: any[];
    commitConstructorData?: () => void;
    updateVariableData?: (data: Record<string, any>) => void;
    updateVariableItemData?: (key: string, value: any) => void;
    prerender?: ViewRenderFactory | null;
    render?: ViewRenderFactory | null;
    [key: string]: any;
}
export type ViewControllerConfig = ViewConfig & ViewRuntimeConfig;
