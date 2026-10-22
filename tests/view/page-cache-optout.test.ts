/**
 * View khai `@cache(false)` (compiler ghi `cache: false` vào __VIEW_CONFIG__)
 * không được đưa vào PageCache: quay lại URL đó luôn mount mới với dữ liệu tươi.
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

function factory(name: string, cache?: any) {
    return (__data__: any = {}) => {
        const view = new View(name, 'view');
        const ctrl: any = view.__ctrl__;
        if (cache !== undefined) ctrl.setStaticConfig({ cache });
        ctrl.setup({
            superView: null, data: __data__, commitConstructorData() {}, updateVariableData() {}, prerender() { return null; },
            render(this: any) { return this.wrapper((p: any) => [this.html('p', 'p', p, {}, () => [this.text(String(__data__.label ?? name))])]); },
        });
        return view;
    };
}

afterEach(() => {
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
});

describe('cấu hình cache của view', () => {
    it('cache: false → quay lại URL thì mount mới, mặc định thì restore', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({ container, registry: { 'probe.form': factory('probe.form', false), 'probe.list': factory('probe.list'), 'probe.other': factory('probe.other') } });
        const go = (name: string, url: string, data: any = {}) => vm.mountView(name, data, { $urlPath: url } as any) as Promise<any>;

        await go('probe.form', '/form', { label: 'lần 1' });
        await go('probe.list', '/list');
        const back = await go('probe.form', '/form', { label: 'lần 2' });
        expect(back?.type).not.toBe('restored');
        expect(container.textContent).toContain('lần 2');

        await go('probe.other', '/other');
        expect((await go('probe.list', '/list'))?.type).toBe('restored');
    });
});
