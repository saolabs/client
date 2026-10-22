/**
 * Regression — trang danh sách được khôi phục từ PageCache rồi nạp lại dữ liệu
 * (mẫu `resumed() { setList(await fetch()) }`): cùng `@key`, ref mới, nội dung đổi.
 * Hàng phải vẽ lại nội dung mới.
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

type Row = { id: string; name: string };

/** Hình dạng sao2js cho: @foreach(list as p) @key(p['id']) <tr><td>{{ p['name'] }}</td></tr> @endforeach */
function listFactory() {
    return (__data__: any = {}) => {
        const view = new View('probe.rows', 'view');
        const ctrl = view.__ctrl__;
        const S = ctrl.states;
        let list: Row[] = __data__.rows ?? [];
        const set$list = S.__.register('list', list);
        S.__.setters.setList = (v: Row[]) => { list = v; set$list(v); };
        ctrl.setup({
            superView: null,
            data: __data__,
            commitConstructorData() { S.__.updateStateByKey('list', list); S.__.lockUpdateRealState(); },
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((parent: any) => [
                    this.html('tbody', 'tbody', parent, { attrs: { id: { type: 'static', value: 'rows' } } }, (pe: any) => [
                        this.reactive('fe', 'foreach', null, pe, ['list'], (_pr: any, pe2: any) =>
                            this.__foreach(list, (p: Row) => [
                                this.html(`tr-${p['id']}`, 'tr', pe2, {}, (pe3: any) => [
                                    this.html(`td-${p['id']}`, 'td', pe3, {}, (pe4: any) => [
                                        this.output(`o-${p['id']}`, pe4, true, [], () => p['name']),
                                    ]),
                                ]),
                            ], (p: Row) => p['id'])),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

function otherFactory() {
    return () => {
        const view = new View('probe.other', 'view');
        view.__ctrl__.setup({
            superView: null, data: {}, commitConstructorData() {}, updateVariableData() {}, prerender() { return null; },
            render(this: any) { return this.wrapper((p: any) => [this.html('other', 'p', p, {}, () => [this.text('other')])]); },
        } as any);
        return view;
    };
}

let container: HTMLElement;
let vm: ViewManager;
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const names = () => Array.from(container.querySelectorAll('#rows td')).map(td => td.textContent);

afterEach(() => {
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
});

describe('@foreach @key — nạp lại sau khi khôi phục từ PageCache', () => {
    it('hàng giữ key nhưng đổi dữ liệu phải hiện nội dung mới', async () => {
        container = document.createElement('div');
        document.body.appendChild(container);
        vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({ container, registry: { 'probe.rows': listFactory(), 'probe.other': otherFactory() } });

        const rows = (name: string): Row[] => JSON.parse(JSON.stringify([{ id: 'a', name }, { id: 'b', name: 'Bob' }]));
        await vm.mountView('probe.rows', { rows: rows('Alice') }, { $urlPath: '/rows' } as any);
        await frame();
        expect(names()).toEqual(['Alice', 'Bob']);

        await vm.mountView('probe.other', {}, { $urlPath: '/other' } as any);
        await frame();
        const restored: any = await vm.mountView('probe.rows', {}, { $urlPath: '/rows' } as any);
        expect(restored?.type).toBe('restored');
        await frame();

        vm.getCurrentView()!.__ctrl__.states.__.setters.setList(rows('Alice EDITED'));
        await frame();
        expect(names()).toEqual(['Alice EDITED', 'Bob']);
    });
});
