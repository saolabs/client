/**
 * Full-page hydrate boot — Phase 6.3
 *
 * Kiểm tra contract boot:
 *   1. readSSRBoot() đọc <script data-ref="saola-ssr"> → { view, viewId }
 *   2. ViewManager.consumeSSRViewId() trả id 1 lần rồi null (consume-once)
 *   3. Router.start(): route ĐẦU TIÊN khớp SSR entry → hydrateView (claim DOM);
 *      navigate sau → mountView (CSR / SPA takeover)
 *
 * Tham chiếu: RUNTIME_CONTRACT.md §6, bootstrap/ssr.ts, ViewManager.consumeSSRViewId
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Router } from '../../src/core/routers/Router';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';
import { readSSRBoot, readBootConfig, mergeBootConfig } from '../../src/core/bootstrap/ssr';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper'))   app.instance('Helper', new HelperService(app() as any));

const HOME_ID = 'vssr-home1';

// Standalone home page: state counter + Output + button (chứng minh reactivity sau boot)
function makeHomeFactory() {
    return () => {
        const view = new View('web.home', 'view');
        const ctrl = view.__ctrl__;
        const __STATE__ = ctrl.states;
        const set$count = __STATE__.__.register('count');
        let count: any = null;
        const setCount = (s: any) => { count = s; set$count(s); };
        __STATE__.__.setters.setCount = setCount;
        const update$count = (v: any) => {
            if (__STATE__.__.canUpdateStateByKey) { __STATE__.__.updateStateByKey('count', v); count = v; }
        };
        ctrl.setUserDefinedConfig({ inc() { setCount(count + 1); } });
        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() { update$count(0); __STATE__.__.lockUpdateRealState(); },
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('home-div', 'div', p,
                        { attrs: { id: { type: 'static', value: 'home-page' } } },
                        (p2: any) => [
                            this.html('cnt-h', 'h1', p2, {}, (p3: any) => [
                                this.text('Count: '),
                                this.output('cnt-out', p3, true, ['count'], () => count),
                            ]),
                            this.html('inc', 'button', p2, {
                                events: { click: [{ handler: 'inc', params: [] }] },
                            }, () => [this.text('+')]),
                        ]),
                ]);
            },
        } as any);
        return view;
    };
}

function makeAboutFactory() {
    return () => {
        const view = new View('web.about', 'view');
        view.__ctrl__.setup({
            superView: null, data: {},
            commitConstructorData() {}, updateVariableData() {}, prerender() { return null; },
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

const REGISTRY = { 'web.home': makeHomeFactory(), 'web.about': makeAboutFactory() };
const ROUTES = [
    { path: '/', component: 'web.home' },
    { path: '/about', component: 'web.about' },
];

const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// ─── readSSRBoot ──────────────────────────────────────────────────────────────

describe('readSSRBoot', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('parse script saola-ssr hợp lệ', () => {
        const s = document.createElement('script');
        s.type = 'application/json';
        s.setAttribute('data-ref', 'saola-ssr');
        s.textContent = JSON.stringify({ container: '#app-root', view: 'web.home', viewId: HOME_ID });
        document.body.appendChild(s);

        const info = readSSRBoot();
        expect(info).not.toBeNull();
        expect(info!.view).toBe('web.home');
        expect(info!.viewId).toBe(HOME_ID);
        expect(info!.container).toBe('#app-root');
    });

    it('không có script → null (CSR boot)', () => {
        expect(readSSRBoot()).toBeNull();
    });

    it('JSON thiếu view/viewId → null', () => {
        const s = document.createElement('script');
        s.type = 'application/json';
        s.setAttribute('data-ref', 'saola-ssr');
        s.textContent = JSON.stringify({ container: '#app-root' });
        document.body.appendChild(s);
        expect(readSSRBoot()).toBeNull();
    });
});

// ─── readBootConfig / mergeBootConfig (routes + container từ APP_CONFIGS) ──────

describe('readBootConfig', () => {
    afterEach(() => { delete (window as any).APP_CONFIGS; });

    it('map APP_CONFIGS → { view.container, router.routes }', () => {
        (window as any).APP_CONFIGS = {
            container: '#app-root',
            view: {
                ssrData: {
                    'web.home': { instances: { 'v-home': { viewId: 'v-home' } } },
                },
            },
            router: {
                mode: 'history',
                allRoutes: [
                    { name: 'home', path: '/', params: [], component: 'web.home' },
                    { name: 'about', path: '/about', params: [], component: 'web.about' },
                ],
            },
        };
        const cfg = readBootConfig();
        expect(cfg).not.toBeNull();
        expect(cfg!.view.container).toBe('#app-root');
        expect(cfg!.view.ssrData['web.home'].instances['v-home'].viewId).toBe('v-home');
        expect(cfg!.router.mode).toBe('history');
        expect(cfg!.router.routes).toHaveLength(2);
        expect(cfg!.router.routes[0].component).toBe('web.home');
    });

    it('không có APP_CONFIGS → null', () => {
        expect(readBootConfig()).toBeNull();
    });

    it('APP_CONFIGS không có router → chỉ view', () => {
        (window as any).APP_CONFIGS = { container: '#app-root' };
        const cfg = readBootConfig();
        expect(cfg!.view.container).toBe('#app-root');
        expect(cfg!.router).toBeUndefined();
    });
});

describe('mergeBootConfig', () => {
    it('config app override boot, giữ key boot không bị override', () => {
        const boot = { view: { container: '#app-root' }, router: { mode: 'history', routes: [1, 2] } };
        const explicit = { view: { container: '#custom' } };
        const merged = mergeBootConfig(boot, explicit);
        // container app thắng
        expect(merged.view.container).toBe('#custom');
        // routes từ boot giữ nguyên
        expect(merged.router.routes).toEqual([1, 2]);
    });

    it('override thay nguyên giá trị non-object (array)', () => {
        const merged = mergeBootConfig({ router: { routes: [1] } }, { router: { routes: [2, 3] } });
        expect(merged.router.routes).toEqual([2, 3]);
    });
});

// ─── ViewManager.consumeSSRViewId ─────────────────────────────────────────────

describe('ViewManager.consumeSSRViewId', () => {
    let vm: ViewManager;
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        vm.init({ container, registry: REGISTRY, ssr: { view: 'web.home', viewId: HOME_ID } });
    });
    afterEach(() => {
        document.body.innerHTML = '';
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
    });

    it('trả viewId đúng entry, rồi consume (lần 2 null)', () => {
        expect(vm.hasSSRBoot()).toBe(true);
        expect(vm.consumeSSRViewId('web.home')).toBe(HOME_ID);
        // consumed → lần sau null, hasSSRBoot false
        expect(vm.consumeSSRViewId('web.home')).toBeNull();
        expect(vm.hasSSRBoot()).toBe(false);
    });

    it('view không khớp entry → null (không consume)', () => {
        expect(vm.consumeSSRViewId('web.about')).toBeNull();
        expect(vm.hasSSRBoot()).toBe(true);
    });
});

// ─── Router boot: hydrate route đầu, mount route sau ──────────────────────────

describe('Router boot hydration', () => {
    let container: HTMLElement;
    let vm: ViewManager;
    let router: Router;

    beforeEach(() => {
        // SSR DOM cho home (format chuẩn §5.1) trong container #app-root
        container = document.createElement('div');
        container.id = 'app-root';
        container.innerHTML = `
            <!--s:v:${HOME_ID}-s-->
            <div class="${HOME_ID}-home-div" id="home-page">
                <h1 class="${HOME_ID}-cnt-h">Count: <!--s:o:${HOME_ID}-cnt-out-s-->0<!--s:o:${HOME_ID}-cnt-out-e--></h1>
                <button class="${HOME_ID}-inc">+</button>
            </div>
            <!--s:v:${HOME_ID}-e-->
        `;
        document.body.appendChild(container);

        vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({ container, registry: REGISTRY, ssr: { view: 'web.home', viewId: HOME_ID } });

        router = new Router(app() as any);
        router.setViewManager(vm);
        router.configure({ mode: 'history', routes: ROUTES });
        (app() as any).set('Router', router);

        window.history.pushState({}, '', '/');
    });

    afterEach(() => {
        if ((router as any)?.isStarted) router.stop();
        document.body.innerHTML = '';
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
        (app() as any).unset?.('View');
        (app() as any).unset?.('Router');
    });

    it('route đầu "/" → HYDRATE: claim DOM home server (cùng reference, không tạo mới)', async () => {
        const ssrHome = container.querySelector('#home-page')!;
        const ssrBtn = container.querySelector('button')!;
        expect(ssrHome).not.toBeNull();

        router.start();
        await frame();

        // Claim: cùng node, không duplicate
        expect(container.querySelector('#home-page')).toBe(ssrHome);
        expect(container.querySelector('button')).toBe(ssrBtn);
        expect(container.querySelectorAll('#home-page').length).toBe(1);
        // Output giữ "0"
        expect(container.querySelector('h1')!.textContent).toContain('0');
        // SSR boot đã consume
        expect(vm.hasSSRBoot()).toBe(false);
    });

    it('sau hydrate: click → reactivity hoạt động (count 0→1)', async () => {
        router.start();
        await frame();

        container.querySelector('button')!.click();
        await frame();
        expect(container.querySelector('h1')!.textContent).toContain('1');
    });

    it('navigate /about (route thứ 2) → MOUNT (CSR), không hydrate', async () => {
        router.start();
        await frame();
        expect(container.querySelector('#home-page')).not.toBeNull();

        router.navigate('/about');
        await frame();

        expect(container.querySelector('#about-page')).not.toBeNull();
        expect(container.textContent).toContain('About Page');
    });
});
