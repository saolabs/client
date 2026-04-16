import { app } from "../../hellpers/app";
import { EventService } from "../../services/EventService";
import { HttpService } from "../../services/HttpService";
import { MarkerService } from "../../services/MarkerService";
import { StoreService } from "../../services/StoreService";
import { PROVIDER_NAMES } from "./provider-order";
import { ServiceProvider } from "./ServiceProvider";

export class CoreServiceProvider extends ServiceProvider {
    readonly name = PROVIDER_NAMES.CORE;

    register(): void {
        this.app.set<MarkerService>("Marker", app<MarkerService>(MarkerService), true);
        this.app.set<StoreService>("Store", StoreService.instance(), true);
        this.app.set<StoreService>("Storage", StoreService.instance(), true);
        this.app.set<EventService>("Event", EventService.instance(), true);
        this.app.set<HttpService>("Http", HttpService.instance(), true);
    }
}
