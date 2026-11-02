# Client middleware

Register middleware in the project's bundle bootstrap. The builder does not
need to know each provider or middleware class. Middleware runs before the
Router fetches, mounts or hydrates the destination view, including the first
navigation after SSR.

## Simplest declaration

Middleware can be a function directly in the project's existing bootstrap.
No class, provider file or manual registration is required:

```ts
import {defineBundle} from '@saolabs/client';

export default defineBundle({
    middleware: {
        aliases: {
            requireLogin: ({app}) => app.Auth.check(),
        },
    },
});
```

Attach it to a module route with `->clientMiddleware('requireLogin')`.
This example blocks guests; return `{redirect: url}` to send them to login.
An `async` function works in exactly the same place. All bundle middleware is
registered before any bundle boot hook or Router start. Invalid registrations
stop boot instead of silently omitting a policy.

## Separate provider for larger projects

Create `resources/saola/_app/MiddlewareProvider.ts` (application-owned):

```ts
import {
    authMiddleware,
    guestMiddleware,
    type ClientMiddlewareConfig,
    type ClientMiddlewareContext,
} from '@saolabs/client';

function namedURL({router}: ClientMiddlewareContext, name: string): string {
    const url = router.getURL(name);
    if (!url) throw new Error(`Missing route: ${name}`);
    return url;
}

export default {
    aliases: {
        auth: authMiddleware({
            redirect(context) {
                const url = new URL(namedURL(context, 'web.login'), location.origin);
                url.searchParams.set('next', context.url);
                return url.pathname + url.search + url.hash;
            },
        }),
        guest: guestMiddleware({
            redirect: context => namedURL(context, 'web.home'),
        }),
    },
    groups: {
        member: ['auth'],
    },
} satisfies ClientMiddlewareConfig;
```

Replace the named routes with the project's own route names. `auth` uses the
current `App.Auth` snapshot; `auth:admin` selects the `admin` guard. Neither
built-in middleware makes a session request on every navigation.

Import the provider into the existing bundle bootstrap:

```ts
import {defineBundle} from '@saolabs/client';
import middleware from '@app/MiddlewareProvider';

export default defineBundle({
    middleware,
});
```

`@app` above is the project's alias for `resources/saola/_app`; a normal
relative import works too. Add the `middleware` field to the existing bundle;
keep its other fields and boot hook. Advanced/manual registration through
`App.Router.useMiddleware(middleware)` still works and returns an unregister
function. Router destroy clears its registry. Register each configuration
once, using either the bundle field or the manual API.

## Declare middleware on module routes

Alternatively, declare policies in the routed `.sao` entry view:

```sao
@middleware('requireLogin')
<template><h1>Account</h1></template>
```

This uses the same aliases registered in bootstrap. Multiple arguments or an
array of quoted static aliases are supported. Put it outside the template or
at top level in `<script setup>`. Middleware runs before the page factory's
setup, hydration and cache restoration. When both a route and its view declare
policies, route policies run first, then view policies, then project `routes`
assignments. Neither declaration changes Laravel's server middleware.

Rebuild using the updated compiler and builder. The generated lazy registry
carries metadata without importing the protected chunk. A hand-written lazy
loader needs equivalent metadata:

```ts
Object.assign(() => import('./account.js'), {middleware: ['requireLogin']})
```

The directive applies to the Router's entry view. It does not guard
synchronous included components/layouts or direct ViewManager calls. Use
module/context policies for a group of routes, and `@useAuth` for reactive
content inside a view.

Use Core's route builder to export only the client aliases into route metadata:

```php
$module->get('/account', [AccountController::class, 'show'])
    ->name('show')
    ->view('web.account')
    ->middleware('auth:web')
    ->clientMiddleware('member');
```

`clientMiddleware('auth', 'profile:complete')` and
`clientMiddleware(['auth', 'profile:complete'])` both work. Context/module
declarations are inherited, in parent-to-child order. Laravel `middleware()`
and `clientMiddleware()` are separate declarations; server class names and
callbacks are never sent to the browser.

For a route table defined directly in TypeScript:

```ts
{path: '/account', name: 'web.account.show', component: 'web.account',
 meta: {middleware: ['member']}}
```

A provider can also assign middleware by exact route name, without changing
the PHP descriptor:

```ts
{
    aliases: { /* ... */ },
    global: [/* middleware for every matched route */],
    routes: {'web.account.show': ['member']},
}
```

Execution order is `global`, inherited `meta.middleware`, project `routes`,
then the existing `beforeEach` and navigation guards. Groups expand in place.
An unknown alias, recursive group or thrown error blocks navigation and is
reported through the Router's navigation error log. Duplicate alias/group
names are rejected when registering a provider.

## Custom classes and async checks

A handler is a function or an instance with `handle(context, ...parameters)`.
Import classes into the provider and register instances:

```ts
import type {ClientMiddlewareContext} from '@saolabs/client';

export default class RequireProfile {
    async handle({signal}: ClientMiddlewareContext, step = 'complete') {
        const response = await fetch('/api/profile/status', {
            credentials: 'same-origin', signal,
        });
        if (!response.ok) return false;
        const profile = await response.json();
        return profile.step === step;
    }
}

// MiddlewareProvider.ts:
// import RequireProfile from './middleware/RequireProfile';
// aliases: {profile: new RequireProfile(), ...}
// groups: {member: ['auth', 'profile:complete']}
```

The context supplies `app`, `router`, `to`, `from`, `url` (including query and
fragment) and `signal`. Route parameters are in `to.params`, query parameters
in `to.query`. Alias parameters after `:` are passed as strings, split on `,`.
Groups cannot take parameters.

Return values:

| Result | Behavior |
| --- | --- |
| `true` or `undefined` | Continue |
| `false` | Stop; keep the current view and URL |
| `{redirect: url}` | Navigate with history replace |
| `{redirect: url, replace: false}` | Navigate with history push |

Redirects use the SPA Router, stay on the same origin and have a loop limit.
New navigation or Router stop/destroy aborts a pending middleware check. Pass
the signal to your requests; a late result cannot mount the abandoned view.

## Authentication changes while a view is open

Middleware checks entry into a route. It does not continuously run when auth
changes or guard views mounted manually through ViewManager. Use `@useAuth`
for reactive content in an already open view. If the project must leave a
protected route immediately on logout, register a disposable
`App.Auth.subscribe(...)` policy in project bootstrap and use
`App.Router.replace(...)` there.

Server middleware and API authorization remain responsible for access to
server-rendered content and protected data. Client middleware controls SPA
navigation using the latest synchronized public auth snapshot.
