"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Baseline tests cho Output ({{ }} / {!! !!}) — theo RUNTIME_CONTRACT.md mục 3.
 */
const vitest_1 = require("vitest");
const harness_1 = require("../helpers/harness");
let h = null;
(0, vitest_1.afterEach)(() => { h?.destroy(); h = null; });
(0, vitest_1.describe)('Output — {{ }} escaped', () => {
    (0, vitest_1.it)('render giá trị ban đầu giữa markers', () => {
        h = (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
                this.html('el1', 'span', parent, {}, (p) => [
                    this.output('o1', p, true, ['name'], () => manager.states['name'].value),
                ]),
            ]);
        }, { states: { name: 'hello' } });
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('span'))).toBe('hello');
    });
    (0, vitest_1.it)('cập nhật khi state đổi (sau RAF flush)', async () => {
        h = (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
                this.html('el1', 'span', parent, {}, (p) => [
                    this.output('o1', p, true, ['name'], () => manager.states['name'].value),
                ]),
            ]);
        }, { states: { name: 'a' } });
        h.setState('name', 'b');
        await (0, harness_1.nextFrame)();
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('span'))).toBe('b');
    });
    (0, vitest_1.it)('KHÔNG double-escape: {{ "<b>" }} hiển thị literal "<b>" (textContent === "<b>")', () => {
        h = (0, harness_1.mountView)(function () {
            return this.wrapper((parent) => [
                this.html('el1', 'span', parent, {}, (p) => [
                    this.output('o1', p, true, [], () => '<b>bold</b>'),
                ]),
            ]);
        });
        // ⚠ RED hiện tại: escapeHTML() rồi gán textContent → hiển thị "&lt;b&gt;bold&lt;/b&gt;"
        // Text node tự an toàn — textContent phải là chuỗi gốc.
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('span'))).toBe('<b>bold</b>');
        (0, vitest_1.expect)(h.container.querySelector('b')).toBeNull(); // vẫn không được tạo element thật
    });
});
(0, vitest_1.describe)('Output — {!! !!} raw', () => {
    (0, vitest_1.it)('render raw HTML thành element thật giữa markers', () => {
        h = (0, harness_1.mountView)(function () {
            return this.wrapper((parent) => [
                this.html('el1', 'div', parent, {}, (p) => [
                    this.output('o1', p, false, [], () => '<b class="raw">bold</b>'),
                ]),
            ]);
        });
        // ⚠ RED hiện tại: raw HTML cũng đi qua createTextNode → không có <b>
        (0, vitest_1.expect)(h.container.querySelector('b.raw')).not.toBeNull();
        (0, vitest_1.expect)(h.container.querySelector('b.raw')?.textContent).toBe('bold');
    });
});
