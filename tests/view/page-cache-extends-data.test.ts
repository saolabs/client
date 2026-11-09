/**
 * Regression — trang khôi phục từ PageCache không chạy lại render(), nên
 * `extendView(layout, data)` không được gọi: layout dùng chung giữ dữ liệu
 * `@extends` của trang TRƯỚC (gehihi: `side:false` của trình soạn tệp làm mất
 * thanh bên của trang danh sách). Khôi phục phải áp lại dữ liệu đó.
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

/** Layout ghi lại mọi lần nhận dữ liệu mới, như compiled updateVariableData. */
function layoutFactory(seen: any[]) {
    return (__data__: any = {}) => {
        const view = new View('probe.layout', 'layout');
        view.__ctrl__.setup({
            superView: null, data: __data__, commitConstructorData() {}, prerender() { return null; },
            updateVariableData(newData: any) { seen.push({ ...newData }); },
            render(this: any) {
                return this.wrapper((p: any) => [this.html('shell', 'main', p, {}, (p2: any) => [this.blockOutlet('outlet', 'content', p2)])]);
            },
        } as any);
        return view;
    };
}

function pageFactory(name: string, side: boolean) {
    return () => {
        const view = new View(name, 'view');
        view.__ctrl__.setup({
            superView: 'probe.layout', data: {}, commitConstructorData() {}, updateVariableData() {}, prerender() { return null; },
            render(this: any) {
                this.block(`b-${name}`, 'content', (pe: any) => [this.html(`p-${name}`, 'p', pe, {}, () => [this.text(name)])]);
                this.superViewPath = 'probe.layout';
                return this.extendView(this.superViewPath, { side });
            },
        } as any);
        return view;
    };
}

afterEach(() => {
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
});

describe('PageCache — dữ liệu @extends của trang khôi phục', () => {
    it('quay lại trang đã cache thì layout nhận lại dữ liệu @extends của trang đó', async () => {
        const seen: any[] = [];
        const container = document.createElement('div');
        document.body.appendChild(container);
        const vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({ container, registry: { 'probe.layout': layoutFactory(seen), 'probe.list': pageFactory('probe.list', true), 'probe.editor': pageFactory('probe.editor', false) } });
        const go = (name: string, url: string) => vm.mountView(name, {}, { $urlPath: url } as any) as Promise<any>;
        const layoutSide = () => (vm.getCurrentView()!.__ctrl__ as any).superView.data.side;

        await go('probe.list', '/list');
        expect(layoutSide()).toBe(true);
        await go('probe.editor', '/editor');
        expect(layoutSide()).toBe(false);

        const back = await go('probe.list', '/list');
        expect(back?.type).toBe('restored');
        expect(layoutSide()).toBe(true);
        expect(seen[seen.length - 1]).toEqual({ side: true });
    });
});
