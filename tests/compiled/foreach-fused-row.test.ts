import { afterEach, expect, it, vi } from 'vitest';
import path from 'node:path';
import { mount, type Harness } from '../../src/testing';
import { Html } from '../../src/core/elements/Html';
import { FusedRow } from '../../src/core/elements/FusedRow';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

/**
 * Dòng gộp của `@foreach` (FusedRow, 11/2026) — output compiler THẬT.
 *
 * Cùng một `.sao` được biên dịch hai lần (globalSetup): `.generated/js` có dòng
 * gộp, `.generated/js-nofuse` (SAOC_NO_FUSE=1) đi đường thường Html/Output.
 * Bất biến: hai đường cho ra DOM GIỐNG HỆT từng byte — thứ tự attribute, marker
 * `s:o:…`, class hydrate — ở mọi bước; và hydrate nhận lại DOM server thay vì
 * dựng lại.
 */
let h: Harness | null = null;
const flush = () => { (h!.ctrl as any).states.__.flushNow(); (h!.ctrl as any).flushReactiveUpdatesNow(); };
const load = async (name: string, fused = true) =>
    (await import(/* @vite-ignore */ path.join(__dirname, `../fixtures/compiled/.generated/${fused ? 'js' : 'js-nofuse'}/${name}.js`))).default;
const snapshot = () => h!.container.innerHTML.replace(new RegExp((h!.ctrl as any).viewId, 'g'), 'VIEW');
const rows = (n: number, from = 1) => Array.from({ length: n }, (_, i) =>
    ({ id: from + i, label: i % 3 === 2 ? '' : `row <${from + i}>`, note: i % 2 ? null : `n${from + i}` }));

afterEach(() => {
    h?.destroy(); h = null; Html.csrHydrateClass = false;
    BlockManager.destroy(); MarkerRegistry.clear(); document.body.innerHTML = '';
});

async function scenario(name: string, fused: boolean, hydrateClass: boolean): Promise<string[]> {
    Html.csrHydrateClass = hydrateClass;
    h = mount(await load(name, fused)); flush();
    const view = h.view as any, shots: string[] = [snapshot()];
    const step = (act: () => void) => { act(); flush(); shots.push(snapshot()); };
    step(() => view.select(2));                                       // binding class tự cập nhật
    step(() => view.replace(rows(6)));                                // item mới, cùng @key → ghi tại chỗ
    step(() => view.select(3));
    step(() => view.bump?.());                                        // {{ }} có stateKeys
    step(() => view.replace([...view.current(), ...rows(4, 7)]));     // thêm
    step(() => view.replace(view.current().filter((r: any) => r.id % 2)));   // bớt
    step(() => view.replace(view.current().slice().reverse()));       // đổi chỗ
    step(() => view.replace(view.current().map((r: any) => ({ ...r, label: r.label + '!', note: r.note ? null : 'x' }))));
    step(() => view.replace(rows(5, 20)));                            // thay hết
    step(() => view.select(22));
    step(() => view.replace([]));
    h.destroy(); h = null;
    return shots;
}

it.each([
    ['fused-rows', false], ['fused-rows', true],
    ['memo-rows', false], ['memo-rows', true],
    ['memo-captured', false], ['memo-captured', true],
])('%s (class hydrate: %s): DOM giống hệt giữa dòng gộp và đường thường', async (name, hydrateClass) => {
    const fused = await scenario(name, true, hydrateClass);
    const plain = await scenario(name, false, hydrateClass);
    expect(fused[0]).toContain(name === 'fused-rows' ? '<article' : '<li');
    expect(fused).toEqual(plain);
});

it('fixture thật sự đi đường gộp: mỗi phần tử gốc của dòng là MỘT FusedRow, không Html/Output nào', async () => {
    h = mount(await load('fused-rows')); flush();
    const html = vi.spyOn(h.ctrl as any, 'html'), output = vi.spyOn(h.ctrl as any, 'output');
    (h.view as any).replace(rows(20)); flush();
    expect(html).not.toHaveBeenCalled();
    expect(output).not.toHaveBeenCalled();
    const fused = [...(h.ctrl as any).elements.values()].filter(el => el instanceof FusedRow);
    expect(fused).toHaveLength(40);                                   // <article> + <hr> mỗi dòng
    expect(h.container.querySelectorAll('article')).toHaveLength(20);
});

it('event: đúng dòng, tham số hiện hành, modifier .prevent, event không nổi bọt', async () => {
    h = mount(await load('fused-rows')); flush();
    const view = h.view as any;
    view.select(2); flush();
    const link = h.container.querySelector('article[data-id="3"] a') as HTMLElement;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click); flush();
    expect(click.defaultPrevented).toBe(true);
    expect(view.lastPick()).toEqual([3, 2]);
    h.container.querySelector('article[data-id="1"] button')!.dispatchEvent(new MouseEvent('mouseenter'));
    expect(view.lastHover()).toBe(1);
    (h.container.querySelector('article[data-id="1"] button') as HTMLElement).click(); flush();
    expect([...h.container.querySelectorAll('article')].map(el => el.getAttribute('data-id'))).toEqual(['2', '3']);
});

