import { RouterInterface, ViewManagerInterface } from "./utils";
import type { HelperInterface } from "./HelperInterface";
import type { EventServiceInterface } from "./EventServiceInterface";
import type { HttpServiceInterface } from "./HttpServiceInterface";
import type { StoreServiceInterface } from "./StoreServiceInterface";
import type { StorageServiceInterface } from "./StorageServiceInterface";
import type { LoggerServiceInterface } from "./LoggerServiceInterface";
import { APIClientInterface } from "./ApiInterface";
import type { ServiceProviderInterface } from "./ServiceProviderInterface";
import { SaoObjectType } from "../types/utils";
export interface ApplicationInterface {
    [key: string]: any;
    transient<T>(key: ServiceKey, value: any): this;
    bind<T>(key: ServiceKey, value: any): this;
    singleton<T>(key: ServiceKey, value?: any): this;
    instance<T>(key: ServiceKey, value: T): this;
    alias(alias: string | symbol, key: ServiceKey): this;
    make<T>(key: ServiceKey, defaultValue?: T): T;
    resolve<T>(key: ServiceKey, defaultValue?: T): T;
    has(key: ServiceKey): boolean;
    bound(key: ServiceKey): boolean;
    register(provider: ServiceProviderInterface): this;
    boot(): void;
    flush(): void;
    destroy(): void;
    set<T = any>(name: string, method: T, isOne?: boolean): void;
    setMethod(name: string, method: Function, isOne?: boolean): void;
    get<T = any>(name: string): T;
    saoType?: SaoObjectType;
    isInitialized: boolean;
    isStarted: boolean;
    View: ViewManagerInterface;
    Router: RouterInterface;
    Helper: HelperInterface;
    Events: EventServiceInterface;
    Http: HttpServiceInterface;
    API: APIClientInterface;
    Store: StoreServiceInterface;
    Storage: StorageServiceInterface;
    Logger: LoggerServiceInterface;
}
/** Type cho helper function app() — callable + có methods */
export interface AppFactory {
    <T>(): T;
    (): ApplicationInterface;
    <T>(key: ServiceKey): T;
    (key: ServiceKey, value: any): ApplicationInterface;
    make<T>(name: ServiceKey): T;
    make<T>(name: ServiceKey, defaultValue: T): T;
    instance<T>(name: ServiceKey, value: T): ApplicationInterface;
    resolve<T>(name: ServiceKey): T;
    resolve<T>(name: ServiceKey, defaultValue: T): T;
    register<T>(name: ServiceKey, factory: () => T): ApplicationInterface;
    bind<T>(name: ServiceKey, factory: () => T): ApplicationInterface;
    singleton<T>(name: ServiceKey, factory: () => T): ApplicationInterface;
    has(name: ServiceKey): boolean;
    flush(): void;
    destroy(): void;
}
/** Định danh duy nhất cho service: string, symbol, hoặc class constructor */
export type ServiceKey<T = any> = string | symbol | (new (...args: any[]) => T);
/** Factory function nhận app (container) để resolve dependencies */
export type ServiceFactory<T> = (app: ApplicationInterface) => T;
/** Giá trị có thể bind: factory function hoặc class constructor */
export type ServiceBinding<T = any> = ServiceFactory<T> | (new (...args: any[]) => T);
//# sourceMappingURL=ApplicationInterface.d.ts.map