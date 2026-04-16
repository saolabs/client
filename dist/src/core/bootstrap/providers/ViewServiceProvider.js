import { ViewManager } from "../../view";
import { PROVIDER_NAMES } from "./provider-order";
import { ServiceProvider } from "./ServiceProvider";
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