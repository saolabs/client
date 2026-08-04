import { MarkerRegistryInterface, MarkerServiceInterface } from "../../contracts/MarkerInterface";
import { app } from "../../helpers/app";
import { MarkerRegistry, MarkerRegistryService } from "../../services";
import { EventService } from "../../services/EventService";
import { HttpService } from "../../services/HttpService";
import { MarkerService } from "../../services/MarkerService";
import { StoreService } from "../../services/StoreService";
import HeadService from "../../services/HeadService";
import { Devtools } from "../../devtools";
import type { HeadServiceInterface } from "../../contracts/HeadServiceInterface";
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
        this.app.set<MarkerRegistryInterface>("Registry", MarkerRegistry, true);
        this.app.set<HeadServiceInterface>("Head", HeadService, true);
        this.app.set("Devtools", Devtools, true);
    }
}
