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
        delete (window as any).APP_CONFIGS;
        document.body.innerHTML = '';
    });

    it('ViewManager applies a newer revision and ignores duplicates', () => {
        const vm = new ViewManager({} as any);
        vm.init({ revision: 'rev-old', systemData: { __context__: 'web', __base__: 'web.' } });

        expect(vm.applyViewContext({
            revision: 'rev-new',
            views: 'themes.storefront',
            systemData: { __context__: 'web', __base__: 'themes.storefront.' },
        })).toBe(true);
        expect(vm.getContextRevision()).toBe('rev-new');
        expect((window as any).APP_CONFIGS.view.systemData.__base__).toBe('themes.storefront.');
        expect(vm.applyViewContext({ revision: 'rev-new' })).toBe(false);
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
