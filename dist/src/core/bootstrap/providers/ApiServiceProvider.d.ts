import { ServiceProvider } from "./ServiceProvider.js";
export declare class ApiServiceProvider extends ServiceProvider {
    readonly name: "api";
    readonly dependsOn: "core"[];
    static config: Record<string, any>;
    register(): void;
    boot(): void;
}
//# sourceMappingURL=ApiServiceProvider.d.ts.map