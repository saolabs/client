import type { OneObjectType } from "../types/utils";
import type { ViewInterface, ViewRenderFactory } from "./ViewInterface";
import type { ViewStateInterface } from "./ViewStateInterface";
import type { HtmlInterface, FragmentInterface, OneElementEventHandler, OneChildrenFactory, WrapperInterface } from "./ElementInterface";
import type { ReactiveInterface } from "./ReactiveInterface";
import type { BlockInterface } from "./BlockInterface";
import type { LoopContextInterface } from "./LoopContextInterface";
import { SectionInterface } from "./views";
export type ViewType = 'view' | 'layout' | 'component' | 'template';
export interface ViewControllerInterface {
    oneType: OneObjectType;
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
    /** Path to super view (layout) */
    superViewPath: string | null;
    /** Main element (Wrapper) for this view */
    mainElement: any;
    sections: Map<string, SectionInterface>;
    blocks: Map<string, BlockInterface>;
    urlPath: string | null;
    childrenFactory: OneChildrenFactory | null;
    wrapper: (factory: OneChildrenFactory) => WrapperInterface;
    addEventListener(element: HTMLElement, event: string, handlers: OneElementEventHandler): void;
    /** Called by reactive system to schedule an update */
    scheduleUpdate(reactive: ReactiveInterface): void;
    /** Lifecycle */
    setup(config: Record<string, any>): void;
    /** Commit initial data — set initial state values after render */
    commitData(): void;
    /** Update data from external source */
    updateData(data: Record<string, any>): void;
    /** Update single data item */
    updateDataItem(key: string, value: any): void;
    /** Start reactive subscriptions */
    start(): void;
    /** Stop reactive subscriptions (for caching) */
    stop(): void;
    /** Loop directives */
    __foreach<T>(list: T[] | Record<string, T>, callback: (item: T, key: string, index: number, loop: any) => any): any[];
    __for(loopType?: string, start?: number, end?: number, execute?: (loop: any) => any): any;
    __while(execute: (loop: any) => any, maxIterations?: number): any;
    /** App reference */
    App: any;
    setApp(app: any): void;
    setUserDefinedConfig(config: Record<string, any>): void;
    /** Set root element — the container this view renders into */
    setRootElement(rootElement: HtmlInterface): void;
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
};
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
};
export type ViewControllerConfig = ViewConfig & ViewRuntimeConfig;
//# sourceMappingURL=ViewControllerInterface.d.ts.map