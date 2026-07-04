"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Baseline tests cho Html element — theo docs/RUNTIME_CONTRACT.md mục 1, 4.
 * Test ĐỎ = bug đã biết (đánh dấu ⚠ trong contract), sẽ xanh sau Phase 1.
 */
const vitest_1 = require("vitest");
const harness_1 = require("../helpers/harness");
let h = null;
(0, vitest_1.afterEach)(() => { h?.destroy(); h = null; });
(0, vitest_1.describe)('Html — attrs', () => {
    (0, vitest_1.it)("set attr tĩnh với type: 'static' (contract chuẩn — compiler đang emit dạng này)", () => {
        h = (0, harness_1.mountView)(function () {
            return this.wrapper((parent) => [
                this.html('el1', 'div', parent, {
                    attrs: { 'data-x': { type: 'static', value: '123' } },
                }, () => []),
            ]);
        });
        const div = h.container.querySelector('div.el1, div');
        // ⚠ RED hiện tại: Html.ts chỉ xử lý type 'value', bỏ qua 'static'
        (0, vitest_1.expect)(div?.getAttribute('data-x')).toBe('123');
    });
    (0, vitest_1.it)('attr binding cập nhật khi state đổi', async () => {
        let count = 0;
        h = (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
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
        (0, vitest_1.expect)(div?.getAttribute('data-count')).toBe('0');
        h.setState('count', 5);
        await (0, harness_1.nextFrame)();
        (0, vitest_1.expect)(div?.getAttribute('data-count')).toBe('5');
    });
});
(0, vitest_1.describe)('Html — static text (this.text)', () => {
    (0, vitest_1.it)('text tĩnh phải được mount vào DOM (compiled output dùng this.text rất nhiều)', () => {
        h = (0, harness_1.mountView)(function () {
            return this.wrapper((parent) => [
                this.html('el1', 'p', parent, {}, () => [this.text('hello world')]),
            ]);
        });
        // ⚠ RED phát hiện qua baseline: ctrl.text() trả raw Text node (không saoType)
        // → mountElementList/Reactive.render bỏ qua → text tĩnh biến mất
        (0, vitest_1.expect)(h.container.querySelector('p')?.textContent).toBe('hello world');
    });
});
(0, vitest_1.describe)('Html — classes', () => {
    (0, vitest_1.it)('class static (array form theo contract)', () => {
        h = (0, harness_1.mountView)(function () {
            return this.wrapper((parent) => [
                this.html('el1', 'div', parent, {
                    classes: [{ type: 'static', value: 'active' }],
                }, () => []),
            ]);
        });
        (0, vitest_1.expect)(h.container.querySelector('div')?.classList.contains('active')).toBe(true);
    });
    (0, vitest_1.it)('class binding toggle theo state', async () => {
        h = (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
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
        const div = h.container.querySelector('div');
        (0, vitest_1.expect)(div.classList.contains('is-open')).toBe(false);
        h.setState('open', true);
        await (0, harness_1.nextFrame)();
        (0, vitest_1.expect)(div.classList.contains('is-open')).toBe(true);
    });
});
(0, vitest_1.describe)('Html — events', () => {
    (0, vitest_1.it)("handler dạng string resolve method trên view (compiler emit {handler:'increment'})", () => {
        let called = 0;
        h = (0, harness_1.mountView)(function () {
            return this.wrapper((parent) => [
                this.html('btn1', 'button', parent, {
                    events: { click: [{ handler: 'increment', params: [] }] },
                }, () => [this.text('+')]),
            ]);
        }, { methods: { increment() { called++; } } });
        h.container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        (0, vitest_1.expect)(called).toBe(1);
    });
    (0, vitest_1.it)('handler closure trực tiếp', () => {
        let called = 0;
        h = (0, harness_1.mountView)(function () {
            return this.wrapper((parent) => [
                this.html('btn1', 'button', parent, {
                    events: { click: [() => called++] },
                }, () => []),
            ]);
        });
        h.container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        (0, vitest_1.expect)(called).toBe(1);
    });
    (0, vitest_1.it)('destroy() gỡ toàn bộ event listener (AbortController tập trung)', () => {
        let called = 0;
        h = (0, harness_1.mountView)(function () {
            return this.wrapper((parent) => [
                this.html('btn1', 'button', parent, {
                    events: { click: [() => called++] },
                }, () => []),
            ]);
        });
        const btn = h.container.querySelector('button');
        h.ctrl.destroy();
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        (0, vitest_1.expect)(called).toBe(0);
    });
});
