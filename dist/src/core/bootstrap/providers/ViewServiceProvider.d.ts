import { ServiceProvider } from "./ServiceProvider.js";
export declare class ViewServiceProvider extends ServiceProvider {
    readonly name: "view";
    readonly dependsOn: "core"[];
    static config: Record<string, any>;
    register(): void;
    boot(): void;
}
//# sourceMappingURL=ViewServiceProvider.d.ts.map