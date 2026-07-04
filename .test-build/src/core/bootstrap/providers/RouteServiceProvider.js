"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteServiceProvider = void 0;
const routers_1 = require("../../routers");
const provider_order_1 = require("./provider-order");
const ServiceProvider_1 = require("./ServiceProvider");
class RouteServiceProvider extends ServiceProvider_1.ServiceProvider {
    constructor() {
        super(...arguments);
        this.name = provider_order_1.PROVIDER_NAMES.ROUTER;
        this.dependsOn = [provider_order_1.PROVIDER_NAMES.VIEW];
    }
    register() {
        this.app.set("Router", new routers_1.Router(this.app), true);
    }
    boot() {
        this.app.get("Router").init(RouteServiceProvider.config);
    }
}
exports.RouteServiceProvider = RouteServiceProvider;
RouteServiceProvider.config = {};
