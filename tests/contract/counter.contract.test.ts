/**
 * Cross-contract test — Counter (compiler/examples/js/counter.ts).
 *
 * Mục đích: Dùng ĐÚNG output pattern từ compiler để instantiate một view,
 * mount vào DOM và kiểm tra runtime behaviour.
 *
 * Các điều kiện contract kiểm tra:
 *   1. register(key) 1-arg → state khởi tạo với undefined, set qua commitConstructorData
 *   2. commitConstructorData / lockUpdateRealState flow
 *   3. events: named handler { handler: 'increment', params: [] }
 *   4. classes: [{ type: 'static', value: 'btn' }]
 *   5. output(id, parent, true, stateKeys, factory) reactive update
 *   6. App.View.generateViewId()
 *   7. App.Helper không cần thiết cho counter (chỉ dùng trong demo2-extends)
 *
 * Tham chiếu: docs/COMPILER_CONTRACT.md §1–4.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

// ─── Bootstrap app ────────────────────────────────────────────────

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

// ─── Compiled Counter View (pattern từ compiler/examples/js/counter.ts) ──────
//
// Đây là factory function của view được compiled. Chúng ta KHÔNG import file
// thật vì nó phụ thuộc 'saola' alias — thay vào đó tái hiện ĐÚNG pattern output.

function makeCounterFactory() {
    return (__data__: any = {}) => {
        const view = new View('examples.counter', 'view');
        const ctrl = view.__ctrl__;
        const __STATE__ = ctrl.states;

        // ── Pattern từ compiler: register(key) — 1 arg ────────────────────────
        // FIX CHECK: register() phải chấp nhận 1 arg (value mặc định = undefined)
        const set$count = __STATE__.__.register('count');
        let count: any = null;
        const setCount = (state: any) => {
            count = state;
            set$count(state);
        };
        __STATE__.__.setters.setCount = setCount;
        __STATE__.__.setters.count = setCount;

        const set$message = __STATE__.__.register('message');
        let message: any = null;
        const setMessage = (state: any) => {
            message = state;
            set$message(state);
        };
        __STATE__.__.setters.setMessage = setMessage;

        const lockUpdateRealState = () => __STATE__.__.lockUpdateRealState();
        const updateStateByKey = (key: string, val: any) => __STATE__.__.updateStateByKey(key, val);
        const update$count = (value: any) => {
            if (__STATE__.__.canUpdateStateByKey) { updateStateByKey('count', value); count = value; }
        };
        const update$message = (value: any) => {
            if (__STATE__.__.canUpdateStateByKey) { updateStateByKey('message', value); message = value; }
        };

        // ── setUserDefinedConfig: methods dùng closure ────────────────────────
        ctrl.setUserDefinedConfig({
            increment() { setCount(count + 1); },
            decrement() { setCount(count - 1); },
            reset()     { setCount(0); },
        });

        ctrl.setup({
            superView: null,
            data: __data__,
            commitConstructorData: function () {
                // ── Contract: update$xxx gọi sau register() ──────────────────
                update$count(0);
                update$message('Hello, Saola!');
                lockUpdateRealState();
            },
            updateVariableData: function (data: any) {
                // passthrough
            },
            updateVariableItemData: function (key: string, value: any) {
                (this as any).data[key] = value;
            },
            prerender: function () { return null; },
            render: function (this: any) {
                // ── Render: classes static, attrs static+binding, events named handler ──
                return this.wrapper((parentElement: any) => [
                    this.html('d69e6b1d', 'div', parentElement,
                        { classes: [{ type: 'static', value: 'counter-component' }] },
                        (p: any) => [
                            this.html('beab9ba1', 'h4', p, {}, (p2: any) => [
                                this.text('Count: '),
                                this.html('1eafe912', 'span', p2,
                                    {
                                        attrs: {
                                            'id':   { type: 'static', value: 'counter-value' },
                                            // binding attr — factory re-evaluates on state change
                                            'data-count': {
                                                type: 'binding',
                                                factory: () => `${count}`,
                                                stateKeys: ['count'],
                                            },
                                        },
                                    },
                                    (p3: any) => [
                                        this.output('5ff3bd35', p3, true, ['count'], () => count),
                                    ]),
                            ]),
                            this.html('fccc82c8', 'div', p,
                                { classes: [{ type: 'static', value: 'btn-group' }] },
                                (p2: any) => [
                                    this.html('aa23a7be', 'button', p2,
                                        {
                                            classes: [{ type: 'static', value: 'btn' }],
                                            // ── Named event handler (compiler format) ─────────
                                            events: { click: [{ handler: 'decrement', params: [] }] },
                                        },
                                        (p3: any) => [this.text('-')]),
                                    this.html('9ac7c16c', 'button', p2,
                                        {
                                            classes: [{ type: 'static', value: 'btn' }],
                                            events: { click: [{ handler: 'increment', params: [] }] },
                                        },
                                        (p3: any) => [this.text('+')]),
                                    this.html('f4cc6573', 'button', p2,
                                        {
                                            classes: [{ type: 'static', value: 'btn' }],
                                            events: { click: [{ handler: 'reset', params: [] }] },
                                        },
                                        (p3: any) => [this.text('Reset')]),
                                ]),
                        ]),
                ]);
            },
        } as any);
        return view;
    };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function createManager() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({ container, registry: { 'examples.counter': makeCounterFactory() } });
    return { vm, container };
}

const route = (url: string) => ({ $urlPath: url } as any);
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Counter — cross-contract (compiler output pattern)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
    });

    it('mount: DOM structure, classes, initial count', async () => {
        const { container } = createManager();
        await (app() as any).View.mountView('examples.counter', {}, route('/counter'));

        // classes: [{ type: 'static', value: 'counter-component' }]
        expect(container.querySelector('.counter-component')).not.toBeNull();
        expect(container.querySelector('.btn-group')).not.toBeNull();

        // initial count = 0 (commitConstructorData ran update$count(0))
        const span = container.querySelector('span#counter-value');
        expect(span?.textContent).toBe('0');
    });

    it('register(key) 1-arg: state slot created, then set by commitConstructorData', async () => {
        const { vm } = createManager();
        await vm.mountView('examples.counter', {}, route('/counter'));

        const ctrl = vm.getCurrentView()!.__ctrl__;
        // Sau commitConstructorData: count = 0, message = 'Hello, Saola!'
        expect(ctrl.states.__.getStateByKey('count')).toBe(0);
        expect(ctrl.states.__.getStateByKey('message')).toBe('Hello, Saola!');
        // Sau lockUpdateRealState: canUpdateStateByKey = false
        expect(ctrl.states.__.canUpdateStateByKey).toBe(false);
    });

    it('named event handler — increment/decrement/reset buttons work', async () => {
        const { container, vm } = createManager();
        await vm.mountView('examples.counter', {}, route('/counter'));

        const [decBtn, incBtn, resetBtn] = container.querySelectorAll('button');
        const span = container.querySelector('span#counter-value')!;

        // Click increment
        incBtn.click();
        await frame();
        expect(span.textContent).toBe('1');

        incBtn.click();
        await frame();
        expect(span.textContent).toBe('2');

        // Click decrement
        decBtn.click();
        await frame();
        expect(span.textContent).toBe('1');

        // Reset
        resetBtn.click();
        await frame();
        expect(span.textContent).toBe('0');
    });

    it('binding attr data-count updates reactively', async () => {
        const { container, vm } = createManager();
        await vm.mountView('examples.counter', {}, route('/counter'));

        const span = container.querySelector('span#counter-value')!;
        expect(span.getAttribute('data-count')).toBe('0');

        const incBtn = container.querySelectorAll('button')[1];
        incBtn.click();
        await frame();
        expect(span.getAttribute('data-count')).toBe('1');
    });

    it('App.View.generateViewId() returns unique non-empty strings', () => {
        const vm = (app() as any).View ?? new ViewManager(app() as any);
        vm.setApp(app() as any);
        const id1 = vm.generateViewId();
        const id2 = vm.generateViewId();
        expect(typeof id1).toBe('string');
        expect(id1.length).toBeGreaterThan(0);
        // IDs are unique
        expect(id1 === id2).toBeFalsy();
    });
});
