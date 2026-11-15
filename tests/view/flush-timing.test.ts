import { describe, it, expect, afterEach } from 'vitest';
import { mountView, type Harness } from '../../src/testing';
import { ViewState } from '../../src/core/view/ViewState';

const oneFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe('State flush timing', () => {
    let h: Harness | null = null;
    afterEach(() => {
        h?.destroy();
        h = null;
    });

    it('commits text and structural regions together before the next frame', async () => {
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
        expect(len()).toBe('2');
        await Promise.resolve();
        expect(len()).toBe('3');
        expect(listCount()).toBe(3);
    });

    it('invalidates queued work across flushNow, pause, resume and destroy', async () => {
        const state = new ViewState().__;
        const set = state.register('count', 0);
        const seen: number[] = [];
        state.subscribe('count', value => seen.push(value));

        set(1); set(2);
        state.flushNow();
        set(3);
        state.pause();
        set(4); set(5);
        await Promise.resolve();
        expect(seen).toEqual([2, 3]);

        state.resume();
        set(6);
        state.destroy();
        await oneFrame();
        expect(seen).toEqual([2, 3, 5]);
    });
});
