import { ViewManager } from "../../view/index.js";
import { PROVIDER_NAMES } from "./provider-order.js";
import { ServiceProvider } from "./ServiceProvider.js";
export class ViewServiceProvider extends ServiceProvider {
    constructor() {
        super(...arguments);
        this.name = PROVIDER_NAMES.VIEW;
        this.dependsOn = [PROVIDER_NAMES.CORE];
    }
    register() {
        this.app.set("View", new ViewManager(this.app), true);
    }
    boot() {
        this.app.get("View").init(ViewServiceProvider.config);
    }
}
ViewServiceProvider.config = {};
//# sourceMappingURL=ViewServiceProvider.js.map