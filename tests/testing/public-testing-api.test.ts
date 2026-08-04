/**
 * `@saolabs/client/testing` — API công khai cho người dùng framework test
 * component `.sao` của họ. Test này dùng ĐÚNG entry point mà npm export.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mount, nextFrame, Harness } from '../../src/testing';
import { View } from '../../src/core/view/View';

let h: Harness | null = null;
afterEach(() => { h?.destroy(); h = null; });

/** Giả lập factory compiler sinh ra cho một view `.sao` có state + event. */
function CounterFactory(__data__: any = {}) {
    const view = new View('examples.counter', 'view');
    const ctrl = view.__ctrl__;
    const manager: any = ctrl.states.__;
    manager.useState(__data__.start ?? 0, 'count');

    ctrl.setUserDefinedConfig({
        increment() {
            manager.updateStateByKey('count', manager.states['count'].value + 1);
        },
    });

    ctrl.setup({
        superView: null,
        data: __data__,
        render: function (this: any) {
            return this.wrapper((parent: any) => [
                this.html('root', 'div', parent, {}, (p: any) => [
                    this.output('o-count', p, true, ['count'], () => manager.states['count'].value),
                    this.html('btn', 'button', p, {
                        events: { click: [{ handler: 'increment', params: [] }] },
                    }, (p2: any) => [this.text('+')]),
                ]),
            ]);
        },
    } as any);
    return view;
}

describe('mount() — view đã compile', () => {
    it('render state ban đầu từ data truyền vào', () => {
        h = mount(CounterFactory, { start: 5 });
        expect(h.text()).toContain('5');
    });

    it('mặc định khi không truyền data', () => {
        h = mount(CounterFactory);
        expect(h.text()).toContain('0');
    });

    it('click → state đổi → DOM cập nhật sau nextFrame()', async () => {
        h = mount(CounterFactory, { start: 1 });
        h.container.querySelector('button')!.click();
        await nextFrame();
        expect(h.text()).toContain('2');
    });

    it('setState() từ ngoài cũng đẩy vào DOM', async () => {
        h = mount(CounterFactory);
        h.setState('count', 42);
        await nextFrame();
        expect(h.text()).toContain('42');
        expect(h.getState('count')).toBe(42);
    });

    it('destroy() gỡ container khỏi document', () => {
        const local = mount(CounterFactory);
        expect(document.body.contains(local.container)).toBe(true);
        local.destroy();
        expect(document.body.contains(local.container)).toBe(false);
    });
});
