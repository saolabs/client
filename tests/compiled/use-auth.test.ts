import {afterEach, beforeAll, expect, it} from 'vitest';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {nextFrame} from '../../src/testing';
import {app} from '../../src/core/helpers/app';
import {AuthService} from '../../src/core/services/AuthService';
import {ViewManager} from '../../src/core/view/ViewManager';
import {HelperService} from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';

let factory: any, ssr: string, vm: ViewManager;
beforeAll(async () => {
    const dir = path.join(__dirname, '../fixtures/compiled/.generated');
    ssr = execFileSync('php', [path.resolve(__dirname, '../fixtures/render-auth.php'), path.join(dir, 'blade/use-auth.blade.php'), 'fixtures.use-auth'], {encoding:'utf8'});
    factory = (await import(/* @vite-ignore */ path.join(dir, 'js/use-auth.js'))).default;
});
afterEach(() => { vm?.getCurrentView()?.__ctrl__.destroy(); MarkerRegistry.clear(); document.body.replaceChildren(); app().flush(); });

it('hydrates the reserved state and updates it through auth events and its ordinary setter', async () => {
    const auth = new AuthService({id:1, name:'Lan', username:'lan'});
    app().instance('Auth', auth); app().instance('Helper', new HelperService(app())); app().instance('Registry', MarkerRegistry);
    const root = document.createElement('div'); root.innerHTML = ssr; document.body.append(root);
    const header = root.querySelector('#auth-header'), name = root.querySelector('#auth-name');
    expect(name?.textContent).toBe('Lan');
    vm = new ViewManager(app()); app().instance('View', vm);
    vm.init({container:root, registry:{'fixtures.use-auth':factory}});
    await vm.hydrateView('fixtures.use-auth', {__SSR_VIEW_ID__:'ssr-auth'}, {$urlPath:'/auth'} as any);
    await nextFrame();
    expect(root.querySelector('#auth-header')).toBe(header);
    expect(root.querySelector('#auth-name')).toBe(name);
    // @useAuth itself owns exactly one service subscription, without @computed.
    expect((auth as any).context.listeners.size).toBe(1);
    expect((vm.getCurrentView()!.__ctrl__.states.__ as any).subscriptions.has('@auth')).toBe(false);
    (root.querySelector('#auth-clear') as HTMLButtonElement).click(); await nextFrame();
    expect(name?.textContent).toBe('Guest'); expect(auth.id()).toBe(1);
    auth.setUser({id:1,name:'Updated',username:'updated'});
    expect(vm.getCurrentView()!.__ctrl__.states.__.getStateByKey('__auth__')?.name).toBe('Updated');
    await nextFrame(); await nextFrame();
    expect(name?.textContent).toBe('Updated');
    const manager = vm.getCurrentView()!.__ctrl__.states.__;
    manager.pause(); auth.logout(); await nextFrame();
    expect(manager.getStateByKey('__auth__')).toBeNull();
    expect(name?.textContent).toBe('Updated');
    manager.resume(); await nextFrame(); await nextFrame();
    expect(name?.textContent).toBe('Guest'); expect(root.querySelector('#auth-guest')).not.toBeNull();
    auth.login({id:2,name:'Mai',username:'mai'}); await nextFrame(); await nextFrame();
    expect(name?.textContent).toBe('Mai'); expect(root.querySelector('#auth-header')).toBe(header);
    vm.getCurrentView()!.__ctrl__.destroy();
    expect((auth as any).context.listeners.size).toBe(0);
});
