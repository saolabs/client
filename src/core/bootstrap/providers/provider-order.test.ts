import { describe, it, expect } from "vitest";
import { NamedServiceProvider, resolveProviderOrder, PROVIDER_NAMES } from "./provider-order";

function provider(name: string, dependsOn: string[] = []): NamedServiceProvider {
    return {
        name,
        dependsOn,
        register() {},
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
        expect(names).toEqual(["core", "view", "router", "api"]);
    });

    it("works with PROVIDER_NAMES constants", () => {
        const ordered = resolveProviderOrder([
            provider(PROVIDER_NAMES.ROUTER, [PROVIDER_NAMES.VIEW]),
            provider(PROVIDER_NAMES.VIEW, [PROVIDER_NAMES.CORE]),
            provider(PROVIDER_NAMES.CORE),
        ]);

        const names = ordered.map((p) => p.name);
        expect(names.indexOf(PROVIDER_NAMES.CORE)).toBe(0);
        expect(names.indexOf(PROVIDER_NAMES.VIEW)).toBeLessThan(names.indexOf(PROVIDER_NAMES.ROUTER));
    });

    it("throws for missing dependency", () => {
        expect(() => resolveProviderOrder([provider("view", ["core"])]))
            .toThrow(/Missing provider dependency/);
    });

    it("throws for circular dependency", () => {
        expect(() => resolveProviderOrder([
            provider("a", ["b"]),
            provider("b", ["c"]),
            provider("c", ["a"])
        ])).toThrow(/Circular service provider dependency/);
    });

    it("throws for duplicate provider names", () => {
        expect(() => resolveProviderOrder([
            provider("core"),
            provider("core")
        ])).toThrow(/Duplicate provider name/);
    });
});
