import { MarkerRegistry } from "../../services/index.js";
import { EventService } from "../../services/EventService.js";
import { HttpService } from "../../services/HttpService.js";
import { StoreService } from "../../services/StoreService.js";
import HeadService from "../../services/HeadService.js";
import { Devtools } from "../../devtools/index.js";
import { PROVIDER_NAMES } from "./provider-order.js";
import { ServiceProvider } from "./ServiceProvider.js";
export class CoreServiceProvider extends ServiceProvider {
    constructor() {
        super(...arguments);
        this.name = PROVIDER_NAMES.CORE;
    }
    register() {
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