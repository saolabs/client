"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const provider_order_1 = require("./provider-order");
function provider(name, dependsOn = []) {
    return {
        name,
        dependsOn,
        register() {
            // noop for ordering test
        }
    };
}
(0, node_test_1.describe)("resolveProviderOrder", () => {
    (0, node_test_1.it)("orders providers by dependency graph", () => {
        const ordered = (0, provider_order_1.resolveProviderOrder)([
            provider("router", ["view"]),
            provider("api", ["core"]),
            provider("view", ["core"]),
            provider("core")
        ]);
        const names = ordered.map((item) => item.name);
        strict_1.default.deepEqual(names, ["core", "view", "router", "api"]);
    });
    (0, node_test_1.it)("works with PROVIDER_NAMES constants", () => {
        const ordered = (0, provider_order_1.resolveProviderOrder)([
            provider(provider_order_1.PROVIDER_NAMES.ROUTER, [provider_order_1.PROVIDER_NAMES.VIEW]),
            provider(provider_order_1.PROVIDER_NAMES.VIEW, [provider_order_1.PROVIDER_NAMES.CORE]),
            provider(provider_order_1.PROVIDER_NAMES.CORE),
        ]);
        const names = ordered.map((p) => p.name);
        strict_1.default.equal(names.indexOf(provider_order_1.PROVIDER_NAMES.CORE), 0);
        strict_1.default.ok(names.indexOf(provider_order_1.PROVIDER_NAMES.VIEW) < names.indexOf(provider_order_1.PROVIDER_NAMES.ROUTER));
    });
    (0, node_test_1.it)("throws for missing dependency", () => {
        strict_1.default.throws(() => (0, provider_order_1.resolveProviderOrder)([provider("view", ["core"])]), /Missing provider dependency/);
    });
    (0, node_test_1.it)("throws for circular dependency", () => {
        strict_1.default.throws(() => (0, provider_order_1.resolveProviderOrder)([
            provider("a", ["b"]),
            provider("b", ["c"]),
            provider("c", ["a"])
        ]), /Circular service provider dependency/);
    });
    (0, node_test_1.it)("throws for duplicate provider names", () => {
        strict_1.default.throws(() => (0, provider_order_1.resolveProviderOrder)([
            provider("core"),
            provider("core")
        ]), /Duplicate provider name/);
    });
});
