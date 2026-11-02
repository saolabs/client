import {afterEach, describe, expect, it, vi} from 'vitest';
import {AuthClient, type AuthClientConfig} from '../../src/core/services/AuthClient';
import {AuthService, type AuthSnapshot, type AuthUser} from '../../src/core/services/AuthService';
import {Application} from '../../src/core/app/Application';
import {CoreServiceProvider} from '../../src/core/bootstrap/providers/CoreServiceProvider';
import {HttpService} from '../../src/core/services/HttpService';
import {ApiClient} from '../../src/core/helpers/ApiClient';
import {app} from '../../src/core/helpers/app';

const config = (csrfToken: string | null = 'csrf-before'): AuthClientConfig => ({
    version: 1, guard: 'web', csrfToken, usernameField: 'username',
    endpoints: {session: '/session-auth/session', login: '/session-auth/login', logout: '/session-auth/logout'},
    providers: [{name: 'google', label: 'Google', url: '/session-auth/google/redirect'},
        {name: 'github', label: 'GitHub', url: '/session-auth/github/redirect'}],
});
const snapshot = (user: AuthUser | null): AuthSnapshot => ({version: 1, defaultGuard: 'web', guards: {web: {user}}});
const reply = (user: AuthUser | null, token = 'csrf-after') => new Response(JSON.stringify({auth: snapshot(user), authClient: config(token)}));
const pending = () => {
    let resolve!: (value: Response) => void;
    const promise = new Promise<Response>(done => { resolve = done; });
    return {promise, resolve};
};
afterEach(() => { vi.unstubAllGlobals(); app().flush(); document.head.innerHTML = ''; });

