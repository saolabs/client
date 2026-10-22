/**
 * Regression — page extends layout phải có vòng đời đầy đủ: start → active, khi
 * rời trang thì pause vào PageCache, quay lại thì resume và bắn `resumed`.
 * Page thuộc layout không có _rootTree (cây thật là block content); start() từng
 * thoát sớm khi `blocks` chưa đăng ký → page kẹt ở 'created', pause/resume bị
 * bỏ qua, `resumed()` (mẫu nạp lại danh sách sau khi lưu form) không bao giờ chạy.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

window.scrollTo = () => {}; // jsdom chưa có; restoreFromCache gọi để cuộn trang
if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

function layoutFactory() {
    return () => {
        const view = new View('probe.layout', 'layout');
        view.__ctrl__.setup({
            superView: null, data: {}, commitConstructorData() {}, updateVariableData() {}, prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [this.html('shell', 'main', p, {}, (p2: any) => [this.blockOutlet('outlet', 'content', p2)])]);
            },
        } as any);
        return view;
    };
}

/** awaitData: mẫu compiled của view có `@await` — prerender chỉ extends layout, block thật đến sau khi dữ liệu về. */
function pageFactory(name: string, log: string[], awaitData = false) {
    return () => {
        const view = new View(name, 'view');
        const ctrl: any = view.__ctrl__;
        if (awaitData) ctrl.setStaticConfig({ hasAwaitData: true, hasPrerender: true, fetch: { url: `/data/${name}` } });
        ctrl.setup({
            superView: 'probe.layout', data: {}, commitConstructorData() {}, updateVariableData() {},
            prerender(this: any) {
                if (!awaitData) return null;
                this.superViewPath = 'probe.layout';
                return this.extendView(this.superViewPath, {});
            },
            render(this: any) {
                this.block(`b-${name}`, 'content', (pe: any) => [this.html(`p-${name}`, 'p', pe, {}, () => [this.text(name)])]);
                this.superViewPath = 'probe.layout';
                return this.extendView(this.superViewPath, {});
            },
        } as any);
        ctrl.setUserDefinedConfig({ paused: () => log.push(`${name}:paused`), resumed: () => log.push(`${name}:resumed`) });
        return view;
    };
}

afterEach(() => {
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
});

describe('page extends layout — pause/resume qua PageCache', () => {
    it('trang được kích hoạt, rời trang thì paused, quay lại thì resumed', async () => {
        const log: string[] = [];
        const container = document.createElement('div');
        document.body.appendChild(container);
        const vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({ container, registry: { 'probe.layout': layoutFactory(), 'probe.a': pageFactory('probe.a', log), 'probe.b': pageFactory('probe.b', log) } });
        const go = (name: string, url: string) => vm.mountView(name, {}, { $urlPath: url } as any) as Promise<any>;

        await go('probe.a', '/a');
        expect((vm.getCurrentView()!.__ctrl__ as any).lifecycleState).toBe('active');
        await go('probe.b', '/b');
        const back = await go('probe.a', '/a');

        expect(back?.type).toBe('restored');
        expect(log.filter(e => e.startsWith('probe.a'))).toEqual(['probe.a:paused', 'probe.a:resumed']);
        expect(container.textContent).toContain('probe.a');
    });

    it('trang @await: sau khi dữ liệu về vẫn active, quay lại thì resumed', async () => {
        const log: string[] = [];
        const container = document.createElement('div');
        document.body.appendChild(container);
        const vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        const application: any = app();
        application.set('View', vm);
        const previousHttp = application.get('Http');
        // Trả chậm như mạng thật: trang được kích hoạt TRƯỚC khi block thật kịp đăng ký.
        application.set('Http', { get: () => new Promise(r => setTimeout(() => r({ data: { data: {} } }), 20)) });
        try {
            vm.init({ container, registry: { 'probe.layout': layoutFactory(), 'probe.a': pageFactory('probe.a', log, true), 'probe.b': pageFactory('probe.b', log) } });
            const go = (name: string, url: string) => vm.mountView(name, {}, { $urlPath: url } as any) as Promise<any>;
            const settle = () => new Promise(r => setTimeout(r, 50));

            await go('probe.a', '/a');
            await settle();
            expect(container.textContent).toContain('probe.a');
            expect((vm.getCurrentView()!.__ctrl__ as any).lifecycleState).toBe('active');

            await go('probe.b', '/b');
            const back = await go('probe.a', '/a');
            expect(back?.type).toBe('restored');
            expect(log.filter(e => e.startsWith('probe.a'))).toEqual(['probe.a:paused', 'probe.a:resumed']);
        } finally {
            application.set('Http', previousHttp);
        }
    });
});
