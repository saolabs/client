# Authentication state

For checks before entering a client route, see [Client middleware](./CLIENT_MIDDLEWARE.md).

Core exports `APP_CONFIGS.shared.auth` on the first page and an `auth` snapshot
on SPA page-data responses. The default Core provider initializes `App.Auth`
before any view or helper is created. No token or user is persisted in browser
storage by this service.

```ts
import { auth } from '@saolabs/client';

auth().check(); // boolean
auth().guest(); // boolean
auth().id();    // string | number | null
auth().user();  // readonly public user data, or null
auth('admin').check();

// App.Helper.auth() and auth() return the same App.Auth instance.
```

In `.sao` rendering expressions, call `auth().check()`, `auth().user()`, etc.
The PHP side continues to use Laravel's existing `auth()` helper. The client
helper `isAuth()` is retained for older compiled `@auth/@guest` views.

## Login and logout lifecycle

`login(user)` and `logout()` record **successful server actions**. They do not
send credentials, call an endpoint, create a server session, or grant access.
Applications may use the standard Auth API below or supply their own endpoints.
The application owns its login form and error UI.

```ts
const result = await api.login(credentials);
auth().login(result.user);

await api.logout();
auth().logout();
```

`setUser(user)` synchronizes a confirmed profile update. `setUser(null)` records
a confirmed expired session. Failed login/logout requests should leave the
current auth state untouched. `HttpService` automatically consumes valid `auth`
snapshots from same-origin responses; responses from before an explicit
login/logout cannot restore stale user data. Native `fetch` callers can use
`App.Auth.sync(snapshot)` explicitly.

```ts
const stop = auth().on('login', ({guard, user, previousUser}) => {
    // Refresh the account's data or navigate after login.
});
const stopLogout = auth().on('logout', change => {
    // Clear application-owned private data and leave private screens.
});
const stopChange = auth().subscribe(change => {
    // Includes profile changes; metadata-only updates do not emit login again.
});

stop(); stopLogout(); stopChange(); // remove listeners on component cleanup
```

The root service observes all guards; listeners on `auth('admin')` only observe
that guard. Switching accounts emits `logout`, `login` and `change` with both
the previous and current user. Repeating identical state does not emit events.
Initial boot is silent, so restoring an existing server session is not a new
login event. Application-owned state still needs a subscription with cleanup.

## Standard Auth API client

Enable `sao.auth_api.enabled` in Core to receive `APP_CONFIGS.shared.authClient`.
Core sends named-route URLs, enabled providers, the session CSRF token and the
API guard. `CoreServiceProvider` configures the same `App.Auth.client` before
views initialize. No URL list or context API needs to be maintained by the app.

```ts
// Inside a script/event handler:
await App.Auth.client.login({username: 'lan', password, remember: true});
await App.Auth.client.logout();
await App.Auth.client.refresh(); // restore current session, including expiry

App.Auth.client.loginWith('google', {next: '/account'});
App.Auth.client.loginWith('github'); // returns to the current page by default
App.Auth.client.providers; // [{name, label, url}], only enabled providers
App.Auth.client.usernameField; // e.g. 'email' (default) or 'username'
App.Auth.client.available; // false if standard API is disabled
```

`auth().client` is the same transport. It performs same-origin requests with
the session cookie and CSRF, rotates the CSRF meta tag after mutations, serializes
login/logout requests, and commits the server snapshot only after success.
`HttpService` and `App.API` read the current CSRF at send time for same-origin
mutations, including requests started by an auth event subscriber. Explicit
CSRF headers supplied by the application are preserved.
Failed HTTP responses reject with `status` and `errors` when provided by the
server. Explicit auth changes invalidate pending responses; page-data responses
cannot overwrite a pending login/logout. Destroying/resetting the application
aborts pending auth work. No credentials or OAuth tokens are stored in browser
storage.

OAuth uses a full-page redirect to the server endpoint. The callback verifies
provider state, resolves a local user and creates the server session; the next
SSR page initializes `App.Auth` silently from that session. Popup login is not
part of this transport. For a custom popup or auth implementation, confirm the
result with your backend and call `App.Auth.login(publicUser)`,
`App.Auth.logout()` or `App.Auth.sync(snapshot)`; existing subscribers and views
continue to work.

The transport operates on the server-configured `auth_api.guard`, including when
accessed through `auth('admin').client`. Guard selection is not accepted from
untrusted request input. To read a non-default API guard, use
`auth('members').user()`; all guards use the same authoritative snapshot.

See [Core Auth API setup](../../core/docs/AUTH_API.md) for route configuration,
Google/GitHub credentials and the application-owned social user resolver.

## Reactive views

Compiler 3.4.0+ also supports `@useAuth` (aliases `@useAuth()`, `@useauth`,
`@useauth()`) at view scope or in `<script setup>`. It declares writable state
`__auth__` with setter `set__auth__(...)`, automatically follows AuthService
changes, and releases the subscription on view destruction. For example:

```sao
@useAuth
<template>
    @if(__auth__)<span>{{ __auth__.name }}</span>@else<span>Guest</span>@endif
</template>
```

The setter affects the local view only; the next service change restores the
current user. This uses the existing client 1.6.0 subscription runtime. SSR uses
Core 2.8.0's safe user projection. See [directive details](../../compiler/docs/USE_AUTH.md).

With the updated compiler and client runtime, auth reads in template text,
attributes, classes, styles, include props and conditions subscribe to `App.Auth`
changes automatically. `@auth`, `@guest`, `@elseauth` and `@elseguest` support an
optional guard and compile to ordinary reactive conditions with matching SSR markers.

```sao
@computed(user = auth().user())
@computed(displayName = user ? user.name : 'Guest')
<template>
    <header>
        <span>{{ displayName }}</span>
        @auth
            <a href="/account">{{ auth().user().username }}</a>
        @else
            <span>Sign in</span>
        @endauth
    </header>
</template>
```

Computed evaluation tracks service reads at runtime, including reads hidden
inside a helper. Dependencies are reconciled when branches change; auth changes
invalidate computed chains synchronously and batch DOM updates. Paused views
retain dirty state; destroyed views release subscriptions. Only reading a value
into a plain `const`/`@let` does not establish a reactive binding. Event handlers
read the current service when invoked, without a persistent render subscription.

For another service, call exported `trackDependency(this)` from its read method
and implement `subscribe(callback)` returning an unsubscribe function. Use that
service through `@computed`; arbitrary helper calls in templates cannot be
statically identified as auth reads, so wrap those calls in a computed binding.

## Server configuration

In `config/sao.php` (the `saola` config alias is also supported):

```php
'client_auth' => [
    'guards' => ['admin'], // default Laravel guard is always included
    'user_fields' => ['name', 'username'],
],
```

The default projection contains only `name`, `username`, and the authentication identifier
as `id`. Do not add sensitive fields such as email, phone numbers, passwords, or tokens
to this allowlist: the selected fields are embedded in SSR HTML and page-data JSON.
Core resolves users afresh for each request and never serializes the
whole model. Only guards explicitly exported by the server can be checked by
the client. Laravel middleware and policies remain authoritative.
