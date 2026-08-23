/**
 * Hydration — echo KHÔNG reactive đứng TRƯỚC echo reactive trong CÙNG scope.
 *
 * FIX(F4, docs/FIX_PLAN_2026-08-14.md): trước đây sao2js compile MỌI `{{ }}`
 * thành `this.output()` (tiêu 1 marker id) trong khi sao2blade chỉ emit
 * marker khi có state key hoặc trong loop. `next_output()` cấp id TUẦN TỰ
 * THEO SCOPE (compiler/src/common/hydrate_id.py) — bỏ marker ở MỘT `{{ }}`
 * làm lệch id của MỌI `{{ }}` reactive đứng SAU nó cùng scope.
 *
 * Bài test này dựng DOM ĐÚNG NHƯ BLADE THẬT SỰ SINH RA cho:
 *   @states({ count: 0 })
 *   @let(label = 'Total')
 *   <p>{{ label }}: {{ count }}</p>
 * rồi hydrate — verify hành vi RUNTIME, không chỉ so chuỗi compiler
 * (compiler/tests/test_state_output_marker_sync.py đã guard phần compile).
 *
 * Trước fix, hậu quả không chỉ nhân đôi: `count`'s Output đi tìm marker
 * `count-out` (không tồn tại vì `label` đã "ăn" mất id đó ở phía JS) → tạo
 * marker mới bên cạnh text server; ĐỒNG THỜI một Output khác (được compiler
 * gán ĐÚNG id `count-out` nhưng lại ứng với `label` do lệch thứ tự) claim
 * NHẦM cặp marker của `count` → hiển thị "Total" ở vị trí của "0". Layout
 * `<p>{{ label }}: {{ count }}</p>` là bố cục cực kỳ phổ biến nên đây không
 * phải edge case.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

const SSR_VIEW_ID = 'vssr-mix01';

/**
 * Factory tương ứng ĐÚNG với output compiler SAU fix F4 cho:
 *   @states({ count: 0 })  @let(label = 'Total')  <p>{{ label }}: {{ count }}</p>
 * `{{ label }}` (không reactive) → this.text(...), KHÔNG tiêu marker.
 * `{{ count }}` (reactive)      → this.output(...), CÓ marker.
 */
function makeMixedEchoFactory() {
    return () => {
        const view = new View('web.mixed-echo-test', 'view');
        const ctrl = view.__ctrl__;
        const __STATE__ = ctrl.states;

        const set$count = __STATE__.__.register('count');
        let count: any = null;
        const setCount = (s: any) => { count = s; set$count(s); };
        __STATE__.__.setters.setCount = setCount;
        const update$count = (v: any) => {
            if (__STATE__.__.canUpdateStateByKey) {
                __STATE__.__.updateStateByKey('count', v);
                count = v;
            }
        };
        // @let(label = 'Total') — biến thường, KHÔNG reactive
        const label = 'Total';

        ctrl.setUserDefinedConfig({
            increment() { setCount(count + 1); },
        });

        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() {
                update$count(0);
                __STATE__.__.lockUpdateRealState();
            },
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('page-root', 'div', p,
                        { attrs: { id: { type: 'static', value: 'mixed-page' } } },
                        (p2: any) => [
                            this.html('p-el', 'p', p2, {}, (p3: any) => [
                                this.text(String(label)),
                                this.text(': '),
                                this.output('count-out', p3, true, ['count'], () => count),
                            ]),
                            this.html('inc-btn', 'button', p2, {
                                events: { click: [{ handler: 'increment', params: [] }] },
                            }, () => [this.text('+')]),
                        ]),
                ]);
            },
        } as any);
        return view;
    };
}

describe('Hydration — echo tĩnh trước echo reactive (F4)', () => {
    let container: HTMLElement;
    let vm: ViewManager;

    beforeEach(() => {
        container = document.createElement('div');
        // SSR HTML ĐÚNG NHƯ BLADE (sau fix): `label` KHÔNG marker, `count` CÓ.
        container.innerHTML = `
            <div class="${SSR_VIEW_ID}-page-root" id="mixed-page">
                <p class="${SSR_VIEW_ID}-p-el">Total: <!--s:o:${SSR_VIEW_ID}-count-out-s-->0<!--s:o:${SSR_VIEW_ID}-count-out-e--></p>
                <button class="${SSR_VIEW_ID}-inc-btn">+</button>
            </div>
        `;
        document.body.appendChild(container);

        vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({ container, registry: { 'web.mixed-echo-test': makeMixedEchoFactory() } });
    });

    afterEach(() => {
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
        document.body.innerHTML = '';
    });

    const frame = () => new Promise<void>(r =>
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );

    it('hydrate KHÔNG hoán đổi/nhân đôi — "Total: 0" đúng một lần', async () => {
        await vm.hydrateView('web.mixed-echo-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });

        const p = container.querySelector('p')!;
        expect(p.textContent?.replace(/\s+/g, ' ').trim()).toBe('Total: 0');
    });

    it('đúng MỘT cặp marker (cho count) — label không claim/tạo marker riêng', async () => {
        await vm.hydrateView('web.mixed-echo-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });

        const p = container.querySelector('p')!;
        const comments = Array.from(p.childNodes).filter(n => n.nodeType === Node.COMMENT_NODE);
        expect(comments.length).toBe(2);
        expect(comments[0].nodeValue?.trim()).toBe(`s:o:${SSR_VIEW_ID}-count-out-s`);
        expect(comments[1].nodeValue?.trim()).toBe(`s:o:${SSR_VIEW_ID}-count-out-e`);
    });

    it('sau hydrate: click → count đổi, label đứng yên, không nhân đôi text', async () => {
        await vm.hydrateView('web.mixed-echo-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });

        const btn = container.querySelector('button')!;
        btn.click();
        await frame();

        const p = container.querySelector('p')!;
        expect(p.textContent?.replace(/\s+/g, ' ').trim()).toBe('Total: 1');
    });
});
