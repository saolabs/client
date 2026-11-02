import { AuthService } from './AuthService.js';
/** Same-origin session transport; no dependency on Router, View or a context API. */
export class AuthClient {
    constructor(auth, options = {}) {
        this.auth = auth;
        this.options = options;
        this.config = null;
        this.queue = Promise.resolve();
        this.requests = new Set();
        this.disposed = false;
        this.generation = 0;
    }
    configure(config) {
        if (config !== null) {
            if (config.version !== 1 || typeof config.guard !== 'string' || !config.guard
                || typeof config.usernameField !== 'string' || !config.usernameField
                || (config.csrfToken !== null && typeof config.csrfToken !== 'string')
                || !Array.isArray(config.providers))
                throw new TypeError('Invalid Auth API configuration.');
            this.localUrl(config.endpoints?.session);
            this.localUrl(config.endpoints?.logout);
            if (config.endpoints.login !== null)
                this.localUrl(config.endpoints.login);
            for (const provider of config.providers) {
                if (typeof provider.name !== 'string' || !provider.name || typeof provider.label !== 'string') {
                    throw new TypeError('Invalid auth provider.');
                }
                this.localUrl(provider.url);
            }
        }
        this.config = config === null ? null : structuredClone(config);
        this.generation++;
        return this;
    }
    get available() { return this.config !== null && !this.disposed; }
    get csrfToken() { return this.config?.csrfToken ?? null; }
    get usernameField() { return this.config?.usernameField ?? null; }
    get providers() { return structuredClone(this.config?.providers ?? []); }
    login(credentials) {
        // Do not retain the caller's mutable object while waiting for another operation.
        return this.enqueue('login', { ...credentials });
    }
    logout() { return this.enqueue('logout'); }
    refresh() { return this.enqueue('session'); }
    loginUrl(provider, options = {}) {
        this.assertAvailable();
        const item = this.config.providers.find(item => item.name === provider);
        if (!item)
            throw new Error(`Auth provider "${provider}" is not enabled.`);
        const url = this.localUrl(item.url);
        const next = this.localUrl(options.next ?? (window.location.pathname + window.location.search + window.location.hash));
        url.searchParams.set('next', next.pathname + next.search + next.hash);
        return url.href;
    }
    /** OAuth redirects through the server; callback restores auth via a fresh SSR bootstrap. */
    loginWith(provider, options = {}) {
        const url = this.loginUrl(provider, options);
        (this.options.navigate ?? (url => window.location.assign(url)))(url);
    }
    enqueue(action, body) {
        const work = this.queue.then(async () => {
            this.assertAvailable();
            if (!this.config.endpoints[action])
                throw new Error('Password login is not enabled.');
            const finish = action === 'session' ? () => { } : this.auth.beginClientTransition();
            try {
                // A refresh obtains the cookie/CSRF token when boot ran without a session.
                if (action !== 'session' && !this.config.csrfToken)
                    await this.request('session');
                return await this.request(action, body);
            }
            finally {
                finish();
            }
        });
        // A failed login must not poison later logout/refresh operations.
        this.queue = work.catch(() => { });
        return work;
    }
    async request(action, body) {
        this.assertAvailable();
        const config = this.config;
        const url = this.localUrl(config.endpoints[action]);
        const revision = this.auth.revision;
        const generation = this.generation;
        const controller = new AbortController();
        this.requests.add(controller);
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
            const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
            if (action !== 'session') {
                if (!config.csrfToken)
                    throw new Error('Auth API did not provide a CSRF token.');
                headers['X-CSRF-TOKEN'] = config.csrfToken;
                headers['Content-Type'] = 'application/json';
            }
            const response = await (this.options.fetch ?? fetch)(url.href, {
                method: action === 'session' ? 'GET' : 'POST', headers,
                credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store',
                signal: controller.signal,
                ...(action === 'session' ? {} : { body: JSON.stringify(body ?? {}) }),
            });
            if (response.url)
                this.localUrl(response.url);
            const payload = await response.json();
            controller.signal.throwIfAborted();
            if (!response.ok) {
                throw Object.assign(new Error(typeof payload?.message === 'string' ? payload.message : `Authentication request failed (${response.status}).`), { status: response.status, errors: payload?.errors });
            }
            if (this.disposed || generation !== this.generation || revision !== this.auth.revision) {
                throw Object.assign(new Error('Authentication changed while the request was pending.'), { name: 'AbortError' });
            }
            // Validate the next configuration before committing either state or CSRF.
            const next = new AuthClient(this.auth);
            next.configure(payload.authClient);
            if (!payload.authClient)
                throw new TypeError('Missing Auth API configuration.');
            new AuthService().initialize(payload.auth); // deep validation without emitting or changing current auth
            // Subscribers may immediately send a request. Publish the new CSRF first.
            this.configure(payload.authClient);
            const meta = typeof document === 'undefined' ? null : document.querySelector('meta[name="csrf-token"]');
            if (meta && this.config?.csrfToken)
                meta.content = this.config.csrfToken;
            this.auth.sync(payload.auth, action === 'session' ? 'sync' : action);
            return payload.auth;
        }
        finally {
            clearTimeout(timeout);
            this.requests.delete(controller);
        }
    }
    localUrl(value) {
        if (typeof window === 'undefined' || typeof value !== 'string' || !value.trim()) {
            throw new TypeError('Auth API requires a browser and a same-origin URL.');
        }
        const url = new URL(value, window.location.origin);
        if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
            throw new TypeError('Auth API URLs must use the current origin.');
        }
        return url;
    }
    assertAvailable() {
        if (!this.available)
            throw new Error('Auth API is not configured or has been destroyed.');
    }
    destroy() {
        this.disposed = true;
        this.generation++;
        for (const controller of this.requests)
            controller.abort();
        this.requests.clear();
        this.config = null;
    }
}
//# sourceMappingURL=AuthClient.js.map