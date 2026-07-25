/**
 * Baseline tests cho Reactive (@if/@foreach) — RUNTIME_CONTRACT.md mục 2 (quy tắc render).
 * Tập trung vào 2 bug đã biết: vị trí chèn khi re-render, và start() children mới.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mountView, nextFrame, visibleText, Harness } from '../helpers/harness';

let h: Harness | null = null;
afterEach(() => { h?.destroy(); h = null; });

describe('Reactive — @if cơ bản', () => {
    function ifView() {
        return mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('root', 'div', parent, {}, (p: any) => [
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

    it('điều kiện false → không render nội dung', () => {
        h = ifView();
        expect(h.container.querySelector('p')).toBeNull();
    });

    it('toggle false → true: render nội dung sau RAF', async () => {
        h = ifView();
        h.setState('show', true);
        await nextFrame();
        expect(h.container.querySelector('p')?.textContent).toBe('visible');
    });

    it('toggle true → false: clear nội dung giữa markers', async () => {
        h = ifView();
        h.setState('show', true);
        await nextFrame();
        h.setState('show', false);
        await nextFrame();
        expect(h.container.querySelector('p')).toBeNull();
    });
});

describe('Reactive — vị trí chèn khi re-render (bug đã biết)', () => {
    it('nội dung re-render phải nằm TRƯỚC sibling đứng sau reactive', async () => {
        // <div> [reactive @if] <span>after</span> </div>
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('root', 'div', parent, {}, (p: any) => [
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
        await nextFrame();

        const root = h.container.querySelector('div')!;
        const p = root.querySelector('p')!;
        const span = root.querySelector('span')!;
        expect(p).not.toBeNull();
        // p phải đứng trước span trong DOM order
        // ⚠ có thể RED: Html child dùng insertBeforeClose (đúng), nhưng kiểm tra để chốt baseline
        expect(p.compareDocumentPosition(span) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('Output bên trong reactive re-render phải nằm giữa markers, không bị đẩy xuống cuối parent', async () => {
        // <div> [reactive: {{ msg }}] <span>tail</span> </div>
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('root', 'div', parent, {}, (p: any) => [
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
        await nextFrame();

        const root = h.container.querySelector('div')!;
        // ⚠ RED dự kiến: Output.render() appendChild vào CUỐI root thay vì giữa reactive markers
        // → textContent order sẽ là "tailinner" thay vì "innertail"
        expect(visibleText(root)).toBe('innertail');
    });
});

describe('Reactive — reactivity của children sinh ra khi re-render (bug đã biết)', () => {
    it('Output tạo trong re-render phải được start() — đổi state sau đó vẫn update', async () => {
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('root', 'div', parent, {}, (p: any) => [
                    this.reactive('r1', 'if', null, p, ['show'], () => {
                        if (manager.states['show'].value) {
                            return [
                                this.html('inner', 'em', p, {}, (p2: any) => [
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
        await nextFrame();
        expect(visibleText(h.container.querySelector('em')!)).toBe('v1');

        // đổi msg — output này được tạo TRONG re-render
        h.setState('msg', 'v2');
        await nextFrame();
        // ⚠ RED dự kiến: Reactive.render() không gọi start() cho children mới
        expect(visibleText(h.container.querySelector('em')!)).toBe('v2');
    });
});

describe('Registry — reuse sau destroy (toggle 2 vòng)', () => {
    it('toggle true→false→true: element registry không trả về corpse, nội dung + event vẫn hoạt động', async () => {
        let clicks = 0;
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('root', 'div', parent, {}, (p: any) => [
                    this.reactive('r1', 'if', null, p, ['show'], () => {
                        if (manager.states['show'].value) {
                            return [
                                this.html('btn1', 'button', p, {
                                    events: { click: [() => clicks++] },
                                }, (p2: any) => [
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
        expect(visibleText(h.container.querySelector('button')!)).toBe('hello');

        // Tắt — children bị destroy
        h.setState('show', false);
        await nextFrame();
        expect(h.container.querySelector('button')).toBeNull();

        // Bật lại — registry phải tạo MỚI thay vì trả corpse đã destroy
        h.setState('show', true);
        await nextFrame();
        const btn = h.container.querySelector('button');
        expect(btn).not.toBeNull();
        expect(visibleText(btn as HTMLElement)).toBe('hello');

        // Event phải hoạt động
        btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clicks).toBe(1);

        // Output mới phải reactive
        h.setState('msg', 'world');
        await nextFrame();
        expect(visibleText(h.container.querySelector('button')!)).toBe('world');
    });
});

describe('Reactive — @foreach', () => {
    it('render danh sách + cập nhật khi list đổi (full re-render baseline)', async () => {
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('ul1', 'ul', parent, {}, (p: any) => [
                    this.reactive('r1', 'foreach', null, p, ['items'], () =>
                        this.__foreach(manager.states['items'].value, (item: any, _k, i) => [
                            this.html(`li-${i}`, 'li', p, {}, () => [this.text(String(item))]),
                        ])
                    ),
                ]),
            ]);
        }, { states: { items: ['a', 'b'] } });

        expect(h.container.querySelectorAll('li').length).toBe(2);

        h.setState('items', ['a', 'b', 'c']);
        await nextFrame();
        expect(h.container.querySelectorAll('li').length).toBe(3);
        expect(visibleText(h.container.querySelector('ul')!)).toBe('abc');
    });
});

describe('ViewController.start()', () => {
    it('ctrl.start() phải kích hoạt subscriptions của tree (không cần gọi wrapper.start() tay)', async () => {
        // Harness mặc định gọi wrapper.start() — test này tự mount không start wrapper
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('el1', 'span', parent, {}, (p: any) => [
                    this.output('o1', p, true, ['x'], () => manager.states['x'].value),
                ]),
            ]);
        }, { states: { x: '1' } });

        // Lifecycle phải đi qua controller để state nội bộ và element tree đồng bộ.
        h.ctrl.stop();
        h.ctrl.start();

        h.setState('x', '2');
        await nextFrame();
        expect(visibleText(h.container.querySelector('span')!)).toBe('2');
    });
});
