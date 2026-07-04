"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelperServiceProvider = void 0;
const HelperService_1 = require("../../services/HelperService");
const provider_order_1 = require("./provider-order");
const ServiceProvider_1 = require("./ServiceProvider");
class HelperServiceProvider extends ServiceProvider_1.ServiceProvider {
    constructor() {
        super(...arguments);
        this.name = provider_order_1.PROVIDER_NAMES.HELPER;
        this.dependsOn = [provider_order_1.PROVIDER_NAMES.CORE, provider_order_1.PROVIDER_NAMES.ROUTER, provider_order_1.PROVIDER_NAMES.VIEW];
    }
    register() {
        this.app.set("Helper", new HelperService_1.HelperService(this.app), true);
    }
}
exports.HelperServiceProvider = HelperServiceProvider;
