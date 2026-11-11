import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import path from 'node:path';
import { mount, type Harness } from '../../src/testing';
import { ViewController } from '../../src/core/view/ViewController';

/**
 * `@foreach` giữ nguyên dòng không đổi (11/11/2026) — output compiler THẬT.
 *
 * Đo bằng số lần `html()` được gọi trong một lượt render: mỗi dòng chạy lại là
 * một lần gọi cho `<li>`. Mỗi test dưới đây là một lý do BUỘC phải chạy lại;
 * thiếu một cái là UI hiển thị dữ liệu cũ mà không có gì báo.
 */
let h: Harness;
let html: ReturnType<typeof vi.spyOn>;
const flush = () => { (h.ctrl as any).states.__.flushNow(); (h.ctrl as any).flushReactiveUpdatesNow(); };
const rerun = (act: () => void): number => { html.mockClear(); act(); flush(); return html.mock.calls.length; };
const labels = () => [...h.container.querySelectorAll('li')].map(li => li.textContent);
const view = () => h.view as any;

beforeEach(async () => {
    const mod = await import(/* @vite-ignore */ path.join(__dirname, '../fixtures/compiled/.generated/js/memo-rows.js'));
    h = mount(mod.default);
    flush();
    html = vi.spyOn(h.ctrl as any, 'html');
    // Lượt đầu sau mount: để lại dấu cho các lượt sau đối chiếu.
    view().replace(view().current().slice()); flush();
});
afterEach(() => { html.mockRestore(); h.destroy(); ViewController.foreachMemo = true; });

it('chỉ chạy lại dòng có item mới; dòng cùng reference được giữ nguyên', () => {
    const [a, b, c] = view().current();
    expect(rerun(() => view().replace([a, { id: 2, label: 'B' }, c]))).toBe(1);
    expect(labels()).toEqual(['a', 'B', 'c']);
    expect(rerun(() => view().replace([c, a]))).toBe(0);
    expect(labels()).toEqual(['c', 'a']);
});

it('sửa thuộc tính của item tại chỗ → chạy lại để hiện giá trị mới', () => {
    const rows = view().current();
    rows[0].label = 'đổi';
    flush();
    expect(labels()).toEqual(['đổi', 'b', 'c']);
});

it('thêm khoá mới vào item rồi set mảng mới → dòng đó chạy lại', () => {
    const rows = view().current();
    rows[1].extra = true;                       // khoá mới: hook mutate không thấy
    expect(rerun(() => view().replace(rows.slice()))).toBe(1);
});

it('set lại đúng mảng cũ (tuyên bố đã mutate) → mọi dòng chạy lại', () => {
    // Bản production: set cùng reference luôn được coi là "vừa mutate". (Bản
    // dev so nội dung trước và chỉ cảnh báo nếu không thấy gì đổi.)
    (h.ctrl as any).states.__.setMutationDiagnostics(false);
    const rows = view().current();
    expect(rerun(() => view().replace(rows))).toBe(3);
});

it('state khác của view đổi → lượt danh sách kế tiếp chạy lại hết, lượt sau nữa thì không', () => {
    const rows = view().current();
    view().select(2); flush();
    expect(h.container.querySelector('li.on')?.getAttribute('data-id')).toBe('2');
    expect(rerun(() => view().replace(rows.slice()))).toBe(3);
    expect(rerun(() => view().replace(rows.slice()))).toBe(0);
});

it('item không được state quan sát (instance class) → không bao giờ bỏ qua', () => {
    class Row { constructor(public id: number, public label: string) {} }
    const rows = [new Row(1, 'x'), new Row(2, 'y')];
    view().replace(rows); flush();
    rows[0].label = 'X';                        // không hook nào thấy
    expect(rerun(() => view().replace(rows.slice()))).toBe(2);
    expect(labels()).toEqual(['X', 'y']);
});

it('công tắc ViewController.foreachMemo = false trả về hành vi cũ', () => {
    ViewController.foreachMemo = false;
    expect(rerun(() => view().replace(view().current().slice()))).toBe(3);
});
