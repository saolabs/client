import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NamedServiceProvider, resolveProviderOrder, PROVIDER_NAMES } from "./provider-order";

function provider(name: string, dependsOn: string[] = []): NamedServiceProvider {
    return {
        name,
        dependsOn,
        register() {
            // noop for ordering test
        }
    };
}

describe("resolveProviderOrder", () => {
    it("orders providers by dependency graph", () => {
        const ordered = resolveProviderOrder([
            provider("router", ["view"]),
            provider("api", ["core"]),
            provider("view", ["core"]),
            provider("core")
        ]);

        const names = ordered.map((item) => item.name);
        assert.deepEqual(names, ["core", "view", "router", "api"]);
    });

    it("works with PROVIDER_NAMES constants", () => {
        const ordered = resolveProviderOrder([
            provider(PROVIDER_NAMES.ROUTER, [PROVIDER_NAMES.VIEW]),
            provider(PROVIDER_NAMES.VIEW, [PROVIDER_NAMES.CORE]),
            provider(PROVIDER_NAMES.CORE),
        ]);

        const names = ordered.map((p) => p.name);
        assert.equal(names.indexOf(PROVIDER_NAMES.CORE), 0);
        assert.ok(names.indexOf(PROVIDER_NAMES.VIEW) < names.indexOf(PROVIDER_NAMES.ROUTER));
    });

    it("throws for missing dependency", () => {
        assert.throws(
            () => resolveProviderOrder([provider("view", ["core"])]),
            /Missing provider dependency/
        );
    });

    it("throws for circular dependency", () => {
        assert.throws(
            () => resolveProviderOrder([
                provider("a", ["b"]),
                provider("b", ["c"]),
                provider("c", ["a"])
            ]),
            /Circular service provider dependency/
        );
    });

    it("throws for duplicate provider names", () => {
        assert.throws(
            () => resolveProviderOrder([
                provider("core"),
                provider("core")
            ]),
            /Duplicate provider name/
        );
    });
});
