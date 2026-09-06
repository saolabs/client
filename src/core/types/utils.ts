export type SaoObjectType = 'Application' | 'App' | 'ServiceProvider' | 'Html' | 'Reactive' | 'TextElement' | 'Fragment' | 'Wrapper' | 'Block' | 'BlockOutlet' | 'Output' | 'ViewController' | 'View' | 'Service' | 'Router' | 'App' | 'Component' | 'Unknown' | 'Yield' | '' | null; // Extendable for custom types
export enum OOTEnum {
    APPLICATION = 'Application',
    HTML = 'Html',
    REACTIVE = 'Reactive',
    TEXT_ELEMENT = 'TextElement',
    FRAGMENT = 'Fragment',
    WRAPPER = 'Wrapper',
    BLOCK = 'Block',
    BLOCK_OUTLET = 'BlockOutlet',
    OUTPUT = 'Output',
    VIEW_CONTROLLER = 'ViewController',
    VIEW = 'View',
    SERVICE = 'Service',
    ROUTER = 'Router',
    APP = 'App',
    SERVICE_PROVIDER = 'ServiceProvider',
    COMPONENT = 'Component',
    UNKNOWN = 'Unknown',
    YIELD = 'Yield'
}
// ─── Re-exports from contracts (backward compatibility) ─────────

export type { SaoElementConfig, HtmlElementConfig, SaoElementEventHandler, SaoElementChildren, SaoChildrenFactoryOutput, SaoChildrenFactory } from "../contracts/ElementInterface.js";
export type { ReactiveRenderFn, ReactiveChildrenFactory, ReactiveConfig } from "../contracts/ReactiveInterface.js";
export type { BlockRenderFactory } from "../contracts/BlockInterface.js";
export type { ViewRenderFactory, ViewConstructor, ViewLifecycleHooks } from "../contracts/ViewInterface.js";
export type { StateListener, MultiKeyStateListener, StateItem } from "../contracts/ViewStateInterface.js";
export type { ServiceKey, ServiceFactory, ServiceBinding } from "../contracts/ApplicationInterface.js";
export type { ViewConfig, ViewRuntimeConfig } from "../contracts/ViewControllerInterface.js";