describe('AuthClient standard session contract', () => {
    it('boots the HTTP client and user together without emitting a login', () => {
        const application = new Application();
        const auth = new AuthService(); const login = vi.fn(); auth.on('login', login);
        application.instance('Auth', auth);
        application.set('SharedData', {auth: snapshot({id: 1, name: 'Lan', username: 'lan'}), authClient: config()});
        new CoreServiceProvider(application).register();
        expect(application.Auth).toBe(auth);
        expect(auth.client.available).toBe(true);
        expect(auth.client.usernameField).toBe('username');
        expect(auth.guard('admin').client).toBe(auth.client);
        expect(auth.id()).toBe(1);
        expect(login).not.toHaveBeenCalled();
        application.flush();
        expect(auth.client.available).toBe(false);
    });

    it('logs in and out using current CSRF, updates the public snapshot and emits once', async () => {
        const auth = new AuthService();
        const change = vi.fn(), login = vi.fn(), logout = vi.fn();
        auth.subscribe(change); auth.on('login', login); auth.on('logout', logout);
        const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({id: 1, name: 'Lan'}, 'csrf-login'))
            .mockResolvedValueOnce(reply(null, 'csrf-logout'));
        const client = new AuthClient(auth, {fetch: request}).configure(config());
        document.head.innerHTML = '<meta name="csrf-token" content="csrf-before">';
        await client.login({username: 'lan', password: 'test-password', remember: true});
        expect(request.mock.calls[0][0]).toBe(window.location.origin + '/session-auth/login');
        expect(request.mock.calls[0][1]).toMatchObject({method: 'POST', credentials: 'same-origin', redirect: 'error',
            headers: {'X-CSRF-TOKEN': 'csrf-before'}, body: JSON.stringify({username: 'lan', password: 'test-password', remember: true})});
        expect(auth.user()).toEqual({id: 1, name: 'Lan'});
        expect(login).toHaveBeenCalledTimes(1);
        expect(change.mock.calls[0][0].source).toBe('login');
        expect(document.querySelector('meta')?.content).toBe('csrf-login');
        await client.logout();
        expect(request.mock.calls[1][1]).toMatchObject({method: 'POST', headers: {'X-CSRF-TOKEN': 'csrf-login'}});
        expect(auth.guest()).toBe(true);
        expect(logout).toHaveBeenCalledTimes(1);
        expect(change).toHaveBeenCalledTimes(2);
        expect(change.mock.calls[1][0].source).toBe('logout');
        expect(auth.isTransitioning).toBe(false);
        expect(document.querySelector('meta')?.content).toBe('csrf-logout');
    });

    it('refreshes an expired session and obtains CSRF before a mutation if missing at bootstrap', async () => {
        const auth = new AuthService({id: 1}); const logout = vi.fn(); auth.on('logout', logout);
        const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(null, 'fresh-token')).mockResolvedValueOnce(reply({id: 2}));
        const client = new AuthClient(auth, {fetch: request}).configure(config(null));
        await client.login({username: 'lan', password: 'test-password'});
        expect(request.mock.calls.map(call => call[1]?.method)).toEqual(['GET', 'POST']);
        expect(request.mock.calls[1][1]).toMatchObject({headers: {'X-CSRF-TOKEN': 'fresh-token'}});
        expect(logout.mock.calls[0][0].source).toBe('sync');
        expect(auth.id()).toBe(2);
        request.mockResolvedValueOnce(reply(null));
        await client.refresh();
        expect(auth.guest()).toBe(true);
    });

    it('publishes rotated CSRF before auth events and uses it for existing API/HTTP instances', async () => {
        document.head.innerHTML = '<meta name="csrf-token" content="old-meta">';
        const auth = new AuthService(); app.instance('Auth', auth); auth.client.configure(config());
        const api = new ApiClient(); const http = new HttpService();
        const request = vi.fn<typeof fetch>().mockImplementation(async url => String(url).endsWith('/session-auth/login')
            ? reply({id: 1}, 'rotated-before-event') : new Response('{}'));
        vi.stubGlobal('fetch', request);
        let subscriberRequest: Promise<unknown> | undefined;
        auth.on('login', () => { subscriberRequest = api.getHttpService().post('/profile', {name: 'Lan'}); });
        await auth.client.login({username: 'lan', password: 'test'});
        await subscriberRequest;
        expect(request.mock.calls[1][1]).toMatchObject({headers: {'X-CSRF-TOKEN': 'rotated-before-event'}});
        document.head.innerHTML = ''; // bootstrap config also works without a meta tag
        await http.delete('/draft');
        expect(request.mock.calls[2][1]).toMatchObject({headers: {'X-CSRF-TOKEN': 'rotated-before-event'}});
        await http.post('https://external.example.test/profile', {});
        expect(request.mock.calls[3][1]?.headers).not.toHaveProperty('X-CSRF-TOKEN');
        await http.post('/custom-csrf', {}, {headers: {'x-csrf-token': 'explicit-token'}});
        expect(request.mock.calls[4][1]?.headers).toMatchObject({'x-csrf-token': 'explicit-token'});
        expect(request.mock.calls[4][1]?.headers).not.toHaveProperty('X-CSRF-TOKEN');
    });

    it('preserves identity on rejection and allows a subsequent request', async () => {
        const auth = new AuthService({id: 'current'});
        const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({message: 'Invalid credentials', errors: {username: ['Invalid credentials']}}), {status: 422}))
            .mockResolvedValueOnce(reply(null));
        const client = new AuthClient(auth, {fetch: request}).configure(config());
        await expect(client.login({username: 'lan', password: 'wrong'})).rejects.toMatchObject({status: 422, errors: {username: ['Invalid credentials']}});
        expect(auth.id()).toBe('current'); expect(auth.isTransitioning).toBe(false);
        await client.logout(); expect(auth.guest()).toBe(true);
    });

    it('serializes login/logout so logout uses the rotated CSRF token', async () => {
        const auth = new AuthService(); const first = pending();
        const request = vi.fn<typeof fetch>().mockReturnValueOnce(first.promise).mockResolvedValueOnce(reply(null));
        const client = new AuthClient(auth, {fetch: request}).configure(config());
        const login = client.login({username: 'lan', password: 'test'}); const logout = client.logout();
        await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
        first.resolve(reply({id: 1}, 'rotated'));
        await Promise.all([login, logout]);
        expect(request.mock.calls[1][1]).toMatchObject({headers: {'X-CSRF-TOKEN': 'rotated'}});
        expect(auth.guest()).toBe(true);
    });

    it('rejects a stale refresh after a custom login and blocks page snapshots during a mutation', async () => {
        const auth = new AuthService(); app.instance('Auth', auth);
        const old = pending();
        const client = new AuthClient(auth, {fetch: vi.fn<typeof fetch>().mockReturnValueOnce(old.promise)}).configure(config());
        const refresh = client.refresh();
        await vi.waitFor(() => expect(auth.isTransitioning).toBe(false));
        auth.login({id: 'custom'});
        old.resolve(reply(null));
        await expect(refresh).rejects.toMatchObject({name: 'AbortError'});
        expect(auth.id()).toBe('custom');
        const loginReply = pending();
        const loginClient = new AuthClient(auth, {fetch: vi.fn<typeof fetch>().mockReturnValueOnce(loginReply.promise)}).configure(config());
        const login = loginClient.login({username: 'lan', password: 'test'});
        await vi.waitFor(() => expect(auth.isTransitioning).toBe(true));
        const oldPage = pending();
        vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(oldPage.promise).mockResolvedValueOnce(reply(null)));
        const pageBeforeCompletion = new HttpService().get('/page-before');
        await new HttpService().get('/page-during');
        expect(auth.id()).toBe('custom');
        loginReply.resolve(reply({id: 'new'})); await login;
        oldPage.resolve(reply({id: 'custom'})); await pageBeforeCompletion;
        expect(auth.id()).toBe('new');
    });

    it('never commits invalid configuration or an invalid snapshot partially', async () => {
        const auth = new AuthService({id: 'current'});
        const invalidConfig = {...config(), endpoints: {...config().endpoints, logout: 'https://evil.test/logout'}};
        const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({auth: snapshot(null), authClient: invalidConfig})))
            .mockResolvedValueOnce(new Response(JSON.stringify({auth: {version: 1}, authClient: config('bad-token')})))
            .mockResolvedValueOnce(new Response(JSON.stringify({authClient: config('missing-auth-token')})))
            .mockResolvedValueOnce(reply(null));
        const client = new AuthClient(auth, {fetch: request}).configure(config());
        await expect(client.refresh()).rejects.toThrow('current origin');
        expect(auth.id()).toBe('current');
        await expect(client.refresh()).rejects.toThrow('Invalid auth snapshot');
        expect(auth.id()).toBe('current');
        await expect(client.refresh()).rejects.toThrow('Invalid auth snapshot');
        expect(auth.id()).toBe('current');
        await client.logout();
        expect(request.mock.calls[3][1]).toMatchObject({headers: {'X-CSRF-TOKEN': 'csrf-before'}});
    });

    it('uses enabled server provider routes and rejects foreign URLs', () => {
        const navigate = vi.fn(); const client = new AuthClient(new AuthService(), {navigate}).configure(config());
        for (const provider of ['google', 'github']) {
            client.loginWith(provider, {next: '/agent/a/new?draft=1#form'});
            const url = new URL(navigate.mock.lastCall![0]);
            expect(url.pathname).toBe('/session-auth/' + provider + '/redirect');
            expect(url.searchParams.get('next')).toBe('/agent/a/new?draft=1#form');
        }
        expect(() => client.loginWith('unknown')).toThrow('not enabled');
        expect(() => client.loginWith('google', {next: '//evil.test/path'})).toThrow('current origin');
        expect(() => client.configure({...config(), endpoints: {...config().endpoints, login: 'https://evil.test'}})).toThrow('current origin');
        expect(client.available).toBe(true);
        const providers = client.providers; providers[0].url = 'https://evil.test';
        expect(client.loginUrl('google')).toContain('/session-auth/google/redirect');
    });

    it('rejects unconfigured or disabled password login without sending credentials', async () => {
        const request = vi.fn<typeof fetch>(); const client = new AuthClient(new AuthService(), {fetch: request});
        await expect(client.login({password: 'test'})).rejects.toThrow('not configured');
        client.configure({...config(), endpoints: {...config().endpoints, login: null}});
        await expect(client.login({password: 'test'})).rejects.toThrow('not enabled');
        expect(request).not.toHaveBeenCalled();
    });

    it('invalidates a response when configuration is disabled and aborts active work on destroy', async () => {
        const auth = new AuthService({id: 1}); const old = pending();
        const request = vi.fn<typeof fetch>().mockReturnValueOnce(old.promise);
        const client = new AuthClient(auth, {fetch: request}).configure(config());
        const refresh = client.refresh();
        await vi.waitFor(() => expect(request).toHaveBeenCalled());
        client.configure(null); old.resolve(reply(null));
        await expect(refresh).rejects.toMatchObject({name: 'AbortError'}); expect(auth.id()).toBe(1);
        const active = pending(); request.mockReturnValueOnce(active.promise); client.configure(config());
        const login = client.login({username: 'lan', password: 'test'}); const queued = client.logout();
        await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
        client.destroy();
        expect(request.mock.calls[1][1]?.signal?.aborted).toBe(true);
        active.resolve(reply(null));
        await expect(login).rejects.toMatchObject({name: 'AbortError'});
        await expect(queued).rejects.toThrow('destroyed');
        expect(auth.id()).toBe(1); expect(auth.isTransitioning).toBe(false);
    });
});
