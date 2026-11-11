import { afterEach, expect, it, vi } from 'vitest';
import path from 'node:path';
import { mount, type Harness } from '../../src/testing';
import { ViewController } from '../../src/core/view/ViewController';
import { Html } from '../../src/core/elements/Html';

/**
 * Nhân bản khuôn dòng của `@foreach` (11/2026) — output compiler THẬT, biên dịch
 * KHÔNG bật `fuseRows`: thân đủ điều kiện gộp thì đi FusedRow, không qua đường này.
 *
 * Dòng đầu dựng bình thường và thành khuôn; dòng sau `cloneNode` cả cây rồi các
 * element nhận lại node có sẵn. Bất biến duy nhất đáng gác: DOM và hành vi phải
 * GIỐNG HỆT khi tắt nhân bản (`ViewController.rowCloning = false`). Khuôn mang
 * theo chữ, class và marker của dòng làm khuôn — sót một chỗ không ghi lại là
 * dòng khác hiện dữ liệu của dòng đầu.
 */
let h: Harness | null = null;
const flush = () => { (h!.ctrl as any).states.__.flushNow(); (h!.ctrl as any).flushReactiveUpdatesNow(); };
const load = async (name: string) =>
    (await import(/* @vite-ignore */ path.join(__dirname, `../fixtures/compiled/.generated/${name.startsWith('memo-') ? 'js-nofuse' : 'js'}/${name}.js`))).default;
/** viewId mỗi lần mount một khác → quy về chung để so hai lần mount. */
const snapshot = () => h!.container.innerHTML.replace(new RegExp((h!.ctrl as any).viewId, 'g'), 'VIEW');
const rows = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ({ id: from + i, label: `row ${from + i}` }));

afterEach(() => { h?.destroy(); h = null; ViewController.rowCloning = true; Html.csrHydrateClass = false; });

async function scenario(name: string, cloning: boolean): Promise<string[]> {
    ViewController.rowCloning = cloning;
    h = mount(await load(name)); flush();
    const view = h.view as any, shots: string[] = [];
    const step = (act: () => void) => { act(); flush(); shots.push(snapshot()); };
    step(() => view.replace(rows(6)));                       // tạo
    step(() => view.select(3));                              // binding class trên dòng nhân bản
    step(() => view.replace([...view.current(), ...rows(4, 7)]));   // thêm: khuôn lấy từ lượt trước
    step(() => view.replace(view.current().filter((r: any) => r.id % 2)));
    step(() => view.replace(rows(5, 20)));                   // thay hết: dòng làm khuôn đã bị huỷ
    step(() => view.select(22));
    h.destroy(); h = null;
    return shots;
}

it.each(['memo-rows', 'memo-captured'])('%s: DOM giống hệt khi bật và tắt nhân bản khuôn', async (name) => {
    expect(await scenario(name, true)).toEqual(await scenario(name, false));
});

it('dòng sau dòng đầu được nhân bản, không dựng lại từng element', async () => {
    h = mount(await load('memo-rows')); flush();
    const create = vi.spyOn(document, 'createElement');
    (h.view as any).replace(rows(50)); flush();
    const created = create.mock.calls.filter(([tag]) => tag === 'li').length;
    create.mockRestore();
    expect(h.container.querySelectorAll('li')).toHaveLength(50);
    expect(created).toBe(0);                                 // khuôn đã có từ ba dòng lúc mount
    expect([...h.container.querySelectorAll('li')].map(li => `${li.getAttribute('data-id')}:${li.textContent}`))
        .toEqual(rows(50).map(r => `${r.id}:${r.label}`));
});

it('event trên dòng nhân bản gọi handler với dữ liệu của CHÍNH dòng đó', async () => {
    h = mount(await load('memo-captured')); flush();
    (h.view as any).replace(rows(5)); flush();
    (h.container.querySelector('li[data-id="4"]') as HTMLElement).click(); flush();
    expect((h.view as any).lastPick()).toEqual([4, 0]);
});

it('khuôn lấy từ dòng ĐANG được chọn không lây class sang dòng nhân bản', async () => {
    h = mount(await load('memo-rows')); flush();
    (h.view as any).select(1); flush();                      // dòng làm khuôn sẽ mang class `on`
    (h.view as any).replace(rows(4)); flush();
    expect([...h.container.querySelectorAll('li.on')].map(li => li.getAttribute('data-id'))).toEqual(['1']);
});

it('công tắc class hydrate cho kiểm thử: mỗi dòng nhân bản mang class của chính nó', async () => {
    Html.csrHydrateClass = true;
    h = mount(await load('memo-rows')); flush();
    (h.view as any).replace(rows(4)); flush();
    const hydrate = [...h.container.querySelectorAll('li')].map(li => [...li.classList].filter(c => c.includes('-'))[0]);
    expect(new Set(hydrate).size).toBe(4);
    expect(hydrate.every((c, i) => c.endsWith(`-${i + 1}`))).toBe(true);
});

it('dòng chứa thứ không nhân bản được (khối @if, component) vẫn dựng đúng bằng đường thường', async () => {
    const shots = async (cloning: boolean) => {
        ViewController.rowCloning = cloning;
        h = mount(await load('keyed-refresh')); flush();
        const view = h.view as any, out: string[] = [];
        for (const list of [
            [{ id: 1, name: 'one', tags: [{ id: 'a', label: 'alpha' }] }, { id: 2, name: 'two', tags: [] }],
            [{ id: 2, name: 'two!', tags: [{ id: 'b', label: 'beta' }] }, { id: 3, name: 'three', tags: [] }, { id: 1, name: 'one', tags: [] }],
        ]) { view.replace(list); flush(); out.push(snapshot()); }
        h.destroy(); h = null;
        return out;
    };
    expect(await shots(true)).toEqual(await shots(false));
});
