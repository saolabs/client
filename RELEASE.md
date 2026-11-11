# Saola Client v1.10.0

`@foreach` list creation is now on par with React 18 on the 1,000-row benchmark.

- **Fused rows** (`FusedRow`, `ViewController.__fused`): for loop bodies that `saola/compiler` 3.8.0 fuses, each root element of a row is one object instead of one `Html` / `Output` / text object per node. The row is cloned from a template built once from the compiler's descriptor, dynamic holes are written by child-index path, one listener object serves every event of the row (modifiers supported), one state subscription serves all its bindings, and a row that re-runs with a new item is patched in place. Hydration claims the server DOM by walking template and DOM in parallel; a structural mismatch rebuilds only that row. The DOM is byte-identical to the regular path.
- `@foreach` row template cloning: the first new row of a loop is built normally and becomes a template; later rows `cloneNode` the whole subtree and their `Html` / `Output` / static text objects adopt the existing nodes, built before the row is attached. Only rows made of plain elements, static text and escaped `{{ }}` qualify (no components, `@if` blocks, nested loops, `@bind` or form controls, transitions, computed class names); anything else takes the normal path. `ViewController.rowCloning = false` turns it off. `Html` child factories run in their row scope without a wrapping closure.
- **Behaviour change:** client-created elements write `class` before other attributes, the order Blade emits. 1.9.0 wrote it after, so client-rendered DOM differed from server-rendered DOM in attribute order.
- A state setter called after its view was destroyed is now a no-op. An `async mounted()` that kept running after the user navigated away used to throw `Cannot read properties of undefined (reading 'value')` (present since at least 1.8.0).
- `bench/run.mjs` compiles with fused rows; `BENCH_FUSE=0` measures the regular path.

Benchmark (1,000-row table, Chrome, script ms, 1.9.0 → 1.10.0; React 18.3 / Vue 3.5 for reference): create 10.8 → 4.3 (4.3 / 3.2), append 1,000 12.1 → 6.4 (5.4 / 4.6), replace 2,000 39.3 → 14.8 (21.1 / 11.1), clear 2,000 10.4 → 5.0 (7.2 / 3.7), create 10,000 130 → 49 (130 / 34). No operation got slower.

Fused output needs this client: views compiled with `fuseRows` call `this.__fused`, which older clients do not have. `@saolabs/builder` 1.7.0 turns the option on only when the project's installed client is ≥ 1.10. Output from older compilers runs unchanged. Built `dist` is included in this release.

Validation: 706/706 client tests (102 test files), including fused-vs-regular DOM equality on real compiler output, events, teardown, hydration and SVG rows; admin views compile fused under strict TypeScript; TypeScript build. Starter browser gate 70/70 (SSR↔CSR parity, hydration, grid, emit, styles) run twice with local client 1.10.0 + builder 1.7.0 + compiler 3.8.0. gehihi-app browser pass with client 1.10.0 + builder 1.7.0 + compiler 3.8.0 (32 views fused): 46 web and admin pages, direct load and SPA navigation, no console errors and text / element / row counts identical to client 1.8.0 + builder 1.6.1 + compiler 3.6.1 on all 92 visits.

# Saola Client v1.9.0

Faster list creation and teardown, and `@foreach` rows are kept far more often.

- `__foreach` accepts the compiler's captured-state list (7th argument, `saola/compiler` 3.7.0) and compares only those states; output from older compilers keeps the previous "any other state" rule. `StateManager.revisionOf(keys)` is the new counter; quiet `updateRealState` writes now bump per-key versions too.
- **Behaviour change:** elements created on the client no longer carry the hydrate class `{viewId}-{id}`. That class exists to claim server-rendered DOM; nothing claims client-created elements, and one unique class per element was about a third of list creation time. Server-rendered elements keep it. Tooling that identifies compiler-owned elements by that class in client-rendered DOM (the SSR↔CSR parity gate does) must set `window.__SAOLA_CSR_HYDRATE_CLASS__ = true` before the app boots (`Html.csrHydrateClass`).
- Element registry keys live on the element instead of two `WeakMap`s; `Html` no longer allocates tracking `Set`s per element (stale attrs / classes / styles / props are derived from the previous config on update); static text allocates no closure or key array.
- Event listeners are no longer bound to an `AbortSignal`; a view removes its listeners explicitly on destroy. `elementEventHandlers` values are now `EventInvoker` records.
- `bench/profile.mjs` prints self time per function; `BENCH_ONLY=saola` runs one side of `bench/run.mjs`.

Benchmark (1,000-row table, Chrome, script ms, before → after; React 18.3 / Vue 3.5 for reference): create 18.8 → 9.2 (4.2 / 3.2), swap two rows after a selection 9.1 → 1.3 (4.8 / 1.1), replace 2,000 rows 69.5 → 36.0 (22.1 / 11.1), clear 2,000 rows 13.9 → 9.4 (7.6 / 3.7).

Pairs with `saola/compiler` 3.7.0. Built `dist` is included in this release.

Validation: 689 client tests (101 test files; one compiled-fixture test needs the starter on builder ≥ 1.6 when its compiler is 3.7), TypeScript build; gehihi-app browser pass over 46 web and admin pages (direct load and SPA navigation) identical to 1.8.0.

# Saola Client v1.8.0

`__foreach` honours the compiler's memo mode (`1` / `2`): a row whose item is
the same reference is kept when no other state, in-place mutation or parent data
changed since (`ViewController.foreachMemo = false` turns it off). Uses a single
root listener per `(element, event)` reading the current handler list so
re-renders no longer remove and re-add listeners; `@click.once` now fires once
for the life of the element. Reordering moves only out-of-place nodes, removing
a subtree detaches its root first, and hoisted static config objects (`__scN`)
are skipped when identical.

Pairs with `saola/compiler` 3.6.0. Built `dist` is included in this release.

Validation: 680 client tests (100 test files), TypeScript build and packed
native ESM/CJS/NodeNext export checks.

# Saola Client v1.7.1

Fixes a page restored from PageCache leaving the shared layout with the
previous page's `@extends` data (for example `side: false` of an editor page
hiding the side panel of the list page). A restored page does not re-render, so
the data it passed to `extendView()` is now kept and re-applied to its layout.
Data is still merged: keys a page omits keep the layout's current value, so pass
layout options explicitly.

Validation: 666 client tests (2 pre-existing compiled admin-settings failures
unrelated), TypeScript build.

# Saola Client v1.7.0

Adds client route middleware with project-owned aliases, groups, parameters,
async cancellation and SPA redirects. Declare middleware directly through
`defineBundle({middleware})`, or register it manually on the Router. Compiled
`@middleware(...)` page metadata is checked before setup, hydration and cache
restoration. Route policies precede page policies.

Use saola/core 2.9.0 for module `clientMiddleware()` declarations, compiler
3.5.0 for the `.sao` directive and builder 1.5.0 for lazy-loader metadata.
Server authorization remains independent. See docs/CLIENT_MIDDLEWARE.md.

Validation: 665 client tests, TypeScript and packed ESM/CJS/NodeNext exports.

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
