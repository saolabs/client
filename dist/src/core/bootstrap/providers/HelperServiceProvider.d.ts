import { ServiceProvider } from "./ServiceProvider";
export declare class HelperServiceProvider extends ServiceProvider {
    readonly name: "helper";
    readonly dependsOn: ("view" | "core" | "router")[];
    register(): void;
}
//# sourceMappingURL=HelperServiceProvider.d.ts.map