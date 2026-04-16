import { Router } from "../../routers";
import { PROVIDER_NAMES } from "./provider-order";
import { ServiceProvider } from "./ServiceProvider";

export class RouteServiceProvider extends ServiceProvider {
    readonly name = PROVIDER_NAMES.ROUTER;
    readonly dependsOn = [PROVIDER_NAMES.VIEW];
    static config: Record<string, any> = {};

    register(): void {
        this.app.set<Router>("Router", new Router(this.app), true);
    }

    boot(): void {
        this.app.get<Router>("Router").init(RouteServiceProvider.config);
    }
}
