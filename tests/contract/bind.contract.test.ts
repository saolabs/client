/**
 * Cross-contract test — @bind two-way binding directive.
 *
 * Compiler output pattern cho input với @bind:
 *   attrs: {
 *     "type":    { type: 'static', value: "text" },
 *     "bind":    { type: 'static', value: true },     ← sentinel
 *     "newTodo": { type: 'static', value: true },     ← state key
 *   }
 *
 * Client phải:
 *   1. Phát hiện pattern bind=true + <key>=true
 *   2. Set element.value = state hiện tại
 *   3. Listen input event → update state
 *   4. Subscribe state → update element.value
 *   5. KHÔNG set "bind" hay "newTodo" lên DOM attrs
 *
 * Tham chiếu: docs/COMPILER_CONTRACT.md §5.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

// ─── View với @bind input ─────────────────────────────────────────────────

function makeInputFactory() {
    return () => {
        const view = new View('examples.input-bind', 'view');
        const ctrl = view.__ctrl__;
        const __STATE__ = ctrl.states;

        // ── register pattern (compiler style) ─────────────────────────────
        const set$newTodo = __STATE__.__.register('newTodo');
        let newTodo: any = null;
        const setNewTodo = (state: any) => { newTodo = state; set$newTodo(state); };
        __STATE__.__.setters.setNewTodo = setNewTodo;
        __STATE__.__.setters.newTodo = setNewTodo;

        const set$submitted = __STATE__.__.register('submitted');
        let submitted: any = null;
        const setSubmitted = (state: any) => { submitted = state; set$submitted(state); };
        __STATE__.__.setters.setSubmitted = setSubmitted;

        const lockUpdateRealState = () => __STATE__.__.lockUpdateRealState();
        const updateStateByKey = (k: string, v: any) => __STATE__.__.updateStateByKey(k, v);

        const update$newTodo = (v: any) => {
            if (__STATE__.__.canUpdateStateByKey) { updateStateByKey('newTodo', v); newTodo = v; }
        };
        const update$submitted = (v: any) => {
            if (__STATE__.__.canUpdateStateByKey) { updateStateByKey('submitted', v); submitted = v; }
        };

        ctrl.setUserDefinedConfig({
            submitForm() { setSubmitted(newTodo); setNewTodo(''); },
        });

        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData: function () {
                update$newTodo('');
                update$submitted('');
                lockUpdateRealState();
            },
            updateVariableData: function () {},
            updateVariableItemData: function (k: string, v: any) { (this as any).data[k] = v; },
            prerender: function () { return null; },
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('form-div', 'div', parent, {}, (p: any) => [
                        // ── @bind input — pattern từ compiler ───────────────────────────
                        this.html('input-new', 'input', p, {
                            attrs: {
                                'type':    { type: 'static', value: 'text' },
                                'id':      { type: 'static', value: 'todo-input' },
                                // ── Two-way binding sentinel ─────────────────────────────
                                'bind':    { type: 'static', value: true },
                                'newTodo': { type: 'static', value: true },
                            },
                        }),
                        this.html('btn-submit', 'button', p, {
                            attrs: { 'id': { type: 'static', value: 'submit-btn' } },
                            events: { click: [{ handler: 'submitForm', params: [] }] },
                        }, (p2: any) => [this.text('Submit')]),
                        // Output để xem submitted value
                        this.html('result-p', 'p', p,
                            { attrs: { 'id': { type: 'static', value: 'result' } } },
                            (p2: any) => [
                                this.output('o-submitted', p2, true, ['submitted'], () => submitted),
                            ]),
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
    vm.init({ container, registry: { 'examples.input-bind': makeInputFactory() } });
    return { vm, container };
}

const route = (url: string) => ({ $urlPath: url } as any);
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('@bind — two-way binding directive (compiler pattern)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
    });

    it('bind/stateKey attrs KHÔNG xuất hiện trên DOM element', async () => {
        const { vm, container } = createManager();
        await vm.mountView('examples.input-bind', {}, route('/bind'));

        const input = container.querySelector('input#todo-input') as HTMLInputElement;
        expect(input).not.toBeNull();
        // "bind" và "newTodo" không được set lên DOM như attribute
        expect(input.hasAttribute('bind')).toBeFalsy();
        expect(input.hasAttribute('newtodo')).toBeFalsy();
        // "type" và "id" thì vẫn bình thường
        expect(input.getAttribute('type')).toBe('text');
        expect(input.getAttribute('id')).toBe('todo-input');
    });

    it('state → element.value: initial value', async () => {
        const { vm, container } = createManager();
        await vm.mountView('examples.input-bind', {}, route('/bind'));

        const ctrl = vm.getCurrentView()!.__ctrl__;
        // Initial value là '' từ commitConstructorData
        const input = container.querySelector('input#todo-input') as HTMLInputElement;
        expect(input.value).toBe('');
    });

    it('input event → state update', async () => {
        const { vm, container } = createManager();
        await vm.mountView('examples.input-bind', {}, route('/bind'));

        const ctrl = vm.getCurrentView()!.__ctrl__;
        const input = container.querySelector('input#todo-input') as HTMLInputElement;

        // Simulate user typing
        input.value = 'Buy milk';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await frame();

        // State phải được update
        expect(ctrl.states.__.getStateByKey('newTodo')).toBe('Buy milk');
    });

    it('state update → element.value sync', async () => {
        const { vm, container } = createManager();
        await vm.mountView('examples.input-bind', {}, route('/bind'));

        const ctrl = vm.getCurrentView()!.__ctrl__;
        const input = container.querySelector('input#todo-input') as HTMLInputElement;

        // Update state từ ngoài → element.value phải sync
        ctrl.states.__.setters.newTodo('Hello from state');
        await frame();

        expect(input.value).toBe('Hello from state');
    });

    it('submit: đọc state → submit → clear input', async () => {
        const { vm, container } = createManager();
        await vm.mountView('examples.input-bind', {}, route('/bind'));

        const input   = container.querySelector('input#todo-input') as HTMLInputElement;
        const btn     = container.querySelector('button#submit-btn') as HTMLButtonElement;
        const result  = container.querySelector('p#result') as HTMLParagraphElement;

        // Type something
        input.value = 'Walk the dog';
        input.dispatchEvent(new Event('input'));
        await frame();

        // Submit
        btn.click();
        await frame();

        // Result paragraph shows submitted value
        expect(result.textContent).toBe('Walk the dog');
        // Input cleared
        expect(input.value).toBe('');
    });
});

describe('camelCase attr normalization (compiler output)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
    });

    it('dataCount → data-count attribute trên DOM', async () => {
        // Compiler emit: attrs: { "dataCount": { type: 'binding', factory: () => 5, stateKeys: [] } }
        const view = new View('test.attrs', 'view');
        const ctrl = view.__ctrl__;
        const { Html } = await import('../../src/core/elements/Html');

        const el = new Html({
            ctx: ctrl,
            id: 'test-el',
            tagName: 'div',
            config: {
                attrs: {
                    // camelCase — compiler pattern cho data-count
                    'dataCount':    { type: 'static', value: '5' },
                    'ariaLabel':    { type: 'static', value: 'test' },
                    'id':           { type: 'static', value: 'my-el' },
                },
            },
        });

        // dataCount → data-count
        expect(el.element.getAttribute('data-count')).toBe('5');
        // ariaLabel → aria-label
        expect(el.element.getAttribute('aria-label')).toBe('test');
        // id không bị thay đổi
        expect(el.element.getAttribute('id')).toBe('my-el');
    });
});
