/**
 * Cross-contract test — slots/children (@children + @importInclude/custom tag).
 *
 * Compiler emit:
 *   Parent (<Card title="x"> <p>{{ msg }}</p> </Card>):
 *     this.include(id, 'components.card', parentElement, [], (parentElement) => ({
 *         "title": "x",
 *         __ONE_CHILDREN_CONTENT__: (parentElement) => [ ...elements ],
 *     }))
 *   Child (@children):
 *     ...this.__children(__ONE_CHILDREN_CONTENT__, parentElement)
 *
 * Semantics (React-children-like, bake tại thời điểm include — giống Blade):
 *   - Element factory chạy trong scope PARENT (`this` = parent ctrl) →
 *     children elements subscribe state của PARENT, reactive theo parent.
 *   - String (SSR data / default '') → text tĩnh; '' → không render gì.
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

/** Child 'components.card' — compiled shape của card.sao (@props(title) + @children) */
function makeCardFactory() {
    return (__data__: Record<string, any> = {}) => {
        const view = new View('components.card', 'view');
        const ctrl = view.__ctrl__;
        const manager: any = ctrl.states.__;

        let { title = '', __ONE_CHILDREN_CONTENT__ = '' } = __data__;
        manager.register('title', title);
        const __UPDATE_DATA_TRAIT__: Record<string, (v: any) => void> = {
            title: (v: any) => { title = v; manager.updateStateByKey('title', v); },
            __ONE_CHILDREN_CONTENT__: (v: any) => { __ONE_CHILDREN_CONTENT__ = v; },
        };

        ctrl.setup({
            superView: null,
            data: __data__,
            commitConstructorData() { manager.lockUpdateRealState(); },
            updateVariableData(this: any, data: Record<string, any>) {
                for (const key in data) __UPDATE_DATA_TRAIT__[key]?.(data[key]);
            },
            updateVariableItemData(this: any, key: string, value: any) {
                this.data[key] = value;
                __UPDATE_DATA_TRAIT__[key]?.(value);
            },
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('card-root', 'div', p, {
                        classes: [{ type: 'static', value: 'card' }],
                    }, (p2: any) => [
                        this.html('card-title', 'h3', p2, {}, (p3: any) => [
                            this.output('o-title', p3, true, ['title'], () => title),
                        ]),
                        this.html('card-body', 'div', p2, {
                            classes: [{ type: 'static', value: 'card-body' }],
                        }, (parentElement: any) => [
                            // @children — compiler emit
                            ...this.__children(__ONE_CHILDREN_CONTENT__, parentElement),
                        ]),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

/** Parent 'web.page' — <Card title="Greeting"><p class="inner">{{ msg }}</p></Card> */
function makePageFactory() {
    return () => {
        const view = new View('web.page', 'view');
        const ctrl = view.__ctrl__;
        const manager: any = ctrl.states.__;

        const set$msg = manager.register('msg');
        let msg: any = null;
        const setMsg = (v: any) => { msg = v; set$msg(v); };
        manager.setters.setMsg = setMsg;
        manager.setters.msg = setMsg;
        const update$msg = (v: any) => {
            if (manager.canUpdateStateByKey) { manager.updateStateByKey('msg', v); msg = v; }
        };

        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() {
                update$msg('hello');
                manager.lockUpdateRealState();
            },
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('page-root', 'div', p, {}, (p2: any) => [
                        this.include('inc-card', 'components.card', p2, [], (parentElement: any) => ({
                            title: 'Greeting',
                            // Element factory — chạy trong scope PARENT (this = page ctrl)
                            __ONE_CHILDREN_CONTENT__: (pe: any) => [
                                this.html('inner-p', 'p', pe, {
                                    classes: [{ type: 'static', value: 'inner' }],
                                }, (p3: any) => [
                                    this.output('o-msg', p3, true, ['msg'], () => msg),
                                ]),
                            ],
                        })),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

let container: HTMLElement;
let vm: ViewManager;

function createManager() {
    container = document.createElement('div');
    document.body.appendChild(container);
    vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({
        container,
        registry: {
            'web.page': makePageFactory(),
            'components.card': makeCardFactory(),
        },
    });
}

const route = (url: string) => ({ $urlPath: url, $uri: url } as any);
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

afterEach(() => {
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
});

describe('@children — slot content từ parent include', () => {
    it('CSR: children render bên trong card-body, props render đúng', async () => {
        createManager();
        await vm.mountView('web.page', {}, route('/'));

        const body = container.querySelector('.card-body')!;
        expect(body).not.toBeNull();
        expect(container.querySelector('h3')!.textContent).toBe('Greeting');
        // children (p.inner) nằm TRONG card-body của child view
        const inner = body.querySelector('p.inner');
        expect(inner).not.toBeNull();
        expect(inner!.textContent).toBe('hello');
    });

    it('children reactive theo state của PARENT (không phải child)', async () => {
        createManager();
        await vm.mountView('web.page', {}, route('/'));

        const pageCtrl = vm.getCurrentView()!.__ctrl__;
        pageCtrl.states.__.setters.msg('updated!');
        await frame();

        expect(container.querySelector('.card-body p.inner')!.textContent).toBe('updated!');
    });

    it('string content (SSR data) → render text tĩnh', async () => {
        createManager();
        await vm.mountView('components.card', {
            title: 'T',
            __ONE_CHILDREN_CONTENT__: 'plain text',
        }, route('/card'));

        expect(container.querySelector('.card-body')!.textContent).toBe('plain text');
    });

    it('không có children (default "") → card-body rỗng, không crash', async () => {
        createManager();
        await vm.mountView('components.card', { title: 'T' }, route('/card'));

        const body = container.querySelector('.card-body')!;
        expect(body).not.toBeNull();
        expect(body.textContent).toBe('');
        expect(container.querySelector('h3')!.textContent).toBe('T');
    });
});
