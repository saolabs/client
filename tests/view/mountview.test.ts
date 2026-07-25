/**
 * Integration tests cho ViewManager.mountView — standalone pages (Phase 2c).
 * Luồng: mount mới → navigate (pause+cache) → back (restore) → TTL.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';

if (!app.has('Registry')) {
    app.instance('Registry', MarkerRegistry);
}

/** Factory giống compiled output: view có 1 state msg + 1 output + 1 button tăng count */
function makePageFactory(pathName: string, initialMsg: string) {
    return () => {
        const view = new View(pathName, 'view');
        const ctrl = view.__ctrl__;
        const manager: any = ctrl.states.__;
        manager.useState(initialMsg, 'msg');
        manager.useState(0, 'count');

        ctrl.setUserDefinedConfig({
            increment() {
                manager.updateStateByKey('count', manager.states['count'].value + 1);
            },
        });

        ctrl.setup({
            superView: null,
            data: {},
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html(`pg-${pathName}`, 'div', parent, {}, (p: any) => [
                        this.output(`o-msg`, p, true, ['msg'], () => manager.states['msg'].value),
                        this.output(`o-count`, p, true, ['count'], () => ` c=${manager.states['count'].value}`),
                        this.html(`btn`, 'button', p, {
                            events: { click: [{ handler: 'increment', params: [] }] },
                        }, (p2: any) => [this.text('+')]),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

function makePrerenderPageFactory() {
    return () => {
        const view = new View('web.slow', 'view');
        const ctrl = view.__ctrl__;
        ctrl.setup({
            superView: null,
            data: {},
            hasAwaitData: true,
            hasPrerender: true,
            fetch: { url: '/slow' },
            prerender: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('slow-loading', 'section', parent, {}, () => [this.text('LOADING')]),
                ]);
            },
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('slow-main', 'main', parent, {}, () => [this.text('STALE MAIN')]),
                ]);
            },
        } as any);
        return view;
    };
}

function makeAwaitPageFactory() {
    return () => {
        const view = new View('web.await', 'view');
        view.__ctrl__.setup({
            superView: null,
            data: {},
            hasAwaitData: true,
            fetch: { url: '/await' },
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('await-main', 'main', parent, {}, () => [this.text('AWAIT MAIN')]),
                ]);
            },
        } as any);
        return view;
    };
}

function createManager() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    vm.init({
        container,
        registry: {
            'web.a': makePageFactory('web.a', 'pageA'),
            'web.b': makePageFactory('web.b', 'pageB'),
        },
    });
    return { vm, container };
}

const route = (url: string) => ({ $urlPath: url } as any);

