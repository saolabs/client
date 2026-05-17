// ─── Barrel Re-exports ───────────────────────────────────────────
// All interfaces and related types re-exported for backward compatibility

export type { LoopContextInterface } from "./LoopContextInterface";
export type { ViewStateInterface, StateManagerInterface, StateListener, MultiKeyStateListener, StateItem } from "./ViewStateInterface";
export type { SaoNodeInterface, HtmlInterface, TextInterface, OutputInterface, FragmentInterface, SaoElementConfig, HtmlElementConfig, SaoElementEventHandler, SaoElementChildren, SaoChildrenFactoryOutput, SaoChildrenFactory } from "./ElementInterface";
export type { ReactiveInterface, ReactiveRenderFn, ReactiveChildrenFactory, ReactiveConfig } from "./ReactiveInterface";
export type { BlockInterface, BlockOutletInterface, BlockManagerInterface, BlockRenderFactory } from "./BlockInterface";
export type { ViewControllerInterface, ViewType, ViewConfig, ViewRuntimeConfig } from "./ViewControllerInterface";
export type { ViewInterface, ViewRenderFactory, ViewConstructor, ViewLifecycleHooks } from "./ViewInterface";
export type { ComponentInterface } from "./ComponentInterface";
export type { ApplicationInterface, AppFactory, ServiceKey, ServiceFactory, ServiceBinding } from "./ApplicationInterface";
export type { ServiceProviderInterface } from "./ServiceProviderInterface";
export type { ViewCacheInterface } from "./ViewCacheInterface";
export type { ViewManagerInterface, ActiveViewInfo } from "./ViewManagerInterface";
export type { RouterInterface } from "./RouterInterface";
export type { HelperInterface, CollectionProxyInterface } from "./HelperInterface";
export type { EventServiceInterface, EventCallback } from "./EventServiceInterface";
export type { HttpServiceInterface, HttpRequestConfig, HttpResponse, HttpInterceptor } from "./HttpServiceInterface";
export type { StoreServiceInterface } from "./StoreServiceInterface";
export type { StorageServiceInterface, StorageEventCallback } from "./StorageServiceInterface";
export type { LoggerServiceInterface, LoggerConfig, LogEntry, LogLevel } from "./LoggerServiceInterface";

