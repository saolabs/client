/**
 * FIX(F6, docs/FIX_PLAN_2026-08-14.md): state flush chạy trên RAF #1;
 * listener của Reactive gọi `ctx.scheduleUpdate()` lại đặt RAF #2
 * (ViewController.scheduleUpdate) — trong MỘT frame, `{{ }}` (Output patch
 * textContent ĐỒNG BỘ ngay trong listener) đã đổi nhưng `@foreach`/`@if`
 * (chờ RAF #2) thì CHƯA. Đo được: click → frame 1 → `{{ count }}` = "1"
 * nhưng list vẫn cũ; phải đợi frame 2 mới thấy list mới — DOM tạm thời
 * không nhất quán giữa hai loại binding trong CÙNG một tương tác.
 *
 * Bài test CỐ Ý chỉ chờ ĐÚNG MỘT `requestAnimationFrame` (không dùng
 * `nextFrame()` của `src/testing` — nó chờ 2 RAF nên sẽ che mất chính bug
 * này). Trước fix, assertion `@foreach` bên dưới đỏ sau 1 RAF, xanh sau 2.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mountView, type Harness } from '../../src/testing';

const oneFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe('State flush timing (F6) — Output và Reactive cùng nhất quán trong 1 frame', () => {
    let h: Harness | null = null;
    afterEach(() => {
        h?.destroy();
        h = null;
    });

    it('sau ĐÚNG 1 RAF: Output text VÀ @foreach structural đều đã mới', async () => {
        h = mountView(function (this: any) {
            const S = this.states.__;
            S.register('items', [1, 2]);
            return this.wrapper((p: any) => [
                this.html('root', 'div', p, { attrs: { id: { type: 'static', value: 'root' } } }, (p2: any) => [
                    this.html('len-wrap', 'span', p2, { attrs: { id: { type: 'static', value: 'len' } } }, (p3: any) => [
                        this.output('len-out', p3, true, ['items'], () => S.getStateByKey('items').length),
                    ]),
                    this.html('list-wrap', 'ul', p2, { attrs: { id: { type: 'static', value: 'list' } } }, (p3: any) => [
                        this.reactive('list-r', 'foreach', null, p3, ['items'], (_pr: any, pe: any) =>
                            this.__foreach(S.getStateByKey('items'), (item: any) => [
                                this.html(`li-${item}`, 'li', pe, {}, (_p4: any) => [this.text(String(item))]),
                            ])
                        ),
                    ]),
                ]),
            ]);
        }, { path: 'test.flush-timing' });

        const len = () => h!.container.querySelector('#len')!.textContent;
        const listCount = () => h!.container.querySelectorAll('#list li').length;

        expect(len()).toBe('2');
        expect(listCount()).toBe(2);

        h.setState('items', [1, 2, 3]);
        await oneFrame();

        // Output patch đồng bộ trong listener — luôn đúng, dù bug F6 còn sống hay không.
        expect(len()).toBe('3');
        // @foreach: TRƯỚC fix F6, cần RAF THỨ HAI mới cập nhật — sau đúng 1 RAF vẫn là 2.
        expect(listCount()).toBe(3);
    });
});
