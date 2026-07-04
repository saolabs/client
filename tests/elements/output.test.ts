/**
 * Baseline tests cho Output ({{ }} / {!! !!}) — theo RUNTIME_CONTRACT.md mục 3.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mountView, nextFrame, visibleText, Harness } from '../helpers/harness';

let h: Harness | null = null;
afterEach(() => { h?.destroy(); h = null; });

describe('Output — {{ }} escaped', () => {
    it('render giá trị ban đầu giữa markers', () => {
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('el1', 'span', parent, {}, (p: any) => [
                    this.output('o1', p, true, ['name'], () => manager.states['name'].value),
                ]),
            ]);
        }, { states: { name: 'hello' } });

        expect(visibleText(h.container.querySelector('span')!)).toBe('hello');
    });

    it('cập nhật khi state đổi (sau RAF flush)', async () => {
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('el1', 'span', parent, {}, (p: any) => [
                    this.output('o1', p, true, ['name'], () => manager.states['name'].value),
                ]),
            ]);
        }, { states: { name: 'a' } });

        h.setState('name', 'b');
        await nextFrame();
        expect(visibleText(h.container.querySelector('span')!)).toBe('b');
    });

    it('KHÔNG double-escape: {{ "<b>" }} hiển thị literal "<b>" (textContent === "<b>")', () => {
        h = mountView(function () {
            return this.wrapper((parent: any) => [
                this.html('el1', 'span', parent, {}, (p: any) => [
                    this.output('o1', p, true, [], () => '<b>bold</b>'),
                ]),
            ]);
        });
        // ⚠ RED hiện tại: escapeHTML() rồi gán textContent → hiển thị "&lt;b&gt;bold&lt;/b&gt;"
        // Text node tự an toàn — textContent phải là chuỗi gốc.
        expect(visibleText(h.container.querySelector('span')!)).toBe('<b>bold</b>');
        expect(h.container.querySelector('b')).toBeNull(); // vẫn không được tạo element thật
    });
});

describe('Output — {!! !!} raw', () => {
    it('render raw HTML thành element thật giữa markers', () => {
        h = mountView(function () {
            return this.wrapper((parent: any) => [
                this.html('el1', 'div', parent, {}, (p: any) => [
                    this.output('o1', p, false, [], () => '<b class="raw">bold</b>'),
                ]),
            ]);
        });
        // ⚠ RED hiện tại: raw HTML cũng đi qua createTextNode → không có <b>
        expect(h.container.querySelector('b.raw')).not.toBeNull();
        expect(h.container.querySelector('b.raw')?.textContent).toBe('bold');
    });
});
