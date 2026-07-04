import { ServiceProvider } from "./ServiceProvider";
export declare class RouteServiceProvider extends ServiceProvider {
    readonly name: "router";
    /** ROUTER phải boot SAU VIEW để ViewManager đã sẵn sàng */
    readonly dependsOn: "view"[];
    static config: Record<string, any>;
    register(): void;
    boot(): void;
}
//# sourceMappingURL=RouteServiceProvider.d.ts.map