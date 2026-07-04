/**
 * Contract data vs state (mô hình React):
 *   - DATA = từ ngoài truyền vào (props/route params) — đổi được nhiều lần qua
 *     updateData; biểu thức phụ thuộc data phải cập nhật.
 *   - STATE = của riêng view instance — commitData() init MỘT lần (khóa bằng
 *     lock); updateData các lần sau KHÔNG được reset state.
 *
 * Thứ tự chuẩn: factory(data) → [updateData pre-commit: chỉ merge] →
 * commitData (init state, 1 lần) → start → [updateData post-commit:
 * unlock → updateVariableData → lock].
 */
import { describe, it, expect, afterEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);

/** Log các lần contract functions được gọi để assert thứ tự */
let calls: string[] = [];

/**
 * Factory mô phỏng compiled output ĐÚNG contract:
 *   - state `count`: init literal 0 trong commitConstructorData (update$ + lock)
 *   - data `label`: destructure từ __data__, trait cập nhật + notify key 'label'
 *     (updateVariableData KHÔNG re-run initializer của state)
 */
function makeContractFactory() {
    return (__data__: Record<string, any> = {}) => {
        const view = new View('web.contract', 'view');
        const ctrl = view.__ctrl__;
        const manager: any = ctrl.states.__;

        let { label = 'default' } = __data__;

        const set$count = manager.register('count');
        let count: any = null;
        const setCount = (v: any) => { count = v; set$count(v); };
        const update$count = (v: any) => {
            if (manager.canUpdateStateByKey) {
                manager.updateStateByKey('count', v);
                count = v;
            }
        };
        manager.setters.setCount = setCount;

        // Biến data cũng là key subscribe được (hướng compiler cần emit)
        manager.register('label', label);
        const __UPDATE_DATA_TRAIT__: Record<string, (v: any) => void> = {
            label: (v: any) => { label = v; manager.updateStateByKey('label', v); },
        };

        ctrl.setUserDefinedConfig({
            increment() { setCount(count + 1); },
        });

        ctrl.setup({
            superView: null,
            data: __data__,
            commitConstructorData() {
                calls.push('commitConstructorData');
                update$count(0);
                manager.lockUpdateRealState();
            },
            updateVariableData(this: any, data: Record<string, any>) {
                calls.push(`updateVariableData:${JSON.stringify(data)}`);
                for (const key in data) {
                    if (typeof __UPDATE_DATA_TRAIT__[key] === 'function') {
                        __UPDATE_DATA_TRAIT__[key](data[key]);
                    }
                }
                // ĐÚNG contract: KHÔNG re-run update$count(0) tại đây
            },
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('root', 'div', p, {}, (p2: any) => [
                        this.output('o-label', p2, true, ['label'], () => label),
                        this.output('o-count', p2, true, ['count'], () => ` c=${count}`),
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
    vm.init({ container, registry: { 'web.contract': makeContractFactory() } });
    return { vm, container };
}

const route = (url: string) => ({ $urlPath: url, $uri: url } as any);
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

describe('Contract data vs state (React-style props/state)', () => {
    afterEach(() => {
        calls = [];
        document.body.innerHTML = '';
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
    });

    it('mount có data: updateData pre-commit CHỈ merge — commitData mới init state (đúng 1 lần)', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.contract', { label: 'hello' }, route('/c'));

        // updateVariableData KHÔNG chạy trước commit (constructor phase)
        const commitIdx = calls.indexOf('commitConstructorData');
        expect(commitIdx).toBeGreaterThanOrEqual(0);
        for (let i = 0; i < commitIdx; i++) {
            expect(calls[i].startsWith('updateVariableData')).toBe(false);
        }
        // State init từ commitData; data từ factory destructure
        expect(container.textContent).toContain('hello');
        expect(container.textContent).toContain('c=0');
        // Data đã merge vào ctrl.data dù pre-commit không chạy updateVariableData
        expect(vm.getCurrentView()!.__ctrl__.data.label).toBe('hello');
    });

    it('updateData post-commit: data đổi + DOM cập nhật, state KHÔNG bị reset', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.contract', { label: 'hello' }, route('/c'));
        const view = vm.getCurrentView()!;

        // User đổi instance state: count 0 → 2
        (view as any).increment();
        (view as any).increment();
        await frame();
        expect(container.textContent).toContain('c=2');

        // Props mới từ ngoài vào
        calls = [];
        view.__ctrl__.updateData({ label: 'world' });
        await frame();

        expect(calls).toEqual(['updateVariableData:{"label":"world"}']);
        expect(container.textContent).toContain('world'); // data reactive
        expect(container.textContent).toContain('c=2');   // state GIỮ NGUYÊN
        expect(view.__ctrl__.data.label).toBe('world');
    });

    it('commitData idempotent: gọi lần 2 không chạy lại commitConstructorData', async () => {
        const { vm } = createManager();
        await vm.mountView('web.contract', { label: 'x' }, route('/c'));
        const ctrl = vm.getCurrentView()!.__ctrl__;

        calls = [];
        ctrl.commitData(); // đã committed → no-op
        expect(calls).toEqual([]);
    });

    it('async data về TRƯỚC commit: trait áp vào biến data, commitData init state từ giá trị MỚI', () => {
        // Mô phỏng compiled view: state `greeting` init TỪ data var `label`
        // (pattern update$greeting(label) như demo-loop-key: update$postList(posts))
        const view = new View('web.async-contract', 'view');
        const ctrl = view.__ctrl__;
        const manager: any = ctrl.states.__;

        let label = 'initial'; // destructure từ __data__ lúc construct
        const __UPDATE_DATA_TRAIT__: Record<string, (v: any) => void> = {
            label: (v: any) => { label = v; },
        };
        manager.register('greeting');
        const update$greeting = (v: any) => {
            if (manager.canUpdateStateByKey) manager.updateStateByKey('greeting', v);
        };

        ctrl.setup({
            superView: null,
            data: { label: 'initial' },
            commitConstructorData() {
                update$greeting(label); // init state TỪ data var
                manager.lockUpdateRealState();
            },
            updateVariableData() {},
            updateVariableItemData(this: any, key: string, value: any) {
                this.data[key] = value;
                if (typeof __UPDATE_DATA_TRAIT__[key] === 'function') __UPDATE_DATA_TRAIT__[key](value);
            },
            render() { return null; },
        } as any);

        // Async data về TRƯỚC commit (Case 3 renderPageView: await fetch → updateData)
        ctrl.updateData({ label: 'fetched' });
        expect(label).toBe('fetched');           // trait ĐÃ áp vào closure var
        expect(manager.getStateByKey('greeting')).toBe(null); // state CHƯA init

        ctrl.commitData();
        expect(manager.getStateByKey('greeting')).toBe('fetched'); // init từ giá trị MỚI
    });

    it('lock enforce ở runtime: view KHÔNG có state (compiled fn rỗng, không lock) vẫn bị khoá sau commit', () => {
        const view = new View('web.no-state', 'view');
        const ctrl = view.__ctrl__;
        const manager: any = ctrl.states.__;

        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() { /* view chỉ có data — compiled RỖNG, không lock */ },
            updateVariableData() {},
            updateVariableItemData() {},
            render() { return null; },
        } as any);

        expect(manager.canUpdateStateByKey).toBe(true); // constructor phase: mở
        ctrl.commitData();
        expect(manager.canUpdateStateByKey).toBe(false); // runtime tự lock — không cần compiler

        // Cửa sổ updateData: unlock trong updateVariableData rồi lock lại
        ctrl.updateData({ x: 1 });
        expect(manager.canUpdateStateByKey).toBe(false);
    });

    it('updateData khi paused: buffer, apply đúng 1 lần lúc resume', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.contract', { label: 'a' }, route('/c1'));
        const view = vm.getCurrentView()!;

        await vm.mountView('web.contract', { label: 'b' }, route('/c2'), 'push'); // c1 paused
        calls = [];
        view.__ctrl__.updateData({ label: 'buffered' }); // đến muộn khi đang paused
        expect(calls).toEqual([]); // chưa apply

        await vm.mountView('web.contract', { label: 'a' }, route('/c1'), 'pop'); // restore c1
        await frame();

        expect(calls).toContain('updateVariableData:{"label":"buffered"}');
        expect(container.textContent).toContain('buffered');
    });
});
