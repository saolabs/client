import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from '../../src/core/routers/Router';
import { HttpService } from '../../src/core/services/HttpService';
import { ViewManager } from '../../src/core/view/ViewManager';

describe('dynamic view-context route updates', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/');
        (window as any).APP_CONFIGS = {
            view: {
                revision: 'rev-old',
                contextViews: 'web',
                systemData: { __context__: 'web', __base__: 'web.' },
            },
        };
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.sessionStorage.clear();
        delete (window as any).APP_CONFIGS;
        document.body.innerHTML = '';
    });

    it('ViewManager applies a newer revision and ignores duplicates', () => {
        const vm = new ViewManager({} as any);
        vm.init({
            revision: 'rev-old',
            contextViews: 'web',
            systemData: { __context__: 'web', __base__: 'web.' },
        });

        expect(vm.applyViewContext({
            revision: 'rev-new',
            views: 'web',
            systemData: { __context__: 'web', __base__: 'web.' },
        })).toBe(true);
        expect(vm.getContextRevision()).toBe('rev-new');
        expect((window as any).APP_CONFIGS.view.systemData.__base__).toBe('web.');
        expect(vm.applyViewContext({ revision: 'rev-new' })).toBe(false);
    });

    it('ViewManager requires a document reload when the view namespace changes', () => {
        const vm = new ViewManager({} as any);
        vm.init({ revision: 'rev-old', contextViews: 'web' });

        expect(vm.requiresReloadForViewContext({
            revision: 'rev-new',
            views: 'themes.storefront',
        })).toBe(true);
        expect(vm.applyViewContext({
            revision: 'rev-new',
            views: 'themes.storefront',
        })).toBe(false);
        expect(vm.getContextRevision()).toBe('rev-old');
    });

    it('Router atomically replaces routes and retries the active URL', async () => {
        const mountView = vi.fn(async () => ({ type: 'success' }));
        const vm = {
            applyViewContext: vi.fn(() => true),
            mountView,
            consumeSSRViewId: vi.fn(() => null),
            getCurrentView: vi.fn(() => null),
            cancelNavigation: vi.fn(),
        } as any;
        const router = new Router();
        router.setViewManager(vm);
        router.init({ routes: [{ name: 'home', path: '/', component: 'web.pages.home' }] });
        router.start(true);

        window.dispatchEvent(new CustomEvent('saola:view-context', {
            detail: {
                context: 'web',
                revision: 'rev-new',
                changed: true,
                routes: [{ name: 'home', path: '/', component: 'themes.storefront.pages.home' }],
                systemData: { __context__: 'web', __base__: 'themes.storefront.' },
            },
        }));

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(vm.applyViewContext).toHaveBeenCalledOnce();
        expect(mountView).toHaveBeenCalledWith(
            'themes.storefront.pages.home',
            {},
            expect.anything(),
            'push',
        );
        router.destroy();
    });

    it('Router reloads the target document instead of applying a different namespace', () => {
        const vm = {
            requiresReloadForViewContext: vi.fn(() => true),
            applyViewContext: vi.fn(),
            cancelNavigation: vi.fn(),
            getCurrentView: vi.fn(() => null),
        } as any;
        const router = new Router();
        const reload = vi.fn();
        (router as any).reloadForViewContext = reload;
        router.setViewManager(vm);
        router.init({ routes: [{ name: 'home', path: '/', component: 'web.pages.home' }] });
        router.start(true);

        const state = {
            context: 'web',
            revision: 'rev-new',
            changed: true,
            views: 'themes.storefront',
            routes: [{ name: 'home', path: '/', component: 'themes.storefront.pages.home' }],
        };
        window.dispatchEvent(new CustomEvent('saola:view-context', { detail: state }));

        expect(vm.cancelNavigation).toHaveBeenCalledOnce();
        expect(reload).toHaveBeenCalledWith('/', state);
        expect(vm.applyViewContext).not.toHaveBeenCalled();
        router.destroy();
    });

    it('Router stops a repeated reload loop for the same revision and URL', () => {
        const showError = vi.fn();
        const router = new Router();
        router.setViewManager({ showError } as any);
        window.sessionStorage.setItem('saola:view-context-reload', JSON.stringify({
            token: 'rev-new:/',
            at: Date.now(),
        }));

        (router as any).reloadForViewContext('/', { revision: 'rev-new' });

        expect(showError).toHaveBeenCalledOnce();
    });

    it('HttpService sends the revision and publishes a changed context', async () => {
        const received: Record<string, any>[] = [];
        const listener = (event: Event) => received.push((event as CustomEvent).detail);
        window.addEventListener('saola:view-context', listener);
        const fetchMock = vi.fn(async (_url: string, config: RequestInit) => {
            const headers = config.headers as Record<string, string>;
            expect(headers['X-Saola-View-Revision']).toBe('rev-old');
            expect(headers['X-Sao-Response']).toBe('json');
            return new Response(JSON.stringify({
                data: { ok: true },
                viewContext: {
                    context: 'web',
                    revision: 'rev-new',
                    changed: true,
                    routes: [],
                    systemData: { __context__: 'web' },
                },
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        });
        vi.stubGlobal('fetch', fetchMock);

        const response = await new HttpService().get('/context-aware');

        expect((response.data as any).data.ok).toBe(true);
        expect(received).toHaveLength(1);
        expect(received[0].revision).toBe('rev-new');
        window.removeEventListener('saola:view-context', listener);
    });
});
