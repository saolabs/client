/**
 * Hydration của `@foreach` KHÔNG có `@key` — chứng minh end-to-end cho lỗi
 * lệch-1 giữa hai compiler.
 *
 * sao2blade emit hậu tố `{$loop->index}` (Laravel, 0-based) → marker -0,-1,-2.
 * sao2js từng emit `${__loopIndex + 1}` (1-based) → client đi tìm -1,-2,-3:
 *   item 0 claim nhầm marker của item 1  → nội dung lệch chỗ
 *   item cuối không thấy marker          → tạo node mới cạnh node server ⇒ NHÂN ĐÔI
 *
 * Test dựng đúng HTML mà Blade sinh (0-based) rồi hydrate bằng cây element mà
 * sao2js sinh, và khẳng định DOM sau hydrate KHÔNG nhân đôi, KHÔNG lệch.
 *
 * @see compiler/tests/test_loop_index_sync.py
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

const SSR_VIEW_ID = 'ssrloop1';
const ITEMS = [{ text: 'một' }, { text: 'hai' }, { text: 'ba' }];

/**
 * Cây element đúng như sao2js sinh cho:
 *   @foreach($todos as $todo) <li>{{ $todo['text'] }}</li> @endforeach
 * Hậu tố id = `__loopIndex` (0-based) — khớp `$loop->index` phía Blade.
 */
function makeFactory() {
    return (__data__: any = {}) => {
        const view = new View('web.loop', 'view');
        const ctrl = view.__ctrl__;
        const S = ctrl.states;
        // Đúng mẫu compiled: setter cập nhật CẢ closure var lẫn state slot.
        let todos: any[] = __data__.todos ?? [];
        const set$todos = S.__.register('todos', todos);
        S.__.setters.todos = (v: any[]) => { todos = v; set$todos(v); };

        ctrl.setup({
            superView: null,
            data: __data__,
            viewId: __data__.__SSR_VIEW_ID__,
            commitConstructorData() { S.__.updateStateByKey('todos', todos); S.__.lockUpdateRealState(); },
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('list-ul', 'ul', p, { attrs: { id: { type: 'static', value: 'list' } } },
                        (p2: any) => [
                            this.reactive('fe-todos', 'foreach', null, p2, ['todos'],
                                (_pr: any, pe: any) => this.__foreach(todos, (todo: any, _k: any, i: number) => [
                                    this.html(`li-${i}`, 'li', pe, {}, (p3: any) => [
                                        this.output(`out-${i}`, p3, true, [], () => String(todo.text)),
                                    ]),
                                ])),
                        ]),
                ]);
            },
        } as any);
        return view;
    };
}

/** HTML server sinh: hậu tố 0-based, đúng như `$loop->index`. */
function ssrHtml(): string {
    const rows = ITEMS.map((it, i) =>
        `<li class="${SSR_VIEW_ID}-li-${i}">`
        + `<!--s:o:${SSR_VIEW_ID}-out-${i}-s-->${it.text}<!--s:o:${SSR_VIEW_ID}-out-${i}-e-->`
        + `</li>`
    ).join('');
    return `<!--s:v:${SSR_VIEW_ID}-s-->`
        + `<ul class="${SSR_VIEW_ID}-list-ul" id="list">`
        + `<!--s:r:${SSR_VIEW_ID}-fe-todos-s-->${rows}<!--s:r:${SSR_VIEW_ID}-fe-todos-e-->`
        + `</ul>`
        + `<!--s:v:${SSR_VIEW_ID}-e-->`;
}

let container: HTMLElement;
let vm: ViewManager;
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = ssrHtml();
    document.body.appendChild(container);
    vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({ container, registry: { 'web.loop': makeFactory() } });
});

afterEach(() => {
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
    MarkerRegistry.clear();
    document.body.innerHTML = '';
});

describe('hydrate @foreach không có @key', () => {
    it('không nhân đôi item, không lệch nội dung', async () => {
        await vm.hydrateView('web.loop', { todos: ITEMS, __SSR_VIEW_ID__: SSR_VIEW_ID },
            { $urlPath: '/' } as any);
        await frame();

        // Bằng chứng hydration THẬT SỰ claim: mọi element trong registry của view
        // phải đang nằm trong DOM. Id lệch → element không tìm thấy node server
        // nên được TẠO MỚI và mồ côi (chưa gắn), rồi sẽ chèn vào ở lần update
        // kế tiếp ⇒ nhân đôi. Đây là chỗ lỗi lộ ra sớm nhất.
        const ctrl0: any = vm.getCurrentView()!.__ctrl__;
        const orphans = Array.from(ctrl0.elements.values())
            .filter((e: any) => e?.element instanceof HTMLElement && !e.element.isConnected)
            .map((e: any) => e.element.className);
        expect(orphans).toEqual([]);

        const lis = Array.from(container.querySelectorAll('#list li'));
        expect(lis.length).toBe(ITEMS.length);                       // không thừa item
        expect(lis.map(li => li.textContent)).toEqual(['một', 'hai', 'ba']);
        // Nhân đôi biểu hiện là text lặp trong CÙNG một <li> ("mộtmột")
        for (const li of lis) {
            expect(li.textContent).not.toMatch(/(.+)\1/);
        }
    });

    it('sau hydrate, cập nhật state vẫn render đúng (không sót node server)', async () => {
        await vm.hydrateView('web.loop', { todos: ITEMS, __SSR_VIEW_ID__: SSR_VIEW_ID },
            { $urlPath: '/' } as any);
        await frame();

        const ctrl: any = vm.getCurrentView()!.__ctrl__;
        ctrl.states.__.setters.todos([{ text: 'x' }, { text: 'y' }]);
        await frame();

        const lis = Array.from(container.querySelectorAll('#list li'));
        expect(lis.map(li => li.textContent)).toEqual(['x', 'y']);
    });
});
