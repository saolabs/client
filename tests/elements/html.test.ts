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

const NS_SVG = 'http://www.w3.org/2000/svg';
const NS_HTML = 'http://www.w3.org/1999/xhtml';

describe('Html — svg namespace', () => {
    it('tag camelCase phải ra đúng lớp SVG, không phải SVGElement trơ', () => {
        // createElementNS KHÔNG có bảng điều chỉnh tên tag như parser HTML:
        // 'clippath' ra SVGElement trơ (không cắt gì), 'clipPath' mới ra
        // SVGClipPathElement. Compiler giữ đúng hoa/thường qua SVG_TAG_ADJUST.
        h = mountView(function () {
            return this.wrapper((p: any) => [
                this.html('s1', 'svg', p, {}, (sp: any) => [
                    this.html('c1', 'clipPath', sp, {}, () => []),
                    this.html('g1', 'linearGradient', sp, {}, () => []),
                    this.html('f1', 'feGaussianBlur', sp, {}, () => []),
                ]),
            ]);
        });

        const kids = h.container.querySelector('svg')!.children;
        expect(kids[0].tagName).toBe('clipPath');
        expect(kids[1].tagName).toBe('linearGradient');
        // `feGaussianBlur` chưa từng nằm trong danh sách tag nào — nó đúng nhờ
        // kế thừa namespace của cha, đó là lý do không cần liệt kê tag SVG.
        expect(kids[2].tagName).toBe('feGaussianBlur');
        for (const k of kids) expect(k.namespaceURI).toBe(NS_SVG);
    });

    it('foreignObject CẮT kế thừa: con của nó là HTML', () => {
        // Đây là toàn bộ lý do foreignObject tồn tại. Parser của trình duyệt
        // làm đúng khi đọc markup SSR — CSR sai là lệch SSR/CSR.
        h = mountView(function () {
            return this.wrapper((p: any) => [
                this.html('s1', 'svg', p, {}, (sp: any) => [
                    this.html('fo1', 'foreignObject', sp, {}, (fp: any) => [
                        this.html('d1', 'div', fp, {}, () => []),
                    ]),
                ]),
            ]);
        });

        const fo = h.container.querySelector('svg')!.children[0];
        expect(fo.tagName).toBe('foreignObject');
        expect(fo.namespaceURI).toBe(NS_SVG);
        expect(fo.children[0].namespaceURI).toBe(NS_HTML);
    });

    it('tag trùng tên HTML nằm ngoài svg vẫn là HTML', () => {
        // 'a', 'title', 'style', 'script', 'text', 'image' có ở cả hai bên —
        // nhận diện theo danh sách tag sẽ kéo nhầm chúng sang SVG.
        h = mountView(function () {
            return this.wrapper((p: any) => [
                this.html('a1', 'a', p, {}, () => []),
                this.html('t1', 'title', p, {}, () => []),
            ]);
        });

        expect(h.container.querySelector('a')!.namespaceURI).toBe(NS_HTML);
        expect(h.container.querySelector('title')!.namespaceURI).toBe(NS_HTML);
    });

    it('creates svg and its children with SVG namespace', () => {
        h = mountView(function () {
            return this.wrapper((parent: any) => [
                this.html('icon1', 'svg', parent, {
                    attrs: { viewBox: { type: 'static', value: '0 0 24 24' } },
                }, (svgParent: any) => [
                    this.html('path1', 'path', svgParent, {
                        attrs: { d: { type: 'static', value: 'M0 0' } },
                    }, () => []),
                    this.html('circle1', 'circle', svgParent, {
                        attrs: { r: { type: 'static', value: '4' } },
                    }, () => []),
                ]),
            ]);
        });

        const svg = h.container.querySelector('svg');
        const path = h.container.querySelector('path');
        const circle = h.container.querySelector('circle');

        expect(svg).not.toBeNull();
        expect(svg?.namespaceURI).toBe('http://www.w3.org/2000/svg');
        expect(path?.namespaceURI).toBe('http://www.w3.org/2000/svg');
        expect(circle?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    });
});
