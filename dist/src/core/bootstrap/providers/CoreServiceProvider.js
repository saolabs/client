import { app } from "../../helpers/app";
import { MarkerRegistry } from "../../services";
import { EventService } from "../../services/EventService";
import { HttpService } from "../../services/HttpService";
import { MarkerService } from "../../services/MarkerService";
import { StoreService } from "../../services/StoreService";
import HeadService from "../../services/HeadService";
import { Devtools } from "../../devtools";
import { PROVIDER_NAMES } from "./provider-order";
import { ServiceProvider } from "./ServiceProvider";
export class CoreServiceProvider extends ServiceProvider {
    constructor() {
        super(...arguments);
        this.name = PROVIDER_NAMES.CORE;
    }
    register() {
        this.app.set("Marker", app(MarkerService), true);
        this.app.set("Store", StoreService.instance(), true);
        this.app.set("Storage", StoreService.instance(), true);
        this.app.set("Event", EventService.instance(), true);
        this.app.set("Http", HttpService.instance(), true);
        this.app.set("Registry", MarkerRegistry, true);
        this.app.set("Head", HeadService, true);
        this.app.set("Devtools", Devtools, true);
    }
}
//# sourceMappingURL=CoreServiceProvider.js.map