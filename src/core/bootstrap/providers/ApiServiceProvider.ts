import { APIClientInterface } from "../../contracts/ApiInterface";
import { ApiClient } from "../../helpers/ApiClient";
import { PROVIDER_NAMES } from "./provider-order";
import { ServiceProvider } from "./ServiceProvider";

export class ApiServiceProvider extends ServiceProvider {
    readonly name = PROVIDER_NAMES.API;
    readonly dependsOn = [PROVIDER_NAMES.CORE];
    static config: Record<string, any> = {};

    register(): void {
        this.app.set<APIClientInterface>("API", new ApiClient(), true);
    }

    boot(): void {
        this.app.get<APIClientInterface>("API").init(ApiServiceProvider.config);
    }
}
