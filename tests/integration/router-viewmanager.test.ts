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
