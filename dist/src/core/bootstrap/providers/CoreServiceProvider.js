import { MarkerRegistry } from "../../services/index.js";
import { EventService } from "../../services/EventService.js";
import { HttpService } from "../../services/HttpService.js";
import { AuthService } from "../../services/AuthService.js";
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
        const auth = this.app.has('Auth') ? this.app.get('Auth') : new AuthService();
        const snapshot = this.app.shared('auth');
        if (snapshot !== undefined)
            auth.initialize(snapshot);
        const authClient = this.app.shared('authClient');
        if (authClient !== undefined)
            auth.client.configure(authClient);
        this.app.set('Auth', auth, true);
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