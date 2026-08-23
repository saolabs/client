/**
 * `loop` trong `@foreach` phải là BẢN CHỤP theo TỪNG VÒNG, không phải object
 * dùng chung bị mutate.
 *
 * `LoopContext` là MỘT instance được `__foreach` mutate qua mỗi vòng
 * (`setCurrentTimes`). Element con lại được tạo bởi `childrenFactory` — closure
 * chạy MUỘN (lúc `Html.renderChildren`), SAU khi vòng lặp kết thúc. Nếu callback
 * nhận thẳng LoopContext thì mọi hàng bắt CÙNG MỘT tham chiếu và đọc ra trạng
 * thái CUỐI.
 *
 * Đo được trước khi vá (list 6 phần tử, `@click(remove(loop.index))`): mọi hàng
 * gọi `remove(5)` → bấm hàng nào cũng xoá phần tử cuối, sau đó tắc hẳn.
 * `__loopIndex` không dính vì là tham số theo từng lần gọi callback.
 *
 * @see LoopContext.snapshot()
 * @see ViewController.__foreach
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mountView, type Harness } from '../../src/testing';

describe('LoopContext snapshot trong @foreach', () => {
    let h: Harness | null = null;
    afterEach(() => { h?.destroy(); h = null; });

    it('mỗi hàng giữ ĐÚNG loop.index của nó, kể cả khi đọc trong childrenFactory (chạy muộn)', () => {
        const seen: number[] = [];

        h = mountView(function (this: any) {
            const S = this.states.__;
            S.useState(['a', 'b', 'c', 'd'], 'items');
            return this.wrapper((p: any) => [
                this.html('root', 'div', p, {}, (p2: any) =>
                    this.__foreach(S.getStateByKey('items'), (item: any, _k: any, _i: any, loop: any) => [
                        // childrenFactory — chạy SAU khi vòng lặp kết thúc.
                        // Đây chính là chỗ bắt `loop` theo tham chiếu gây lỗi.
                        this.html(`row-${item}`, 'span', p2, {}, (_p3: any) => {
                            seen.push(loop.index);
                            return [this.text(String(loop.index))];
                        }),
                    ])
                ),
            ]);
        }, { path: 'test.loop-snapshot' });

        expect(seen).toEqual([0, 1, 2, 3]);
        expect(h.container.textContent).toBe('0123');
    });

    it('snapshot là bất biến — mutate LoopContext sau đó không đổi giá trị đã chụp', () => {
        const snaps: any[] = [];
        h = mountView(function (this: any) {
            const S = this.states.__;
            S.useState([1, 2, 3], 'xs');
            return this.wrapper((p: any) => [
                this.html('r', 'div', p, {}, (p2: any) =>
                    this.__foreach(S.getStateByKey('xs'), (x: any, _k: any, _i: any, loop: any) => {
                        snaps.push(loop);
                        return [this.html(`c-${x}`, 'i', p2, {}, () => [this.text(String(x))])];
                    })
                ),
            ]);
        }, { path: 'test.loop-frozen' });

        expect(snaps.map((s) => s.index)).toEqual([0, 1, 2]);
        expect(snaps.map((s) => s.iteration)).toEqual([1, 2, 3]);
        expect(snaps[0].first).toBe(true);
        expect(snaps[2].last).toBe(true);
        expect(snaps.every((s) => Object.isFrozen(s))).toBe(true);
        // Mỗi vòng một object riêng — không phải cùng một tham chiếu
        expect(new Set(snaps).size).toBe(3);
    });
});
