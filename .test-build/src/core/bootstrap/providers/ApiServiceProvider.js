"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiServiceProvider = void 0;
const ApiClient_1 = require("../../helpers/ApiClient");
const provider_order_1 = require("./provider-order");
const ServiceProvider_1 = require("./ServiceProvider");
class ApiServiceProvider extends ServiceProvider_1.ServiceProvider {
    constructor() {
        super(...arguments);
        this.name = provider_order_1.PROVIDER_NAMES.API;
        this.dependsOn = [provider_order_1.PROVIDER_NAMES.CORE];
    }
    register() {
        this.app.set("API", new ApiClient_1.ApiClient(), true);
    }
    boot() {
        this.app.get("API").init(ApiServiceProvider.config);
    }
}
exports.ApiServiceProvider = ApiServiceProvider;
ApiServiceProvider.config = {};
