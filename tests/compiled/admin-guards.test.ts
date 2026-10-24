import {afterEach, expect, it, vi} from 'vitest';
import {Router} from '../../src/core/routers/Router';
let router: Router | undefined;
afterEach(() => { router?.destroy(); router = undefined; window.history.replaceState({}, '', '/'); vi.restoreAllMocks(); });

it.each(['history', 'hash'] as const)('disposable guards preserve host guards and restore a blocked %s pop URL', async mode => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    window.history.replaceState({}, '', mode === 'history' ? '/a' : '/#/a');
    const mount = vi.fn(async () => ({}));
    const manager: any = {mountView: mount, consumeSSRViewId: () => null, cancelNavigation: vi.fn()};
    router = new Router(); router.setMode(mode).setViewManager(manager);
    router.addRoute('/a', 'a').addRoute('/b', 'b');
    const host = vi.fn(() => true); router.beforeEach(host); router.start();
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(1));
    const leave = vi.fn(() => false); const dispose = router.addNavigationGuard(leave);
    window.history.pushState({}, '', mode === 'history' ? '/b' : '/#/b');
    window.dispatchEvent(mode === 'history' ? new PopStateEvent('popstate') : new HashChangeEvent('hashchange'));
    await vi.waitFor(() => expect(leave).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(mode === 'history' ? window.location.pathname : window.location.hash).toBe(mode === 'history' ? '/a' : '#/a'));
    expect(mount).toHaveBeenCalledTimes(1); expect(host).toHaveBeenCalledTimes(2);
    dispose(); router.navigate('/b');
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2));
    expect(host).toHaveBeenCalledTimes(3); expect(leave).toHaveBeenCalledTimes(1);
});