it('dòng giữ @key nhận item mới: ghi tại chỗ, giữ nguyên node', async () => {
    h = mount(await load('fused-rows')); flush();
    const view = h.view as any;
    const before = h.container.querySelector('article[data-id="2"]')!;
    view.replace(view.current().map((r: any) => r.id === 2 ? { ...r, label: 'mới', note: 'có' } : r)); flush();
    const after = h.container.querySelector('article[data-id="2"]')!;
    expect(after).toBe(before);
    expect(after.querySelector('h3')!.textContent).toContain('mới');
    expect(after.querySelector('i')!.getAttribute('data-note')).toBe('có');
    // Handler của dòng đó đọc item MỚI.
    view.replace(view.current().map((r: any) => r.id === 2 ? { ...r, id: 2 } : r)); flush();
    (after.querySelector('a') as HTMLElement).click(); flush();
    expect(view.lastPick()).toEqual([2, 0]);
});

it('destroy dòng: gỡ khỏi DOM, khỏi registry và khỏi đăng ký state', async () => {
    h = mount(await load('fused-rows')); flush();
    const view = h.view as any, ctrl = h.ctrl as any;
    const gone = [...ctrl.elements.values()].filter((el: any) => el instanceof FusedRow);
    view.replace([]); flush();
    expect(h.container.querySelectorAll('article, hr')).toHaveLength(0);
    expect([...ctrl.elements.values()].some((el: any) => el instanceof FusedRow)).toBe(false);
    expect(gone.every((el: any) => el.__destroyed__)).toBe(true);
    const html = h.container.innerHTML;
    view.select(1); view.bump(); flush();                             // không dòng chết nào còn nghe state
    expect(h.container.innerHTML).toBe(html);
});

it('hydrate: nhận lại đúng node của server, không dựng lại; sau đó cập nhật như CSR', async () => {
    // DOM "server": đường thường + class hydrate — đúng thứ Blade phát (cổng parity E2E gác điều đó).
    const SSR = 'ssrfuse1';
    Html.csrHydrateClass = true;
    h = mount(await load('fused-rows', false), { __SSR_VIEW_ID__: SSR }); flush();
    const serverHtml = h.container.innerHTML;
    h.destroy(); h = null; Html.csrHydrateClass = false;
    expect(serverHtml).toContain(`class="${SSR}-`);

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    const serverNodes = [...container.querySelectorAll('article, article *, hr')];
    const vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({ container, registry: { 'fixtures.fused-rows': await load('fused-rows') } });
    const create = vi.spyOn(document, 'createElement');
    await vm.hydrateView('fixtures.fused-rows', { __SSR_VIEW_ID__: SSR }, { $urlPath: '/' } as any);
    const view: any = vm.getCurrentView()!, ctrl: any = view.__ctrl__;
    const settle = () => { ctrl.states.__.flushNow(); ctrl.flushReactiveUpdatesNow(); };
    settle();
    // Chỉ MỘT lượt dựng khuôn (9 element của <article> + <hr>), không dựng dòng nào.
    expect(create).toHaveBeenCalledTimes(9);
    create.mockRestore();
    expect(container.innerHTML).toBe(serverHtml);
    expect([...container.querySelectorAll('article, article *, hr')]).toEqual(serverNodes);
    expect([...ctrl.elements.values()].filter((el: any) => el instanceof FusedRow)).toHaveLength(6);

    // Dòng 3 có label rỗng: server không phát text node giữa hai marker — vẫn cập nhật được.
    view.select(3); settle();
    expect(container.querySelector('article.on')!.getAttribute('data-id')).toBe('3');
    (container.querySelector('article[data-id="2"] a') as HTMLElement).click(); settle();
    expect(view.lastPick()).toEqual([2, 3]);
    view.replace(view.current().map((r: any) => ({ ...r, label: r.label + '+' }))); settle();
    expect([...container.querySelectorAll('h3')].map(el => el.firstChild!.nextSibling!.textContent)).toEqual(['a+', 'b+', '+']);
    expect(container.querySelector('article')).toBe(serverNodes[0]);
    StoreService.instance('ViewManager').clear();
});

it('hydrate lệch cấu trúc: dòng đó dựng lại từ khuôn, không vỡ', async () => {
    const SSR = 'ssrfuse2';
    Html.csrHydrateClass = true;
    h = mount(await load('fused-rows', false), { __SSR_VIEW_ID__: SSR }); flush();
    const serverHtml = h.container.innerHTML;
    h.destroy(); h = null; Html.csrHydrateClass = false;

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    container.querySelector('article[data-id="2"] h3')!.remove();      // server "quên" một node
    const vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({ container, registry: { 'fixtures.fused-rows': await load('fused-rows') } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await vm.hydrateView('fixtures.fused-rows', { __SSR_VIEW_ID__: SSR }, { $urlPath: '/' } as any);
    warn.mockRestore();
    const view: any = vm.getCurrentView()!, ctrl: any = view.__ctrl__;
    ctrl.states.__.flushNow(); ctrl.flushReactiveUpdatesNow();
    expect([...container.querySelectorAll('article')].map(el => el.getAttribute('data-id'))).toEqual(['1', '2', '3']);
    expect(container.querySelector('article[data-id="2"] h3')!.textContent).toContain('b');
    StoreService.instance('ViewManager').clear();
});
