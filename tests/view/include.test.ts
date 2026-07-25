/**
 * Tests Phase 3c: Component (@include / @includeIf / @includeWhen).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) {
    app.instance('Registry', MarkerRegistry);
}

/** Child component: nhận props label qua data, có updateVariableData như compiled output */
function makeCardFactory() {
    return (__data__: any = {}) => {
        const view = new View('partials.card', 'view');
        const ctrl = view.__ctrl__;
        const manager: any = ctrl.states.__;
        manager.useState(__data__?.data?.label ?? __data__?.label ?? 'empty', 'label');

        ctrl.setup({
            superView: null,
            data: __data__,
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('card', 'article', parent, {}, (p: any) => [
                        this.output('o-label', p, true, ['label'], () => manager.states['label'].value),
                    ]),
                ]);
            },
            updateVariableData: function (data: any) {
                if (data && 'label' in data) {
                    manager.updateStateByKey('label', data.label);
                }
            },
        } as any);
        return view;
    };
}

/** Page chứa @include('partials.card', ['label' => $msg]) — props reactive theo state msg */
function makeHostFactory(opts: { when?: boolean } = {}) {
    return () => {
        const view = new View('web.host', 'view');
        const ctrl = view.__ctrl__;
        const manager: any = ctrl.states.__;
        manager.useState('hello', 'msg');
        manager.useState(true, 'showCard');

        ctrl.setup({
            superView: null,
            data: {},
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('host', 'div', parent, {}, (p: any) => [
                        opts.when
                            ? this.includeWhen('cpn-1',
                                { stateKeys: ['showCard'], checker: () => manager.states['showCard'].value },
                                'partials.card', p, ['msg'],
                                () => ({ label: manager.states['msg'].value }))
                            : this.include('cpn-1', 'partials.card', p, ['msg'],
                                () => ({ label: manager.states['msg'].value })),
                        this.html('after', 'footer', p, {}, () => [this.text('FOOTER')]),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

function createManager(opts: { when?: boolean } = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({
        container,
        registry: {
            'web.host': makeHostFactory(opts),
            'partials.card': makeCardFactory(),
        },
    });
    return { vm, container };
}

const route = (url: string) => ({ $urlPath: url } as any);
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

describe('@include — Component', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
    });

    it('render child view giữa component markers, đúng vị trí (trước footer)', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.host', {}, route('/host'));

        const article = container.querySelector('article');
        expect(article?.textContent).toBe('hello');
        // Component đứng TRƯỚC footer trong DOM order
        const footer = container.querySelector('footer')!;
        expect(article!.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('props reactive: state cha đổi → dataFactory mới → child updateData', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.host', {}, route('/host'));

        const hostCtrl = vm.getCurrentView()!.__ctrl__;
        (hostCtrl.states.__ as any).updateStateByKey('msg', 'world');
        await frame(); // host flush → component subscriber → child updateData
        await frame(); // child state flush → output update

        expect(container.querySelector('article')?.textContent).toBe('world');
    });

    it('child view liên kết parent/children + bị destroy theo cha', async () => {
        const { vm } = createManager();
        await vm.mountView('web.host', {}, route('/host'));

        const hostCtrl = vm.getCurrentView()!.__ctrl__;
        expect(hostCtrl.children.length).toBe(1);
        const childCtrl = hostCtrl.children[0];
        expect(childCtrl.path).toBe('partials.card');
        expect(childCtrl.lifecycleState).toBe('active');

        hostCtrl.destroy();
        expect(childCtrl.lifecycleState).toBe('destroyed');
        expect(hostCtrl.children).toHaveLength(0);
    });

    it('pause/resume page lan truyền tới child view', async () => {
        const { vm } = createManager();
        await vm.mountView('web.host', {}, route('/host'));

        const hostCtrl = vm.getCurrentView()!.__ctrl__;
        const childCtrl = hostCtrl.children[0];

        hostCtrl.pause();
        expect(hostCtrl.lifecycleState).toBe('paused');
        expect(childCtrl.lifecycleState).toBe('paused');

        hostCtrl.resume();
        expect(hostCtrl.lifecycleState).toBe('active');
        expect(childCtrl.lifecycleState).toBe('active');
    });

    it('@includeWhen: condition đổi → unmount/mount child', async () => {
        const { vm, container } = createManager({ when: true });
        await vm.mountView('web.host', {}, route('/host'));
        expect(container.querySelector('article')).not.toBeNull();

        const hostCtrl = vm.getCurrentView()!.__ctrl__;

        (hostCtrl.states.__ as any).updateStateByKey('showCard', false);
        await frame();
        expect(container.querySelector('article')).toBeNull();
        expect(container.querySelector('footer')).not.toBeNull(); // phần còn lại nguyên vẹn

        (hostCtrl.states.__ as any).updateStateByKey('showCard', true);
        await frame();
        expect(container.querySelector('article')).not.toBeNull();
        expect(container.querySelector('article')?.textContent).toBe('hello');
    });
});
