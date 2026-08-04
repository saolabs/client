/**
 * Cross-contract test — `@computed` qua ViewManager.mountView() thật (không
 * qua test harness rút gọn), dùng ĐÚNG pattern compiler sinh ra
 * (xem compiler/src/sao2js/main_compiler.py::_generate_wrapper_declarations,
 * nhánh 'computed'):
 *
 *   let fullName;
 *   const get$fullName = __STATE__.__.computed('fullName', () => first + ' ' + last, ['first','last']);
 *   fullName = get$fullName();
 *   __STATE__.__.subscribe(['fullName'], () => { fullName = get$fullName(); });
 *
 * Câu hỏi cốt lõi: `first`/`last` chỉ có giá trị THẬT sau commitConstructorData
 * (chạy SAU khi computed's initial `fullName = get$fullName()` đã chạy trong
 * constructor, lúc first/last vẫn còn null) — DOM có tự sửa đúng trước khi
 * mountView() resolve không, hay phải đợi thêm 1 nextFrame()?
 */
import { describe, it, expect, afterEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);

function makeComputedFactory() {
    return () => {
        const view = new View('examples.computed', 'view');
        const ctrl = view.__ctrl__;
        const __STATE__ = ctrl.states;

        const set$first = __STATE__.__.register('first');
        let first: any = null;
        const update$first = (v: any) => { if (__STATE__.__.canUpdateStateByKey) { __STATE__.__.updateStateByKey('first', v); first = v; } };
        const set$last = __STATE__.__.register('last');
        let last: any = null;
        const update$last = (v: any) => { if (__STATE__.__.canUpdateStateByKey) { __STATE__.__.updateStateByKey('last', v); last = v; } };

        // ── Pattern compiler sinh cho @computed(fullName = first + ' ' + last) ──
        let fullName: any;
        const get$fullName = __STATE__.__.computed('fullName', () => `${first} ${last}`, ['first', 'last']);
        fullName = get$fullName();
        __STATE__.__.subscribe(['fullName'], () => { fullName = get$fullName(); });

        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData: function () {
                update$first('Sao');
                update$last('La');
                __STATE__.__.lockUpdateRealState();
            },
            updateVariableData: function () {},
            updateVariableItemData: function (key: string, value: any) { (this as any).data[key] = value; },
            prerender: function () { return null; },
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('el', 'span', parent, {}, (p: any) => [
                        this.output('o-full', p, true, ['fullName'], () => fullName),
                    ]),
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
    (app() as any).set('View', vm);
    vm.init({ container, registry: { 'examples.computed': makeComputedFactory() } });
    return { vm, container };
}

const route = (url: string) => ({ $urlPath: url } as any);

describe('@computed — cross-contract qua ViewManager.mountView() thật', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
    });

    it('giá trị đúng NGAY sau mountView() — không cần await nextFrame() thêm', async () => {
        const { vm, container } = createManager();
        await vm.mountView('examples.computed', {}, route('/computed'));

        // Nếu đây fail ra "null null": commitData() không tự flush trước khi
        // mountView() resolve, cần thêm bước đồng bộ hoá — xem GAPS_AND_ROADMAP.md §2.7.
        expect(container.textContent).toBe('Sao La');
    });
});
