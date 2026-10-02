import { ApiClient } from "../../helpers/ApiClient.js";
import { PROVIDER_NAMES } from "./provider-order.js";
import { ServiceProvider } from "./ServiceProvider.js";
export class ApiServiceProvider extends ServiceProvider {
    constructor() {
        super(...arguments);
        this.name = PROVIDER_NAMES.API;
        this.dependsOn = [PROVIDER_NAMES.CORE];
    }
    register() {
        this.app.set("API", new ApiClient(), true);
    }
    boot() {
        this.app.get("API").init(ApiServiceProvider.config);
    }
}
ApiServiceProvider.config = {};
//# sourceMappingURL=ApiServiceProvider.js.map