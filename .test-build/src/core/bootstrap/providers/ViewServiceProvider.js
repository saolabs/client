"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewServiceProvider = void 0;
const view_1 = require("../../view");
const provider_order_1 = require("./provider-order");
const ServiceProvider_1 = require("./ServiceProvider");
class ViewServiceProvider extends ServiceProvider_1.ServiceProvider {
    constructor() {
        super(...arguments);
        this.name = provider_order_1.PROVIDER_NAMES.VIEW;
        this.dependsOn = [provider_order_1.PROVIDER_NAMES.CORE];
    }
    register() {
        this.app.set("View", new view_1.ViewManager(this.app), true);
    }
    boot() {
        this.app.get("View").init(ViewServiceProvider.config);
    }
}
exports.ViewServiceProvider = ViewServiceProvider;
ViewServiceProvider.config = {};
