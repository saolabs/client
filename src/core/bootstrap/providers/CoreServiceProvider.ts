import { MarkerRegistryInterface, MarkerServiceInterface } from "../../contracts/MarkerInterface.js";
import { app } from "../../helpers/app.js";
import { MarkerRegistry, MarkerRegistryService } from "../../services/index.js";
import { EventService } from "../../services/EventService.js";
import { HttpService } from "../../services/HttpService.js";
import { MarkerService } from "../../services/MarkerService.js";
import { StoreService } from "../../services/StoreService.js";
import HeadService from "../../services/HeadService.js";
import { Devtools } from "../../devtools/index.js";
import type { HeadServiceInterface } from "../../contracts/HeadServiceInterface.js";
import { PROVIDER_NAMES } from "./provider-order.js";
import { ServiceProvider } from "./ServiceProvider.js";

export class CoreServiceProvider extends ServiceProvider {
    readonly name = PROVIDER_NAMES.CORE;

    register(): void {
        this.app.set<MarkerService>("Marker", app<MarkerService>(MarkerService), true);
        this.app.set<StoreService>("Store", StoreService.instance(), true);
        this.app.set<StoreService>("Storage", StoreService.instance(), true);
        this.app.set<EventService>("Event", EventService.instance(), true);
        this.app.set<HttpService>("Http", HttpService.instance(), true);
        this.app.set<MarkerRegistryInterface>("Registry", MarkerRegistry, true);
        this.app.set<HeadServiceInterface>("Head", HeadService, true);
        this.app.set("Devtools", Devtools, true);
    }
}