function frame(): Promise<void> {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

describe('mountView — standalone', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('mount → DOM hiện + commitData + start (events hoạt động, onMounted fire)', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.a', {}, route('/a'));

        expect(container.textContent).toContain('pageA');
        expect(container.textContent).toContain('c=0');

        // Event + reactive
        container.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        expect(container.textContent).toContain('c=1');
    });

    it('navigate đi: trang cũ pause + vào PageCache (key = viewName::uri); trang mới mount', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.a', {}, route('/a'));
        const pageA = vm.getCurrentView()!;

        await vm.mountView('web.b', {}, route('/b'), 'push');

        expect(container.textContent).toContain('pageB');
        expect(container.textContent).not.toContain('pageA');
        expect(pageA.__ctrl__.lifecycleState).toBe('paused');
        expect(vm.pageCache.has('web.a::/a')).toBe(true);
    });

    it('back (pop): restore từ cache — giữ nguyên instance + state, không render lại', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.a', {}, route('/a'));
        const pageA = vm.getCurrentView()!;

        // Tăng count = 2 (state user tạo ra)
        container.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        container.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        expect(container.textContent).toContain('c=2');

        await vm.mountView('web.b', {}, route('/b'), 'push');
        await vm.mountView('web.a', {}, route('/a'), 'pop'); // back

        // CÙNG instance, state c=2 còn nguyên — không gọi lại API/render
        expect(vm.getCurrentView()).toBe(pageA);
        expect(pageA.__ctrl__.lifecycleState).toBe('active');
        expect(container.textContent).toContain('c=2');
        expect(vm.pageCache.has('web.a::/a')).toBe(false); // đã take ra khỏi cache

        // Event vẫn hoạt động sau restore
        container.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        expect(container.textContent).toContain('c=3');
    });

    it('push tới URL đã cache TRONG TTL → restore instance (bfcache theo name+URI)', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.a', {}, route('/a'));
        const firstA = vm.getCurrentView()!;
        container.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        expect(container.textContent).toContain('c=1');

        await vm.mountView('web.b', {}, route('/b'), 'push');
        await vm.mountView('web.a', {}, route('/a'), 'push'); // click link trong TTL

        // Trong TTL: restore cùng instance + state — không render lại, không gọi API
        expect(vm.getCurrentView()).toBe(firstA);
        expect(firstA.__ctrl__.lifecycleState).toBe('active');
        expect(container.textContent).toContain('c=1');
    });

    it('cùng URI nhưng KHÁC query → cache key khác, mount instance mới', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.a', {}, route('/a?tab=1'));
        const firstA = vm.getCurrentView()!;

        await vm.mountView('web.a', {}, route('/a?tab=2'), 'push');

        const secondA = vm.getCurrentView()!;
        expect(secondA === firstA).toBe(false);            // query khác → trang khác
        expect(firstA.__ctrl__.lifecycleState).toBe('paused'); // bản tab=1 vào cache
        expect(vm.pageCache.has('web.a::/a?tab=1')).toBe(true);
        expect(container.textContent).toContain('pageA');
    });

    it('TTL: trang paused quá hạn (mặc định 10 phút) bị destroy, back sau đó mount mới', async () => {
        const { vm, container } = createManager();
        let time = 1_000_000;
        vm.pageCache.now = () => time;

        await vm.mountView('web.a', {}, route('/a'));
        const pageA = vm.getCurrentView()!;
        await vm.mountView('web.b', {}, route('/b'), 'push');
        expect(vm.pageCache.has('web.a::/a')).toBe(true);

        time += 11 * 60 * 1000; // 11 phút > defaultTTL 10 phút

        await vm.mountView('web.a', {}, route('/a'), 'pop'); // back sau khi hết TTL

        expect(pageA.__ctrl__.lifecycleState).toBe('destroyed'); // bản cache bị destroy do TTL
        expect(vm.getCurrentView() === pageA).toBe(false);        // mount instance mới
        expect(container.textContent).toContain('pageA');
    });

    it('duplicate guard: mount lại đúng URL đang đứng → no-op', async () => {
        const { vm } = createManager();
        await vm.mountView('web.a', {}, route('/a'));
        const pageA = vm.getCurrentView()!;
        const result = await vm.mountView('web.a', {}, route('/a'), 'push');
        expect(result).toBeNull();
        expect(vm.getCurrentView()).toBe(pageA);
    });

    it('prerender resolve trên route hiện tại → swap skeleton sang main', async () => {
        const application = app() as any;
        const previousHttp = application.get('Http');
        let resolveFetch!: (value: any) => void;
        const pending = new Promise((resolve) => { resolveFetch = resolve; });
        application.set('Http', { get: () => pending });

        try {
            const { vm, container } = createManager();
            vm.registerView('web.slow', makePrerenderPageFactory());

            await vm.mountView('web.slow', {}, route('/slow'));
            expect(container.textContent).toContain('LOADING');
            expect(vm.getCurrentView()?.__ctrl__.lifecycleState).toBe('active');

            resolveFetch({ data: { ready: true } });
            await pending;
            await frame();

            expect(container.textContent).toContain('STALE MAIN');
            expect(container.textContent).not.toContain('LOADING');
        } finally {
            application.set('Http', previousHttp);
        }
    });

    it('prerender resolve sau khi đổi route → không được ghi đè DOM route mới', async () => {
        const application = app() as any;
        const previousHttp = application.get('Http');
        let resolveFetch!: (value: any) => void;
        const pending = new Promise((resolve) => { resolveFetch = resolve; });
        application.set('Http', { get: () => pending });

        try {
            const { vm, container } = createManager();
            vm.registerView('web.slow', makePrerenderPageFactory());

            await vm.mountView('web.slow', {}, route('/slow'));
            const slowView = vm.getCurrentView()!;
            expect(container.textContent).toContain('LOADING');

            await vm.mountView('web.b', {}, route('/b'));
            expect(container.textContent).toContain('pageB');
            // Skeleton chưa có mainElement hoàn chỉnh nên không đưa vào PageCache;
            // controller phải destroy sạch và async response trở thành stale.
            expect(slowView.__ctrl__.lifecycleState).toBe('destroyed');

            resolveFetch({ data: { ready: true } });
            await pending;
            await frame();

            expect(container.textContent).toContain('pageB');
            expect(container.textContent).not.toContain('STALE MAIN');
            expect(vm.getCurrentView()?.__ctrl__.path).toBe('web.b');
        } finally {
            application.set('Http', previousHttp);
        }
    });

    it('await fetch của navigation cũ resolve muộn → transaction bị cancel', async () => {
        const application = app() as any;
        const previousHttp = application.get('Http');
        let resolveFetch!: (value: any) => void;
        const pending = new Promise((resolve) => { resolveFetch = resolve; });
        application.set('Http', { get: () => pending });

        try {
            const { vm, container } = createManager();
            vm.registerView('web.await', makeAwaitPageFactory());

            const staleNavigation = vm.mountView('web.await', {}, route('/await'));
            await Promise.resolve(); // cho navigation cũ đi tới điểm await Http.get()

            await vm.mountView('web.b', {}, route('/b'));
            expect(container.textContent).toContain('pageB');

            resolveFetch({ data: { ready: true } });
            const staleResult = await staleNavigation;
            await frame();

            expect(staleResult).toBeNull();
            expect(container.textContent).toContain('pageB');
            expect(container.textContent).not.toContain('AWAIT MAIN');
            expect(vm.getCurrentView()?.__ctrl__.path).toBe('web.b');
        } finally {
            application.set('Http', previousHttp);
        }
    });

    it('render lỗi → controller chưa mount được destroy sạch', async () => {
        const { vm } = createManager();
        let failedView: View | null = null;
        vm.registerView('web.invalid', () => {
            failedView = new View('web.invalid', 'view');
            failedView.__ctrl__.setup({
                superView: null,
                data: {},
                render: () => null,
            } as any);
            return failedView;
        });

        const result = await vm.mountView('web.invalid', {}, route('/invalid'));

        expect(result).toBeNull();
        expect(failedView!.__ctrl__.lifecycleState).toBe('destroyed');
        expect(vm.getCurrentView()).toBeNull();
    });

    it('render route mới lỗi → page hiện tại vẫn active và DOM không bị thay', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.a', {}, route('/a'));
        const pageA = vm.getCurrentView()!;

        vm.registerView('web.invalid', () => {
            const invalid = new View('web.invalid', 'view');
            invalid.__ctrl__.setup({ superView: null, data: {}, render: () => null } as any);
            return invalid;
        });

        const result = await vm.mountView('web.invalid', {}, route('/invalid'));

        expect(result).toBeNull();
        expect(vm.getCurrentView()).toBe(pageA);
        expect(pageA.__ctrl__.lifecycleState).toBe('active');
        expect(container.textContent).toContain('pageA');
        expect(vm.pageCache.has('web.a::/a')).toBe(false);
    });
});
