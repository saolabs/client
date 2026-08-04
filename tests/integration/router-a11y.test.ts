/**
 * A11y sau điều hướng SPA — full page load làm sẵn hai việc này, SPA thì không:
 *   1. focus quay về container view (bàn phím đang ở link của trang TRƯỚC)
 *   2. đọc tên trang mới qua aria-live (document không reload → AT không biết)
 *
 * @see Router.announceNavigation
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Router } from '../../src/core/routers/Router';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

function makePage(path: string, domId: string) {
    return () => {
        const view = new View(path, 'view');
        view.__ctrl__.setup({
            superView: null,
            data: {},
            commitConstructorData() {},
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html(`${domId}-div`, 'div', p,
                        { attrs: { id: { type: 'static', value: domId } } },
                        () => [this.text(domId)]),
                ]);
            },
        } as any);
        return view;
    };
}

let container: HTMLElement;
let vm: ViewManager;
let router: Router;

function setup() {
    window.history.replaceState({}, '', '/');
    container = document.createElement('div');
    document.body.appendChild(container);
    vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({ container, registry: { 'web.home': makePage('web.home', 'home-page'), 'web.about': makePage('web.about', 'about-page') } });
    router = new Router(app() as any);
    router.setViewManager(vm);
    router.configure({ mode: 'history', routes: [{ path: '/', component: 'web.home' }, { path: '/about', component: 'web.about' }] });
    (app() as any).set('Router', router);
}

const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const liveRegion = () => document.querySelector('[aria-live="polite"]');

afterEach(() => {
    router?.destroy();
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
});

describe('Router — a11y sau điều hướng', () => {
    it('đưa focus về container và announce trang mới', async () => {
        setup();
        document.title = 'Trang chủ';
        await router.navigate('/');
        await frame();

        // Giả lập user đang focus một link của trang hiện tại
        const link = document.createElement('a');
        link.href = '/about';
        document.body.appendChild(link);
        link.focus();
        expect(document.activeElement).toBe(link);

        document.title = 'Giới thiệu';
        await router.navigate('/about');
        await frame();

        // focus không được kẹt lại ở link của trang trước
        expect(document.activeElement).toBe(container);
        expect(container.getAttribute('tabindex')).toBe('-1');

        const region = liveRegion();
        expect(region).not.toBeNull();
        expect(region!.textContent).toBe('Giới thiệu');
    });

    it('không cướp focus ở lần render đầu (initial)', async () => {
        setup();
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        await (router as any).handleRoute('/', 'initial', (router as any).navigationSequence);
        await frame();

        expect(document.activeElement).toBe(input);
        expect(liveRegion()).toBeNull();
    });

    it('destroy() gỡ live region, không để rác lại DOM', async () => {
        setup();
        await router.navigate('/');
        await router.navigate('/about');
        await frame();
        expect(liveRegion()).not.toBeNull();

        router.destroy();
        expect(liveRegion()).toBeNull();
    });
});
