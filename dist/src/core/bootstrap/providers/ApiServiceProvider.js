import { ApiClient } from "../../hellpers/ApiClient";
import { PROVIDER_NAMES } from "./provider-order";
import { ServiceProvider } from "./ServiceProvider";
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