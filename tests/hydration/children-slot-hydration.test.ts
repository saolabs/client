/** Hydration contract for parent-owned children projected into an included child. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { View } from '../../src/core/view/View';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

const PARENT_ID = 'vslot-parent';
const CHILD_ID = 'vslot-card';

function makeCardFactory() {
    return (__data__: Record<string, any> = {}) => {
        const view = new View('components.slot-card', 'view');
        const ctrl = view.__ctrl__;
        let { __ONE_CHILDREN_CONTENT__ = '' } = __data__;

        ctrl.setup({
            superView: null,
            data: __data__,
            commitConstructorData() {},
            updateVariableData(this: any, data: Record<string, any>) {
                if ('__ONE_CHILDREN_CONTENT__' in data) {
                    __ONE_CHILDREN_CONTENT__ = data.__ONE_CHILDREN_CONTENT__;
                }
            },
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('card-root', 'section', p, {}, (p2: any) => [
                        this.html('card-body', 'div', p2, {
                            classes: [{ type: 'static', value: 'card-body' }],
                        }, (parentElement: any) => [
                            ...this.__children(__ONE_CHILDREN_CONTENT__, parentElement),
                        ]),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

function makeParentFactory(onMaterialize: () => void) {
    return () => {
        const view = new View('web.slot-page', 'view');
        const ctrl = view.__ctrl__;
        const manager: any = ctrl.states.__;
        manager.useState('hello', 'msg');

        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() {},
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('page-root', 'main', p, {}, (p2: any) => [
                        this.include('inc-card', 'components.slot-card', p2, [], () => ({
                            __ONE_CHILDREN_CONTENT__: (parentElement: any) => {
                                onMaterialize();
                                return [
                                    this.html('slot-p', 'p', parentElement, {
                                        classes: [{ type: 'static', value: 'slot-content' }],
                                    }, (p3: any) => [
                                        this.output('slot-output', p3, true, ['msg'],
                                            () => manager.states['msg'].value),
                                    ]),
                                ];
                            },
                        })),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

describe('@children — SSR hydration', () => {
    let container: HTMLElement;
    let vm: ViewManager;
    let materializations: number;

    beforeEach(() => {
        materializations = 0;
        container = document.createElement('div');
        container.innerHTML = [
            `<!--s:v:${PARENT_ID}-s-->`,
            `<main class="${PARENT_ID}-page-root">`,
            `<!--s:c:${PARENT_ID}-inc-card-s-->`,
            `<!--s:v:${CHILD_ID}-s-->`,
            `<section class="${CHILD_ID}-card-root">`,
            `<div class="${CHILD_ID}-card-body card-body">`,
            `<p class="${PARENT_ID}-slot-p slot-content">`,
            `<!--s:o:${PARENT_ID}-slot-output-s-->hello<!--s:o:${PARENT_ID}-slot-output-e-->`,
            `</p></div></section>`,
            `<!--s:v:${CHILD_ID}-e-->`,
            `<!--s:c:${PARENT_ID}-inc-card-e-->`,
            `</main>`,
            `<!--s:v:${PARENT_ID}-e-->`,
        ].join('');
        document.body.appendChild(container);

        vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({
            container,
            registry: {
                'web.slot-page': makeParentFactory(() => { materializations += 1; }),
                'components.slot-card': makeCardFactory(),
            },
        });
    });

    afterEach(() => {
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
        document.body.innerHTML = '';
    });

    const frame = () => new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );

    it('materialize đúng lúc placeholder hydrate và claim nguyên SSR subtree', async () => {
        const ssrSlot = container.querySelector('.slot-content')!;
        expect(materializations).toBe(0);

        await vm.hydrateView('web.slot-page', { __SSR_VIEW_ID__: PARENT_ID });

        const slots = container.querySelectorAll('.slot-content');
        expect(materializations).toBe(1);
        expect(slots.length).toBe(1);
        expect(slots[0]).toBe(ssrSlot);
        expect(container.querySelectorAll('.card-body').length).toBe(1);
    });

    it('sau hydrate, output trong slot vẫn subscribe state của parent', async () => {
        await vm.hydrateView('web.slot-page', { __SSR_VIEW_ID__: PARENT_ID });
        const parent = vm.getCurrentView()!;

        parent.__ctrl__.states.__.updateStateByKey('msg', 'updated');
        await frame();

        expect(container.querySelector('.slot-content')?.textContent).toBe('updated');
    });
});
