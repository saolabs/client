/**
 * Baseline tests cho Html element — theo docs/RUNTIME_CONTRACT.md mục 1, 4.
 * Test ĐỎ = bug đã biết (đánh dấu ⚠ trong contract), sẽ xanh sau Phase 1.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mountView, nextFrame, Harness } from '../helpers/harness';

let h: Harness | null = null;
afterEach(() => { h?.destroy(); h = null; });

describe('Html — attrs', () => {
    it("set attr tĩnh với type: 'static' (contract chuẩn — compiler đang emit dạng này)", () => {
        h = mountView(function () {
            return this.wrapper((parent: any) => [
                this.html('el1', 'div', parent, {
                    attrs: { 'data-x': { type: 'static', value: '123' } },
                }, () => []),
            ]);
        });
        const div = h.container.querySelector('div.el1, div');
        // ⚠ RED hiện tại: Html.ts chỉ xử lý type 'value', bỏ qua 'static'
        expect(div?.getAttribute('data-x')).toBe('123');
    });

    it('attr binding cập nhật khi state đổi', async () => {
        let count = 0;
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('el1', 'div', parent, {
                    attrs: {
                        'data-count': {
                            type: 'binding',
                            factory: () => String(manager.states['count'].value),
                            stateKeys: ['count'],
                        },
                    },
                }, () => []),
            ]);
        }, { states: { count: 0 } });

        const div = h.container.querySelector('div');
        expect(div?.getAttribute('data-count')).toBe('0');

        h.setState('count', 5);
        await nextFrame();
        expect(div?.getAttribute('data-count')).toBe('5');
    });
});

describe('Html — static text (this.text)', () => {
    it('text tĩnh phải được mount vào DOM (compiled output dùng this.text rất nhiều)', () => {
        h = mountView(function () {
            return this.wrapper((parent: any) => [
                this.html('el1', 'p', parent, {}, () => [this.text('hello world')]),
            ]);
        });
        // ⚠ RED phát hiện qua baseline: ctrl.text() trả raw Text node (không saoType)
        // → mountElementList/Reactive.render bỏ qua → text tĩnh biến mất
        expect(h.container.querySelector('p')?.textContent).toBe('hello world');
    });
});

describe('Html — classes', () => {
    it('class static (array form theo contract)', () => {
        h = mountView(function () {
            return this.wrapper((parent: any) => [
                this.html('el1', 'div', parent, {
                    classes: [{ type: 'static', value: 'active' }],
                }, () => []),
            ]);
        });
        expect(h.container.querySelector('div')?.classList.contains('active')).toBe(true);
    });

    it('class binding toggle theo state', async () => {
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('el1', 'div', parent, {
                    classes: [{
                        type: 'binding',
                        value: 'is-open',
                        factory: () => manager.states['open'].value,
                        stateKeys: ['open'],
                    }],
                }, () => []),
            ]);
        }, { states: { open: false } });

        const div = h.container.querySelector('div')!;
        expect(div.classList.contains('is-open')).toBe(false);

        h.setState('open', true);
        await nextFrame();
        expect(div.classList.contains('is-open')).toBe(true);
    });
});

describe('Html — events', () => {
    it("handler dạng string resolve method trên view (compiler emit {handler:'increment'})", () => {
        let called = 0;
        h = mountView(function () {
            return this.wrapper((parent: any) => [
                this.html('btn1', 'button', parent, {
                    events: { click: [{ handler: 'increment', params: [] }] },
                }, () => [this.text('+')]),
            ]);
        }, { methods: { increment() { called++; } } });

        h.container.querySelector('button')!.dispatchEvent(
            new MouseEvent('click', { bubbles: true })
        );
        expect(called).toBe(1);
    });

    it('handler closure trực tiếp', () => {
        let called = 0;
        h = mountView(function () {
            return this.wrapper((parent: any) => [
                this.html('btn1', 'button', parent, {
                    events: { click: [() => called++] },
                }, () => []),
            ]);
        });
        h.container.querySelector('button')!.dispatchEvent(
            new MouseEvent('click', { bubbles: true })
        );
        expect(called).toBe(1);
    });

    it('destroy() gỡ toàn bộ event listener (AbortController tập trung)', () => {
        let called = 0;
        h = mountView(function () {
            return this.wrapper((parent: any) => [
                this.html('btn1', 'button', parent, {
                    events: { click: [() => called++] },
                }, () => []),
            ]);
        });
        const btn = h.container.querySelector('button')!;
        h.ctrl.destroy();
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(called).toBe(0);
    });
});
