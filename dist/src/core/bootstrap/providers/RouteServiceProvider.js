import { Router } from "../../routers";
import { PROVIDER_NAMES } from "./provider-order";
import { ServiceProvider } from "./ServiceProvider";
export class RouteServiceProvider extends ServiceProvider {
    constructor() {
        super(...arguments);
        this.name = PROVIDER_NAMES.ROUTER;
        this.dependsOn = [PROVIDER_NAMES.VIEW];
    }
    register() {
        this.app.set("Router", new Router(this.app), true);
    }
    boot() {
        this.app.get("Router").init(RouteServiceProvider.config);
    }
}
RouteServiceProvider.config = {};
//# sourceMappingURL=RouteServiceProvider.js.map