import { HelperService } from "../../services/HelperService.js";
import { PROVIDER_NAMES } from "./provider-order.js";
import { ServiceProvider } from "./ServiceProvider.js";

export class HelperServiceProvider extends ServiceProvider {
    readonly name = PROVIDER_NAMES.HELPER;
    readonly dependsOn = [PROVIDER_NAMES.CORE, PROVIDER_NAMES.ROUTER, PROVIDER_NAMES.VIEW];

    register(): void {
        this.app.set<HelperService>("Helper", new HelperService(this.app), true);
    }
}
