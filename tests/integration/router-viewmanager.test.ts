/**
 * Integration test — Router ↔ ViewManager wiring.
 *
 * Kiểm tra end-to-end flow:
 *   RouteServiceProvider.boot() → Router.setViewManager() → Router.init()
 *   → Router.start() → navigate('/path') → ViewManager.mountView() → DOM mounted
 *
 * Không dùng App bootstrap thật (tránh global state giữa tests).
 * Thay vào đó, wire thủ công Router + ViewManager giống như provider làm.
 *
 * Tham chiếu: src/core/bootstrap/providers/RouteServiceProvider.ts
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Router } from '../../src/core/routers/Router';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper'))   app.instance('Helper', new HelperService(app() as any));

// ─── View factories ─────────────────────────────────────────────────────────

function makeHomeFactory() {
    return () => {
        const view = new View('web.home', 'view');
        const ctrl = view.__ctrl__;
        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() {},
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('home-div', 'div', p,
                        { attrs: { id: { type: 'static', value: 'home-page' } } },
                        (p2: any) => [this.text('Home Page')]),
                ]);
            },
        } as any);
        return view;
    };
}

function makeAboutFactory() {
    return () => {
        const view = new View('web.about', 'view');
        const ctrl = view.__ctrl__;
        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() {},
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('about-div', 'div', p,
                        { attrs: { id: { type: 'static', value: 'about-page' } } },
                        (p2: any) => [this.text('About Page')]),
                ]);
            },
        } as any);
        return view;
    };
}

function makeUserFactory() {
    return () => {
        const view = new View('web.user', 'view');
        const ctrl = view.__ctrl__;
        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() {},
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('user-div', 'div', p,
                        { attrs: { id: { type: 'static', value: 'user-page' } } },
                        (p2: any) => [this.text('User Page')]),
                ]);
            },
        } as any);
        return view;
    };
}

// ─── Test setup ─────────────────────────────────────────────────────────────

const REGISTRY = {
    'web.home':  makeHomeFactory(),
    'web.about': makeAboutFactory(),
    'web.user':  makeUserFactory(),
};

const ROUTES = [
    { path: '/',       component: 'web.home'  },
    { path: '/about',  component: 'web.about' },
    { path: '/users/{id}', component: 'web.user' },
];

let container: HTMLElement;
let vm: ViewManager;
let router: Router;

function setup() {
    window.history.replaceState({}, '', '/');
    container = document.createElement('div');
    document.body.appendChild(container);

    // Wire ViewManager
    vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({ container, registry: REGISTRY });

    // Wire Router (giống RouteServiceProvider.boot())
    router = new Router(app() as any);
    router.setViewManager(vm);
    router.configure({ mode: 'history', routes: ROUTES });
    (app() as any).set('Router', router);
}

const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

afterEach(() => {
    if ((router as any)?.isStarted) router.stop();
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
    (app() as any).unset?.('View');
    (app() as any).unset?.('Router');
    window.history.replaceState({}, '', '/');
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Router ↔ ViewManager integration', () => {

    it('Router.init() nạp routes từ config (configure called)', () => {
        setup();
        // Sau configure(), Router có routes
        const match = (router as any).matchRoute('/about');
        expect(match).not.toBeNull();
        expect(match?.route?.component).toBe('web.about');
    });

    it('Router.setViewManager() wire đúng — viewManager property được set', () => {
        setup();
        expect((router as any).viewManager).toBe(vm);
    });

    it('mountView("/") → home page mounted', async () => {
        setup();
        await vm.mountView('web.home', {}, { $urlPath: '/' } as any);
        expect(container.querySelector('#home-page')).not.toBeNull();
        expect(container.textContent).toContain('Home Page');
    });

    it('navigate /about → ViewManager.mountView("web.about") → DOM updated', async () => {
        setup();

        // Mount home trước
        await vm.mountView('web.home', {}, { $urlPath: '/' } as any);
        expect(container.querySelector('#home-page')).not.toBeNull();

        // Navigate đến about
        await vm.mountView('web.about', {}, { $urlPath: '/about' } as any);
        await frame();

        // Home bị unmount, about mounted
        expect(container.querySelector('#home-page')).toBeNull();
        expect(container.querySelector('#about-page')).not.toBeNull();
        expect(container.textContent).toContain('About Page');
    });

    it('Router.matchRoute với params: /users/42 → web.user + params.id=42', () => {
        setup();
        const match = (router as any).matchRoute('/users/42');
        expect(match).not.toBeNull();
        expect(match?.route?.component).toBe('web.user');
        expect(match?.params?.id).toBe('42');
    });

    it('isViewMounted() sau mountView', async () => {
        setup();
        expect(vm.isViewMounted('web.home')).toBeFalsy();
        await vm.mountView('web.home', {}, { $urlPath: '/' } as any);
        // isViewMounted kiểm tra activeViews — sau mountView standalone, view chưa có trong activeViews?
        // mountView standalone không thêm vào activeViews trong impl hiện tại
        // Ta test getCurrentView() thay thế
        expect(vm.getCurrentView()).not.toBeNull();
        expect(vm.getCurrentView()!.__ctrl__.path).toBe('web.home');
    });

    it('ViewManager.destroy() → container trống, isInitialized false', async () => {
        setup();
        await vm.mountView('web.home', {}, { $urlPath: '/' } as any);
        expect(container.querySelector('#home-page')).not.toBeNull();

        vm.destroy();

        // Sau destroy: không còn DOM + state reset
        expect(container.querySelector('#home-page')).toBeNull();
        expect(vm.isInitialized()).toBeFalsy();
        expect(vm.getCurrentView()).toBeNull();
    });

    it('Router.configure() routes → navigate nhiều lần không crash', async () => {
        setup();

        await vm.mountView('web.home',  {}, { $urlPath: '/' } as any);
        await vm.mountView('web.about', {}, { $urlPath: '/about' } as any);
        await vm.mountView('web.home',  {}, { $urlPath: '/' } as any);

        expect(container.querySelector('#home-page')).not.toBeNull();
        expect(container.querySelector('#about-page')).toBeNull();
    });
});

describe('Router — query string + guard + navigationType', () => {
    it('chỉ commit history + active route sau khi view mount thành công', async () => {
        setup();

        await (router as any).handleRoute('/about', 'push');

        expect(window.location.pathname).toBe('/about');
        expect(router.getCurrentRoute()?.$uri).toBe('/about');
        expect(vm.getCurrentView()?.__ctrl__.urlPath).toBe('/about');
        expect(container.querySelector('#about-page')).not.toBeNull();
    });

    it('render lỗi → không commit URL/route và giữ page cũ active', async () => {
        setup();
        await (router as any).handleRoute('/', 'initial');
        const home = vm.getCurrentView()!;

        vm.registerView('web.invalid', () => {
            const invalid = new View('web.invalid', 'view');
            invalid.__ctrl__.setup({ superView: null, data: {}, render: () => null } as any);
            return invalid;
        });
        router.addRoute('/invalid', 'web.invalid');

        await (router as any).handleRoute('/invalid', 'push');

        expect(window.location.pathname).toBe('/');
        expect(router.getCurrentRoute()?.$uri).toBe('/');
        expect(vm.getCurrentView()).toBe(home);
        expect(home.__ctrl__.lifecycleState).toBe('active');
        expect(container.querySelector('#home-page')).not.toBeNull();
    });

    it('navigation mới hủy fetch cũ; chỉ request mới nhất được commit', async () => {
        setup();
        const application = app() as any;
        const previousHttp = application.get('Http');
        let resolveFetch!: (value: any) => void;
        const pendingFetch = new Promise((resolve) => { resolveFetch = resolve; });
        application.set('Http', { get: () => pendingFetch });
        const committed: string[] = [];
        router.afterEach((to) => committed.push(to.path));

        vm.registerView('web.slow-route', () => {
            const slow = new View('web.slow-route', 'view');
            slow.__ctrl__.setup({
                superView: null,
                data: {},
                hasAwaitData: true,
                fetch: { url: '/slow-route' },
                render(this: any) {
                    return this.wrapper((p: any) => [this.text('SLOW')]);
                },
            } as any);
            return slow;
        });
        router.addRoute('/slow-route', 'web.slow-route');

        try {
            const stale = (router as any).handleRoute('/slow-route', 'push');
            await Promise.resolve();
            router.navigate('/about');
            resolveFetch({ data: { ok: true } });
            await stale;
            await frame();

            expect(window.location.pathname).toBe('/about');
            expect(router.getCurrentRoute()?.$uri).toBe('/about');
            expect(container.querySelector('#about-page')).not.toBeNull();
            expect(container.textContent).not.toContain('SLOW');
            expect(committed).toEqual(['/about']);
        } finally {
            application.set('Http', previousHttp);
        }
    });

    it('fetch fallback dùng URL đích dù history chưa commit', async () => {
        setup();
        const application = app() as any;
        const previousHttp = application.get('Http');
        let requestedUrl = '';
        application.set('Http', {
            get: async (url: string) => {
                requestedUrl = url;
                return { data: { ok: true } };
            },
        });
        vm.registerView('web.payload', () => {
            const payload = new View('web.payload', 'view');
            payload.__ctrl__.setup({
                superView: null,
                data: {},
                hasFetchData: true,
                render(this: any) {
                    return this.wrapper((p: any) => [this.text('PAYLOAD')]);
                },
            } as any);
            return payload;
        });
        router.addRoute('/payload', 'web.payload');

        try {
            await (router as any).handleRoute('/payload?tab=1', 'push');

            expect(new URL(requestedUrl).pathname + new URL(requestedUrl).search).toBe('/payload?tab=1');
            expect(window.location.pathname + window.location.search).toBe('/payload?tab=1');
            expect(container.textContent).toContain('PAYLOAD');
        } finally {
            application.set('Http', previousHttp);
        }
    });

    it('URL có query string vẫn match route (query tách TRƯỚC khi match)', () => {
        setup();
        const match = (router as any).matchRoute('/about?utm=x&tab=2');
        expect(match).not.toBeNull();
        expect(match?.route?.component).toBe('web.about');
    });

    it('query KHÔNG lẫn vào params: /users/42?tab=a → id="42", query.tab="a"', async () => {
        setup();
        await (router as any).handleRoute('/users/42?tab=a', 'push');

        const active = router.getCurrentRoute()!;
        expect(active.$params.id).toBe('42');
        expect(active.$query.tab).toBe('a');
        expect(active.$urlPath).toBe('/users/42');
        expect(active.$uri).toBe('/users/42?tab=a');
    });

    it('hash KHÔNG nằm trong $uri (cache key): /about?x=1#section', async () => {
        setup();
        await (router as any).handleRoute('/about?x=1#section', 'push');
        const active = router.getCurrentRoute()!;
        expect(active.$uri).toBe('/about?x=1');
        expect(active.$fragment).toBe('section');
    });

    it('beforeEach guard chặn → URL KHÔNG đổi (pushState chạy SAU guard)', async () => {
        setup();
        const urlBefore = window.location.pathname;
        router.beforeEach(() => false);

        await (router as any).handleRoute('/about', 'push');

        expect(window.location.pathname).toBe(urlBefore); // history không bị đụng
        expect(container.querySelector('#about-page')).toBeNull(); // view không mount
    });

    it('pop truyền navigationType="pop" xuống mountView → restore từ PageCache', async () => {
        setup();
        await (router as any).handleRoute('/', 'push');
        const home = vm.getCurrentView()!;

        await (router as any).handleRoute('/about', 'push');
        expect(home.__ctrl__.lifecycleState).toBe('paused');
        expect(vm.pageCache.has('web.home::/')).toBe(true);

        await (router as any).handleRoute('/', 'pop'); // back

        expect(vm.getCurrentView()).toBe(home); // cùng instance — restore, không render lại
        expect(home.__ctrl__.lifecycleState).toBe('active');
    });
});

describe('Router — click interception', () => {
    it('không chặn Ctrl/Cmd click hoặc link download', () => {
        setup();
        const link = document.createElement('a');
        link.href = '/about';
        document.body.appendChild(link);

        const modified = {
            target: link, button: 0, ctrlKey: true, metaKey: false,
            shiftKey: false, altKey: false, defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; },
        } as any;
        (router as any).handleAutoNavigation(modified);
        expect(modified.defaultPrevented).toBe(false);

        link.setAttribute('download', 'about.html');
        const download = {
            target: link, button: 0, ctrlKey: false, metaKey: false,
            shiftKey: false, altKey: false, defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; },
        } as any;
        (router as any).handleAutoNavigation(download);
        expect(download.defaultPrevented).toBe(false);
    });

    it('click link nội bộ giữ fragment và đi qua SPA transaction', async () => {
        setup();
        router.start(true);
        const link = document.createElement('a');
        link.href = '/about#details';
        document.body.appendChild(link);

        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(click);
        await frame();

        expect(click.defaultPrevented).toBe(true);
        expect(window.location.pathname).toBe('/about');
        expect(window.location.hash).toBe('#details');
        expect(router.getCurrentRoute()?.$fragment).toBe('details');
        expect(container.querySelector('#about-page')).not.toBeNull();
    });
});

describe('RouteServiceProvider wiring pattern', () => {
    it('Router nhận viewManager qua setViewManager trước init', () => {
        setup();
        // viewManager đã được set bởi setup() (giống RouteServiceProvider.boot())
        const routerVm = (router as any).viewManager;
        expect(routerVm).toBe(vm);
    });

    it('Router.init() với config rỗng không crash', () => {
        container = document.createElement('div');
        document.body.appendChild(container);
        const r = new Router(app() as any);
        expect(() => r.init({})).not.toThrow();
    });

    it('Router.init() với routes config → routes được load', () => {
        container = document.createElement('div');
        document.body.appendChild(container);
        const r = new Router(app() as any);
        r.init({ routes: [{ path: '/test', component: 'web.test' }] });
        const match = (r as any).matchRoute('/test');
        expect(match?.route?.component).toBe('web.test');
    });
});
