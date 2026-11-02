# Saola Client v1.6.0

Adds App.Auth and auth() with shared SSR state, guard-aware events and reactive computed dependencies. App.Auth.client provides same-origin session login/logout/refresh and Google/GitHub redirects using the Core Auth API. Includes CSRF rotation across existing HTTP/API instances, serialized auth mutations, stale-response protection and cleanup on application reset.

Pairs with saola/core 2.8.0 and saola/compiler 3.3.0. Applications can keep custom authentication and report confirmed changes through App.Auth. See docs/AUTH.md. Built dist is included in this release.

Validation: 647 client tests, TypeScript build and packaged native ESM/CJS/NodeNext export checks.

# Saola Client v1.5.2

Declares the language dictionaries the app holds (`X-Saola-Language`, kept in step on init, page-data refresh and language install) so a server on saola/core ≥ 2.7.1 stops re-sending them with every page. A page-data `i18n` without catalogs leaves the installed ones untouched.

Validation: TypeScript, 623 tests (new case in `language-catalog.test.ts`), build. Includes built dist in the GitHub tag used by consumer applications.

# Saola Client v1.5.1

Applies declared option selection after mounting and hydration so native selects retain the correct configured value. Updates compiled admin fixtures and input registry coverage.

Validation: TypeScript, 622 runtime/compiled tests, build and 12 packaged consumer tests passed. Includes built dist in the GitHub tag used by consumer applications.

# Saola Client v1.3.0

Adds scoped versioned DB language snapshots, text(), runtime load/changeLanguage with asynchronous guards and stale-request cancellation. Page-data refreshes the active catalog before rendering. Router.addNavigationGuard returns an independent disposer and restores history/hash URLs when Back is canceled.

Legacy trans()/choice()/__ and Laravel-style dictionary data remain supported. Compile new .sao __() calls with saola/compiler >=3.0 and prepare catalogs with saola/core >=2.4. This coordinated release is distributed by the GitHub v1.3.0 tag with built dist; npm publication is a separate operation and is not claimed here.

Validation: runtime TypeScript build, packed native ESM/CJS dynamic-import/NodeNext consumer, and the ecosystem client suite including actual admin SSR/hydration, language and form guards.
