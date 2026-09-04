/**
 * `@if(rec !== null)` bọc `{{ rec['name'] }}`: khi rec về null, vùng reactive
 * chỉ dựng lại ở RAF kế tiếp, còn listener của Output chạy ngay trong đợt flush
 * → factory chạy một lần với rec = null. Trước đây nó ném và đi thẳng tới error
 * boundary (console: "[ViewState] Listener error: Cannot read properties of null").
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mountView, nextFrame, Harness } from '../helpers/harness';

let h: Harness | null = null;
afterEach(() => { h?.destroy(); h = null; vi.restoreAllMocks(); });

function guardedView() {
    return mountView(function () {
        const manager: any = this.states.__;
        const rec = () => manager.states['rec'].value;
        return this.wrapper((parent: any) => [
            this.html('root', 'div', parent, {}, (p: any) => [
                this.reactive('r1', 'if', null, p, ['rec'], () => {
                    if (rec() !== null) {
                        return [
                            this.html('e1', 'span', p, {}, (p2: any) => [
                                this.output('o1', p2, true, ['rec'], () => rec()['name']),
                            ]),
                        ];
                    }
                    return [];
                }),
            ]),
        ]);
    }, { states: { rec: { name: 'An' } } });
}

describe('Output trong vùng @if — guard đổi chiều', () => {
    it('rec → null: không có listener error, nội dung biến mất', async () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        h = guardedView();
        await nextFrame();
        expect(h.container.querySelector('span')?.textContent).toBe('An');

        h.setState('rec', null);
        await nextFrame();
        await nextFrame();

        expect(h.container.querySelector('span')).toBeNull();
        expect(errors.mock.calls.map(c => String(c[0])).filter(m => m.includes('Listener error'))).toEqual([]);
    });

    it('vẫn báo lỗi thật khi không có vùng reactive nào chờ dựng lại', async () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('root', 'div', parent, {}, (p: any) => [
                    this.output('o1', p, true, ['rec'], () => manager.states['rec'].value['name']),
                ]),
            ]);
        }, { states: { rec: { name: 'An' } } });
        await nextFrame();

        h.setState('rec', null);
        await nextFrame();

        expect(errors.mock.calls.map(c => String(c[0])).some(m => m.includes('Listener error'))).toBe(true);
    });
});
