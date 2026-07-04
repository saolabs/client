"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Baseline tests cho Reactive (@if/@foreach) — RUNTIME_CONTRACT.md mục 2 (quy tắc render).
 * Tập trung vào 2 bug đã biết: vị trí chèn khi re-render, và start() children mới.
 */
const vitest_1 = require("vitest");
const harness_1 = require("../helpers/harness");
let h = null;
(0, vitest_1.afterEach)(() => { h?.destroy(); h = null; });
(0, vitest_1.describe)('Reactive — @if cơ bản', () => {
    function ifView() {
        return (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
                this.html('root', 'div', parent, {}, (p) => [
                    this.reactive('r1', 'if', null, p, ['show'], () => {
                        if (manager.states['show'].value) {
                            return [
                                this.html('p1', 'p', p, {}, () => [this.text('visible')]),
                            ];
                        }
                        return [];
                    }),
                ]),
            ]);
        }, { states: { show: false } });
    }
    (0, vitest_1.it)('điều kiện false → không render nội dung', () => {
        h = ifView();
        (0, vitest_1.expect)(h.container.querySelector('p')).toBeNull();
    });
    (0, vitest_1.it)('toggle false → true: render nội dung sau RAF', async () => {
        h = ifView();
        h.setState('show', true);
        await (0, harness_1.nextFrame)();
        (0, vitest_1.expect)(h.container.querySelector('p')?.textContent).toBe('visible');
    });
    (0, vitest_1.it)('toggle true → false: clear nội dung giữa markers', async () => {
        h = ifView();
        h.setState('show', true);
        await (0, harness_1.nextFrame)();
        h.setState('show', false);
        await (0, harness_1.nextFrame)();
        (0, vitest_1.expect)(h.container.querySelector('p')).toBeNull();
    });
});
(0, vitest_1.describe)('Reactive — vị trí chèn khi re-render (bug đã biết)', () => {
    (0, vitest_1.it)('nội dung re-render phải nằm TRƯỚC sibling đứng sau reactive', async () => {
        // <div> [reactive @if] <span>after</span> </div>
        h = (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
                this.html('root', 'div', parent, {}, (p) => [
                    this.reactive('r1', 'if', null, p, ['show'], () => {
                        if (manager.states['show'].value) {
                            return [this.html('p1', 'p', p, {}, () => [this.text('inside')])];
                        }
                        return [];
                    }),
                    this.html('after', 'span', p, {}, () => [this.text('after')]),
                ]),
            ]);
        }, { states: { show: false } });
        h.setState('show', true);
        await (0, harness_1.nextFrame)();
        const root = h.container.querySelector('div');
        const p = root.querySelector('p');
        const span = root.querySelector('span');
        (0, vitest_1.expect)(p).not.toBeNull();
        // p phải đứng trước span trong DOM order
        // ⚠ có thể RED: Html child dùng insertBeforeClose (đúng), nhưng kiểm tra để chốt baseline
        (0, vitest_1.expect)(p.compareDocumentPosition(span) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    (0, vitest_1.it)('Output bên trong reactive re-render phải nằm giữa markers, không bị đẩy xuống cuối parent', async () => {
        // <div> [reactive: {{ msg }}] <span>tail</span> </div>
        h = (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
                this.html('root', 'div', parent, {}, (p) => [
                    this.reactive('r1', 'if', null, p, ['show'], () => {
                        if (manager.states['show'].value) {
                            return [
                                this.output('o1', p, true, ['msg'], () => manager.states['msg'].value),
                            ];
                        }
                        return [];
                    }),
                    this.html('after', 'span', p, {}, () => [this.text('tail')]),
                ]),
            ]);
        }, { states: { show: false, msg: 'inner' } });
        h.setState('show', true);
        await (0, harness_1.nextFrame)();
        const root = h.container.querySelector('div');
        // ⚠ RED dự kiến: Output.render() appendChild vào CUỐI root thay vì giữa reactive markers
        // → textContent order sẽ là "tailinner" thay vì "innertail"
        (0, vitest_1.expect)((0, harness_1.visibleText)(root)).toBe('innertail');
    });
});
(0, vitest_1.describe)('Reactive — reactivity của children sinh ra khi re-render (bug đã biết)', () => {
    (0, vitest_1.it)('Output tạo trong re-render phải được start() — đổi state sau đó vẫn update', async () => {
        h = (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
                this.html('root', 'div', parent, {}, (p) => [
                    this.reactive('r1', 'if', null, p, ['show'], () => {
                        if (manager.states['show'].value) {
                            return [
                                this.html('inner', 'em', p, {}, (p2) => [
                                    this.output('o1', p2, true, ['msg'], () => manager.states['msg'].value),
                                ]),
                            ];
                        }
                        return [];
                    }),
                ]),
            ]);
        }, { states: { show: false, msg: 'v1' } });
        // bật if → em + output xuất hiện
        h.setState('show', true);
        await (0, harness_1.nextFrame)();
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('em'))).toBe('v1');
        // đổi msg — output này được tạo TRONG re-render
        h.setState('msg', 'v2');
        await (0, harness_1.nextFrame)();
        // ⚠ RED dự kiến: Reactive.render() không gọi start() cho children mới
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('em'))).toBe('v2');
    });
});
(0, vitest_1.describe)('Registry — reuse sau destroy (toggle 2 vòng)', () => {
    (0, vitest_1.it)('toggle true→false→true: element registry không trả về corpse, nội dung + event vẫn hoạt động', async () => {
        let clicks = 0;
        h = (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
                this.html('root', 'div', parent, {}, (p) => [
                    this.reactive('r1', 'if', null, p, ['show'], () => {
                        if (manager.states['show'].value) {
                            return [
                                this.html('btn1', 'button', p, {
                                    events: { click: [() => clicks++] },
                                }, (p2) => [
                                    this.output('o1', p2, true, ['msg'], () => manager.states['msg'].value),
                                ]),
                            ];
                        }
                        return [];
                    }),
                ]),
            ]);
        }, { states: { show: true, msg: 'hello' } });
        // Vòng 1: hiện
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('button'))).toBe('hello');
        // Tắt — children bị destroy
        h.setState('show', false);
        await (0, harness_1.nextFrame)();
        (0, vitest_1.expect)(h.container.querySelector('button')).toBeNull();
        // Bật lại — registry phải tạo MỚI thay vì trả corpse đã destroy
        h.setState('show', true);
        await (0, harness_1.nextFrame)();
        const btn = h.container.querySelector('button');
        (0, vitest_1.expect)(btn).not.toBeNull();
        (0, vitest_1.expect)((0, harness_1.visibleText)(btn)).toBe('hello');
        // Event phải hoạt động
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        (0, vitest_1.expect)(clicks).toBe(1);
        // Output mới phải reactive
        h.setState('msg', 'world');
        await (0, harness_1.nextFrame)();
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('button'))).toBe('world');
    });
});
(0, vitest_1.describe)('Reactive — @foreach', () => {
    (0, vitest_1.it)('render danh sách + cập nhật khi list đổi (full re-render baseline)', async () => {
        h = (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
                this.html('ul1', 'ul', parent, {}, (p) => [
                    this.reactive('r1', 'foreach', null, p, ['items'], () => this.__foreach(manager.states['items'].value, (item, _k, i) => [
                        this.html(`li-${i}`, 'li', p, {}, () => [this.text(String(item))]),
                    ])),
                ]),
            ]);
        }, { states: { items: ['a', 'b'] } });
        (0, vitest_1.expect)(h.container.querySelectorAll('li').length).toBe(2);
        h.setState('items', ['a', 'b', 'c']);
        await (0, harness_1.nextFrame)();
        (0, vitest_1.expect)(h.container.querySelectorAll('li').length).toBe(3);
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('ul'))).toBe('abc');
    });
});
(0, vitest_1.describe)('ViewController.start() (bug đã biết: _rootTree không bao giờ được gán)', () => {
    (0, vitest_1.it)('ctrl.start() phải kích hoạt subscriptions của tree (không cần gọi wrapper.start() tay)', async () => {
        // Harness mặc định gọi wrapper.start() — test này tự mount không start wrapper
        h = (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
                this.html('el1', 'span', parent, {}, (p) => [
                    this.output('o1', p, true, ['x'], () => manager.states['x'].value),
                ]),
            ]);
        }, { states: { x: '1' } });
        // stop những gì harness đã start, rồi thử start qua ctrl
        h.wrapper.stop();
        h.ctrl.start();
        h.setState('x', '2');
        await (0, harness_1.nextFrame)();
        // ⚠ RED dự kiến: ctrl.start() no-op vì _rootTree = null
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('span'))).toBe('2');
    });
});
