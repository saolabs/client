/**
 * `states.__.computed(key, fn, deps)` (GAP-04) — state dẫn xuất có memo hoá.
 *
 * Bất biến:
 *   1. Tính LAZY: khai báo xong chưa ai đọc → chưa chạy fn
 *   2. Memo: đọc nhiều lần, dep không đổi → chỉ tính 1 lần
 *   3. Dep đổi nhiều lần trong 1 batch → chỉ tính lại 1 lần (lúc đọc)
 *   4. Dùng được như state thường: getStateByKey / proxy / subscribe([key])
 *   5. Output bind stateKeys:[computedKey] → DOM tự cập nhật
 *   6. Read-only: set bị bỏ qua + cảnh báo
 *   7. destroy() gỡ subscription của computed
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mountView, nextFrame, Harness } from '../helpers/harness';
import { View } from '../../src/core/view/View';

let h: Harness | null = null;
afterEach(() => { h?.destroy(); h = null; vi.restoreAllMocks(); });

/** StateManager độc lập, không cần mount view. */
function makeManager(states: Record<string, any> = {}) {
    const view = new View('test.computed', 'view');
    const manager: any = view.__ctrl__.states.__;
    for (const [k, v] of Object.entries(states)) manager.useState(v, k);
    return { manager, ctrl: view.__ctrl__ };
}

describe('computed — lazy + memo', () => {
    it('chưa đọc thì CHƯA tính (lazy)', () => {
        const { manager } = makeManager({ a: 1 });
        const fn = vi.fn(() => manager.getStateByKey('a') * 2);

        manager.computed('double', fn, ['a']);

        expect(fn).not.toHaveBeenCalled();
    });

    it('đọc nhiều lần, dep không đổi → chỉ tính 1 lần', () => {
        const { manager } = makeManager({ a: 2 });
        const fn = vi.fn(() => manager.getStateByKey('a') * 2);
        manager.computed('double', fn, ['a']);

        expect(manager.getStateByKey('double')).toBe(4);
        expect(manager.getStateByKey('double')).toBe(4);
        expect(manager.getStateByKey('double')).toBe(4);

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('dep đổi → giá trị mới, và chỉ tính lại 1 lần dù đổi nhiều lần', async () => {
        const { manager } = makeManager({ a: 1 });
        const fn = vi.fn(() => manager.getStateByKey('a') * 10);
        manager.computed('ten', fn, ['a']);

        expect(manager.getStateByKey('ten')).toBe(10); // lần tính #1

        manager.updateStateByKey('a', 2);
        manager.updateStateByKey('a', 3);
        manager.updateStateByKey('a', 4);
        await nextFrame();

        expect(manager.getStateByKey('ten')).toBe(40); // lần tính #2
        expect(fn).toHaveBeenCalledTimes(2);
    });
});

describe('computed — dùng như state thường', () => {
    it('đọc được qua getStateByKey và qua proxy viewState', () => {
        const { manager, ctrl } = makeManager({ first: 'Sao', last: 'La' });
        manager.computed('fullName', () => `${manager.getStateByKey('first')} ${manager.getStateByKey('last')}`,
            ['first', 'last']);

        expect(manager.getStateByKey('fullName')).toBe('Sao La');
        expect((ctrl.states as any).fullName).toBe('Sao La');
    });

    it('subscribe([computedKey]) được gọi khi dep đổi', async () => {
        const { manager } = makeManager({ a: 1 });
        manager.computed('double', () => manager.getStateByKey('a') * 2, ['a']);

        const listener = vi.fn();
        manager.subscribe(['double'], listener);

        manager.updateStateByKey('a', 5);
        await nextFrame();

        expect(listener).toHaveBeenCalled();
        expect(manager.getStateByKey('double')).toBe(10);
    });

    it('computed lồng computed', async () => {
        const { manager } = makeManager({ a: 2 });
        manager.computed('double', () => manager.getStateByKey('a') * 2, ['a']);
        manager.computed('quad', () => manager.getStateByKey('double') * 2, ['double']);

        expect(manager.getStateByKey('quad')).toBe(8);

        manager.updateStateByKey('a', 3);
        await nextFrame();
        expect(manager.getStateByKey('quad')).toBe(12);
    });

    it('read-only: set bị bỏ qua + cảnh báo', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { manager } = makeManager({ a: 1 });
        manager.computed('double', () => manager.getStateByKey('a') * 2, ['a']);

        manager.setters['double'](999);

        expect(warn).toHaveBeenCalled();
        expect(manager.getStateByKey('double')).toBe(2);
    });
});

describe('computed — tích hợp Output (DOM tự cập nhật)', () => {
    it('Output bind stateKeys:[computedKey] → DOM đổi khi dep đổi', async () => {
        h = mountView(function () {
            const m: any = this.states.__;
            m.computed('total', () => m.getStateByKey('qty') * m.getStateByKey('price'), ['qty', 'price']);
            return this.wrapper((parent: any) => [
                this.html('el', 'span', parent, {}, (p: any) => [
                    this.output('o-total', p, true, ['total'], () => m.getStateByKey('total')),
                ]),
            ]);
        }, { states: { qty: 2, price: 10 } });

        expect(h.text()).toBe('20');

        h.setState('qty', 5);
        await nextFrame();

        expect(h.text()).toBe('50');
    });
});

describe('computed — cleanup', () => {
    it('destroy() gỡ subscription, dep đổi sau đó không tính lại', async () => {
        const { manager } = makeManager({ a: 1 });
        const fn = vi.fn(() => manager.getStateByKey('a') * 2);
        manager.computed('double', fn, ['a']);
        manager.getStateByKey('double');
        expect(fn).toHaveBeenCalledTimes(1);

        manager.destroy();
        // destroy() xoá states nên không đọc lại được — điều cần bảo đảm là
        // không còn listener nào sống sót gây tính lại/leak.
        expect(manager.listeners.size).toBe(0);
    });
});
