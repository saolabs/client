import { HelperService } from "../../services/HelperService.js";
import { PROVIDER_NAMES } from "./provider-order.js";
import { ServiceProvider } from "./ServiceProvider.js";
export class HelperServiceProvider extends ServiceProvider {
    constructor() {
        super(...arguments);
        this.name = PROVIDER_NAMES.HELPER;
        this.dependsOn = [PROVIDER_NAMES.CORE, PROVIDER_NAMES.ROUTER, PROVIDER_NAMES.VIEW];
    }
    register() {
        this.app.set("Helper", new HelperService(this.app), true);
    }
}
//# sourceMappingURL=HelperServiceProvider.js.map