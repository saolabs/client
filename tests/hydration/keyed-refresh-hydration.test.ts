/**
 * Regression — hàng @foreach có @key được render từ SSR, sau hydrate nạp lại
 * dữ liệu (cùng key, nội dung đổi). Output trong hàng có stateKeys rỗng nên chỉ
 * làm mới qua render(); Output từng kẹt ở initMode HYDRATE → render() return sớm
 * mãi mãi → hàng hiện dữ liệu server cũ dù state đã đổi.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

const SSR_VIEW_ID = 'ssrkey1';
const ROWS = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];

/** Hình dạng sao2js cho @foreach(list as p) @key(p['id']) <tr><td>{{ p['name'] }}</td></tr> (reconcile). */
function makeFactory() {
    return (__data__: any = {}) => {
        const view = new View('web.rows', 'view');
        const ctrl = view.__ctrl__;
        const S = ctrl.states;
        let list: any[] = __data__.list ?? [];
        const set$list = S.__.register('list', list);
        S.__.setters.setList = (v: any[]) => { list = v; set$list(v); };
        ctrl.setup({
            superView: null,
            data: __data__,
            viewId: __data__.__SSR_VIEW_ID__,
            commitConstructorData() { S.__.updateStateByKey('list', list); S.__.lockUpdateRealState(); },
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('tb', 'tbody', p, { attrs: { id: { type: 'static', value: 'rows' } } }, (p2: any) => [
                        this.reactive('fe', 'foreach', null, p2, ['list'], (_pr: any, pe: any) =>
                            this.__foreach(list, (row: any) => [
                                this.html(`tr-${row['id']}`, 'tr', pe, {}, (p3: any) => [
                                    this.html(`td-${row['id']}`, 'td', p3, {}, (p4: any) => [
                                        this.output(`o-${row['id']}`, p4, true, [], () => row['name']),
                                    ]),
                                ]),
                            ], (row: any) => row['id'], true, 'tbody-1-foreach-1')),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

function ssrHtml(): string {
    const rows = ROWS.map(r => `<tr class="${SSR_VIEW_ID}-tr-${r.id}"><td class="${SSR_VIEW_ID}-td-${r.id}">`
        + `<!--s:o:${SSR_VIEW_ID}-o-${r.id}-s-->${r.name}<!--s:o:${SSR_VIEW_ID}-o-${r.id}-e--></td></tr>`).join('');
    return `<!--s:v:${SSR_VIEW_ID}-s--><table><tbody class="${SSR_VIEW_ID}-tb" id="rows">`
        + `<!--s:r:${SSR_VIEW_ID}-fe-s-->${rows}<!--s:r:${SSR_VIEW_ID}-fe-e-->`
        + `</tbody></table><!--s:v:${SSR_VIEW_ID}-e-->`;
}

let container: HTMLElement;
let vm: ViewManager;
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const names = () => Array.from(container.querySelectorAll('#rows td')).map(td => td.textContent);

beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = ssrHtml();
    document.body.appendChild(container);
    vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({ container, registry: { 'web.rows': makeFactory() } });
});

afterEach(() => {
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
    MarkerRegistry.clear();
    document.body.innerHTML = '';
});

describe('hydrate @foreach @key rồi nạp lại dữ liệu', () => {
    it('hàng giữ key nhưng đổi nội dung phải vẽ lại, giữ nguyên node server', async () => {
        await vm.hydrateView('web.rows', { list: ROWS, __SSR_VIEW_ID__: SSR_VIEW_ID }, { $urlPath: '/' } as any);
        await frame();
        const firstRow = container.querySelector('#rows tr');
        expect(names()).toEqual(['Alice', 'Bob']);

        const ctrl: any = vm.getCurrentView()!.__ctrl__;
        ctrl.states.__.setters.setList(JSON.parse(JSON.stringify([{ id: 'a', name: 'Alice EDITED' }, { id: 'b', name: 'Bob' }])));
        ctrl.states.__.flushNow();

        expect(names()).toEqual(['Alice EDITED', 'Bob']);
        expect(container.querySelector('#rows tr')).toBe(firstRow);
        expect(container.querySelectorAll('#rows tr')).toHaveLength(2);
    });
});
