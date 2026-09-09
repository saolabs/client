/**
 * `<mycomp @edit(openEditor(event))>` — con phát sự kiện thẳng lên cha đã
 * @include nó, không qua App.Event.
 *
 * Cấu trúc dựng ở đây khớp ĐÚNG output của compiler:
 *   cha  → this.include(id, path, parent, stateKeys, dataFactory, { edit: fn })
 *   con  → events: { click: [{ handler: 'emit', params: ['edit', id] }] }
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

/** Con: nút bấm gọi emit('edit', cardId) qua đúng đường handler-dạng-chuỗi. */
function makeCardFactory() {
    return (__data__: any = {}) => {
        const view = new View('partials.card', 'view');
        const ctrl = view.__ctrl__;
        const cardId = __data__?.cardId ?? 0;

        ctrl.setup({
            superView: null,
            data: __data__,
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('btn', 'button', parent,
                        { events: { click: [{ handler: 'emit', params: ['edit', cardId] }] } },
                        () => [this.text('Sửa')]),
                ]);
            },
        } as any);
        return view;
    };
}

function makeHostFactory(seen: any[], listenersRef: { current: Record<string, any> }) {
    return () => {
        const view = new View('web.host', 'view');
        const ctrl = view.__ctrl__;
        const manager: any = ctrl.states.__;
        manager.useState(7, 'cardId');

        ctrl.setup({
            superView: null,
            data: {},
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('host', 'div', parent, {}, (p: any) =>
                        // listeners được dựng lại mỗi lượt render, y như compiled output
                        [this.include('cpn-1', 'partials.card', p, ['cardId'],
                            () => ({ cardId: manager.states['cardId'].value }),
                            (listenersRef.current = { edit: (id: number) => { seen.push(id); return 'ok'; } }))],
                    ),
                ]);
            },
        } as any);
        return view;
    };
}

function createManager(seen: any[], listenersRef: { current: Record<string, any> }) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({
        container,
        registry: {
            'web.host': makeHostFactory(seen, listenersRef),
            'partials.card': makeCardFactory(),
        },
    });
    return { vm, container };
}

const route = (url: string) => ({ $urlPath: url } as any);

describe('emit() — sự kiện con → cha', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
    });

    it('click trong con gọi listener khai báo tại thẻ cha', async () => {
        const seen: any[] = [];
        const { vm, container } = createManager(seen, { current: {} });
        await vm.mountView('web.host', {}, route('/host'));

        container.querySelector('button')!.click();
        expect(seen).toEqual([7]);
    });

    it('emit trả về giá trị của listener; tên lạ thì im lặng', async () => {
        const seen: any[] = [];
        const { vm } = createManager(seen, { current: {} });
        await vm.mountView('web.host', {}, route('/host'));

        const childCtrl = vm.getCurrentView()!.__ctrl__.children[0];
        expect(childCtrl.emit('edit', 1)).toBe('ok');
        expect(childCtrl.emit('khong-ai-nghe', 1)).toBeUndefined();
    });

    it('view gốc (không có cha include) emit không nổ', async () => {
        const seen: any[] = [];
        const { vm } = createManager(seen, { current: {} });
        await vm.mountView('web.host', {}, route('/host'));

        expect(vm.getCurrentView()!.emit('edit', 1)).toBeUndefined();
    });
});
