import { ViewManager } from "../../view/index.js";
import { PROVIDER_NAMES } from "./provider-order.js";
import { ServiceProvider } from "./ServiceProvider.js";

export class ViewServiceProvider extends ServiceProvider {
    readonly name = PROVIDER_NAMES.VIEW;
    readonly dependsOn = [PROVIDER_NAMES.CORE];
    static config: Record<string, any> = {};

    register(): void {
        this.app.set<ViewManager>("View", new ViewManager(this.app), true);
    }

    boot(): void {
        this.app.get<ViewManager>("View").init(ViewServiceProvider.config);
    }
}
