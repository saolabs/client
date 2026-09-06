import { ServiceProvider } from "./ServiceProvider.js";
export declare class HelperServiceProvider extends ServiceProvider {
    readonly name: "helper";
    readonly dependsOn: ("core" | "view" | "router")[];
    register(): void;
}
//# sourceMappingURL=HelperServiceProvider.d.ts.map