import {afterEach, beforeAll, expect, it, vi} from 'vitest';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {mount, nextFrame, type Harness} from '../../src/testing';
import {app} from '../../src/core/helpers/app';
import {AuthService} from '../../src/core/services/AuthService';
import {ViewManager} from '../../src/core/view/ViewManager';
import {HelperService} from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';

const generated = path.join(__dirname, '../fixtures/compiled/.generated/js/auth-reactivity.js');
let factory: any;
let harness: Harness | undefined;
let vm: ViewManager | undefined;
let ssr = '';
beforeAll(async () => {
    const blade = path.join(__dirname, '../fixtures/compiled/.generated/blade/auth-reactivity.blade.php');
    ssr = execFileSync('php', [path.resolve(__dirname, '../fixtures/render-auth.php'), blade], {encoding: 'utf8'});
    factory = (await import(/* @vite-ignore */ generated)).default;
});
afterEach(() => {
    harness?.destroy(); harness = undefined;
    vm?.getCurrentView()?.__ctrl__.destroy(); vm = undefined;
    MarkerRegistry.clear(); document.body.innerHTML = ''; app().flush();
    vi.unstubAllGlobals();
});

it('hydrates actual Blade auth data, retains the SSR header and updates after Auth API logout/login', async () => {
    const auth = new AuthService({id: 1, name: 'Lan', username: 'lan'});
    app().instance('Auth', auth);
    app().instance('Helper', new HelperService(app()));
    app().instance('Registry', MarkerRegistry);
    const authClient = {
        version: 1 as const, guard: 'web', csrfToken: 'test-csrf', usernameField: 'username',
        endpoints: {session: '/auth/session', login: '/auth/login', logout: '/auth/logout'}, providers: [],
    };
    auth.client.configure(authClient);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({
        auth: {version: 1, defaultGuard: 'web', guards: {web: {user: url.endsWith('/logout')
            ? null : {id: 2, name: 'Mai', username: 'mai'}}}}, authClient,
    }))));
    const root = document.createElement('div'); root.innerHTML = ssr; document.body.append(root);
    const header = root.querySelector('#header');
    const text = root.querySelector('#computed');
    expect(text?.textContent).toBe('Lan');
    vm = new ViewManager(app()); app().instance('View', vm);
    vm.init({container: root, registry: {'fixtures.auth-reactivity': factory}});
    await vm.hydrateView('fixtures.auth-reactivity', {__SSR_VIEW_ID__: 'ssr-auth'}, {$urlPath: '/auth-test'} as any);
    await nextFrame();
    expect(root.querySelector('#header')).toBe(header);
    expect(root.querySelector('#computed')).toBe(text);
    await auth.client.logout(); await nextFrame();
    expect(text?.textContent).toBe('Guest');
    expect(root.querySelector('#guest')).not.toBeNull();
    await auth.client.login({username: 'mai', password: 'test'}); await nextFrame();
    expect(text?.textContent).toBe('Mai');
    expect(root.querySelector('#member')?.textContent).toBe('Mai');
    expect(root.querySelector('#header')).toBe(header);
    vm.getCurrentView()?.__ctrl__.destroy(); vm = undefined;
    expect((auth as any).context.listeners.size).toBe(0);
});

it('compiled header updates computed, text, attributes and auth blocks without replacing the header', async () => {
    const auth = new AuthService();
    app().instance('Auth', auth);
    harness = mount(factory);
    const root = harness.container;
    const header = root.querySelector('#header');
    const action = root.querySelector('#action') as HTMLButtonElement;
    expect(root.querySelector('#computed')?.textContent).toBe('Guest');
    expect(root.querySelector('#guest')).not.toBeNull();
    expect(action.disabled).toBe(true);
    auth.login({id: 1, name: 'Lan', username: 'lan'});
    await nextFrame();
    expect(root.querySelector('#header')).toBe(header);
    expect(root.querySelector('#computed')?.textContent).toBe('Lan');
    expect(root.querySelector('#direct')?.textContent).toBe('Lan');
    expect(root.querySelector('#member')?.textContent).toBe('Lan');
    expect(root.querySelector('#guest')).toBeNull();
    expect(action.disabled).toBe(false);
    expect(action.classList.contains('member')).toBe(true);
    expect(action.title).toBe('lan');
    auth.setUser({id: 1, name: 'Mai', username: 'mai'});
    await nextFrame();
    expect(root.querySelector('#member')?.textContent).toBe('Mai');
    expect(root.querySelector('#computed')?.textContent).toBe('Mai');
    auth.guard('admin').login({id: 9});
    await nextFrame();
    expect(root.querySelector('#admin')).not.toBeNull();
    expect(root.querySelector('#admin-guest')).toBeNull();
    auth.logout();
    await nextFrame();
    expect(root.querySelector('#member')).toBeNull();
    expect(root.querySelector('#guest')).not.toBeNull();
    expect(root.querySelector('#direct')?.textContent).toBe('Guest');
    expect(root.querySelector('#computed')?.textContent).toBe('Guest');
    expect(action.disabled).toBe(true);
    harness.destroy(); harness = undefined;
    expect((auth as any).context.listeners.size).toBe(0);
});
