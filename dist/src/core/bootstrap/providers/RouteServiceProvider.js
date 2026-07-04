import { Router } from "../../routers";
import { PROVIDER_NAMES } from "./provider-order";
import { ServiceProvider } from "./ServiceProvider";
export class RouteServiceProvider extends ServiceProvider {
    constructor() {
        super(...arguments);
        this.name = PROVIDER_NAMES.ROUTER;
        /** ROUTER phải boot SAU VIEW để ViewManager đã sẵn sàng */
        this.dependsOn = [PROVIDER_NAMES.VIEW];
    }
    register() {
        this.app.set("Router", new Router(this.app), true);
    }
    boot() {
        const router = this.app.get("Router");
        // Wire ViewManager → Router (Router cần để mountView khi navigate)
        try {
            const vm = this.app.get("View");
            if (vm)
                router.setViewManager(vm);
        }
        catch (_) { /* View chưa register — Router sẽ fallback qua App.View */ }
        // init: load routes config + auto-wire
        router.init(RouteServiceProvider.config);
    }
}
RouteServiceProvider.config = {};
//# sourceMappingURL=RouteServiceProvider.js.map