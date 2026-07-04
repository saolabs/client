import { Router } from "../../routers";
import { ViewManager } from "../../view";
import { PROVIDER_NAMES } from "./provider-order";
import { ServiceProvider } from "./ServiceProvider";

export class RouteServiceProvider extends ServiceProvider {
    readonly name = PROVIDER_NAMES.ROUTER;
    /** ROUTER phải boot SAU VIEW để ViewManager đã sẵn sàng */
    readonly dependsOn = [PROVIDER_NAMES.VIEW];
    static config: Record<string, any> = {};

    register(): void {
        this.app.set<Router>("Router", new Router(this.app), true);
    }

    boot(): void {
        const router = this.app.get<Router>("Router");

        // Wire ViewManager → Router (Router cần để mountView khi navigate)
        try {
            const vm = this.app.get<ViewManager>("View");
            if (vm) router.setViewManager(vm);
        } catch (_) { /* View chưa register — Router sẽ fallback qua App.View */ }

        // init: load routes config + auto-wire
        router.init(RouteServiceProvider.config);
    }
}
