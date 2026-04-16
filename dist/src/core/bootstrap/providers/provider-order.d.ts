import type { ServiceProviderInterface } from "../../contracts/ServiceProviderInterface";
/**
 * Tên các provider mặc định — dùng constant thay vì magic string.
 * Custom providers có thể dùng tên khác hoặc override tên mặc định.
 */
export declare const PROVIDER_NAMES: {
    readonly CORE: "core";
    readonly VIEW: "view";
    readonly ROUTER: "router";
    readonly HELPER: "helper";
    readonly API: "api";
};
export type ProviderName = typeof PROVIDER_NAMES[keyof typeof PROVIDER_NAMES];
export type NamedServiceProvider = ServiceProviderInterface & {
    name: string;
    dependsOn?: string[];
};
export declare function resolveProviderOrder(providers: ServiceProviderInterface[]): ServiceProviderInterface[];
//# sourceMappingURL=provider-order.d.ts.map