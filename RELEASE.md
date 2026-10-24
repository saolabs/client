# Saola Client v1.3.0

Adds scoped versioned DB language snapshots, text(), runtime load/changeLanguage with asynchronous guards and stale-request cancellation. Page-data refreshes the active catalog before rendering. Router.addNavigationGuard returns an independent disposer and restores history/hash URLs when Back is canceled.

Legacy trans()/choice()/__ and Laravel-style dictionary data remain supported. Compile new .sao __() calls with saola/compiler >=3.0 and prepare catalogs with saola/core >=2.4. This coordinated release is distributed by the GitHub v1.3.0 tag with built dist; npm publication is a separate operation and is not claimed here.

Validation: runtime TypeScript build, packed native ESM/CJS dynamic-import/NodeNext consumer, and the ecosystem client suite including actual admin SSR/hydration, language and form guards.
