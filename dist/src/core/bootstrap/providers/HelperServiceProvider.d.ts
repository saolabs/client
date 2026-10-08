import { ServiceProvider } from "./ServiceProvider.js";
export declare class HelperServiceProvider extends ServiceProvider {
    readonly name: "helper";
    readonly dependsOn: ("view" | "core" | "router")[];
    static config: Record<string, any>;
    register(): void;
    boot(): void;
}
//# sourceMappingURL=HelperServiceProvider.d.ts.map