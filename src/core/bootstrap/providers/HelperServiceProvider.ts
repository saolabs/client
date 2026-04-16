import { HelperService } from "../../services/HelperService";
import { PROVIDER_NAMES } from "./provider-order";
import { ServiceProvider } from "./ServiceProvider";

export class HelperServiceProvider extends ServiceProvider {
    readonly name = PROVIDER_NAMES.HELPER;
    readonly dependsOn = [PROVIDER_NAMES.CORE, PROVIDER_NAMES.ROUTER, PROVIDER_NAMES.VIEW];

    register(): void {
        this.app.set<HelperService>("Helper", new HelperService(this.app), true);
    }
}
