"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreServiceProvider = void 0;
const app_1 = require("../../helpers/app");
const services_1 = require("../../services");
const EventService_1 = require("../../services/EventService");
const HttpService_1 = require("../../services/HttpService");
const MarkerService_1 = require("../../services/MarkerService");
const StoreService_1 = require("../../services/StoreService");
const provider_order_1 = require("./provider-order");
const ServiceProvider_1 = require("./ServiceProvider");
class CoreServiceProvider extends ServiceProvider_1.ServiceProvider {
    constructor() {
        super(...arguments);
        this.name = provider_order_1.PROVIDER_NAMES.CORE;
    }
    register() {
        this.app.set("Marker", (0, app_1.app)(MarkerService_1.MarkerService), true);
        this.app.set("Store", StoreService_1.StoreService.instance(), true);
        this.app.set("Storage", StoreService_1.StoreService.instance(), true);
        this.app.set("Event", EventService_1.EventService.instance(), true);
        this.app.set("Http", HttpService_1.HttpService.instance(), true);
        this.app.set("Registry", services_1.MarkerRegistry, true);
    }
}
exports.CoreServiceProvider = CoreServiceProvider;
