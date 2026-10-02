import { afterEach, expect, it } from 'vitest';
import path from 'node:path';
import { mount, nextFrame, type Harness } from '../../src/testing';
import { app } from '../../src/core/helpers/app';
import { ViewManager } from '../../src/core/view/ViewManager';

let harness: Harness | undefined;
afterEach(() => { harness?.destroy(); harness = undefined; });
async function setup() {
    const dir = path.join(__dirname, '../fixtures/compiled/.generated/js');
    const parent = await import(/* @vite-ignore */ path.join(dir, 'keyed-refresh.js'));
    const child = await import(/* @vite-ignore */ path.join(dir, 'keyed-child.js'));
    const vm = new ViewManager(app() as any);
    app.instance('View', vm);
    vm.init({ registry: { 'fixtures.keyed-child': child.default } });
    harness = mount(parent.default);
    await nextFrame();
    return harness;
}

it('real compiled keyed refresh preserves nodes, focus, edited input and child state while refreshing data/handlers/loop metadata', async () => {
    const h = await setup();
    const row = h.container.querySelector('[data-id="1"]')!;
    const editor = row.querySelector('input')!;
    const button = row.querySelector('.child') as HTMLButtonElement;
    button.click(); await nextFrame();
    editor.value = 'draft'; editor.focus(); editor.setSelectionRange(2, 4);
    const nested = row.querySelector('i')!;
    h.view.replace([
        { id: 2, name: 'TWO', tags: [] },
        { id: 1, name: 'ONE', tags: [{ id: 'a', label: 'ALPHA' }, { id: 'b', label: 'beta' }] },
    ]);
    await nextFrame();
    expect(h.container.querySelector('[data-id="1"]')).toBe(row);
    expect(row.querySelector('input')).toBe(editor);
    expect(editor.value).toBe('draft');
    expect(document.activeElement).toBe(editor);
    expect(editor.selectionStart).toBe(2);
    expect(editor.selectionEnd).toBe(4);
    expect(row.querySelector('.child')).toBe(button);
    expect(button.textContent).toBe('ONE:1');
    expect(row.querySelector('[data-tag="a"]')).toBe(nested);
    expect(nested.textContent).toBe('ALPHA');
    expect(row.querySelector('.index')?.textContent).toBe('1');
    expect(row.querySelector('.count')?.textContent).toBe('2');
    (row.querySelector('.pick') as HTMLButtonElement).click(); await nextFrame();
    expect(h.getState('picked')).toBe('ONE:1');
    const observer = new MutationObserver(() => {});
    observer.observe(h.container, { childList: true, subtree: true });
    h.view.replace([{ id: 2, name: 'TWO again', tags: [] }, { id: 1, name: 'ONE again', tags: [{ id: 'a', label: 'ALPHA again' }, { id: 'b', label: 'beta' }] }]);
    h.ctrl.states.__.flushNow();
    const mutations = observer.takeRecords(); observer.disconnect();
    expect(mutations).toHaveLength(0);
    expect(document.activeElement).toBe(editor);
    expect(editor.selectionStart).toBe(2);
    expect(editor.selectionEnd).toBe(4);
    expect(button.textContent).toBe('ONE again:1');
    expect(h.ctrl.children).toHaveLength(2);
    const before = h.ctrl.elements.size;
    for (let i = 0; i < 5; i++) {
        h.view.replace([{ id: 1, name: `one-${i}`, tags: [] }]); h.ctrl.states.__.flushNow();
    }
    expect(h.ctrl.children).toHaveLength(1);
    expect(h.ctrl.elements.size).toBeLessThan(before);
});

it('duplicate keys use distinct occurrence scopes, including their child instances', async () => {
    const h = await setup();
    h.view.replace([{ id: 1, name: 'A', tags: [] }, { id: 1, name: 'B', tags: [] }]);
    h.ctrl.states.__.flushNow();
    const rows = [...h.container.querySelectorAll('li')];
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.querySelector('.name')?.textContent)).toEqual(['A', 'B']);
    h.view.replace([{ id: 1, name: 'AA', tags: [] }, { id: 1, name: 'BB', tags: [] }]);
    h.ctrl.states.__.flushNow();
    expect([...h.container.querySelectorAll('li')]).toEqual(rows);
    expect(rows.map(row => row.querySelector('.child')?.textContent)).toEqual(['AA:0', 'BB:0']);
});

it('implicit reference keys retain row identity across index changes and prepends', async () => {
    const generated = path.join(__dirname, '../fixtures/compiled/.generated/js/identity-refresh.js');
    const module = await import(/* @vite-ignore */ generated);
    harness = mount(module.default);
    const first = harness.container.querySelector('[data-id="1"]')!;
    const input = first.querySelector('input')!;
    input.value = 'draft'; input.focus();
    harness.view.reverse(); harness.ctrl.states.__.flushNow();
    expect(harness.container.querySelector('[data-id="1"]')).toBe(first);
    expect(first.querySelector('span')?.textContent).toBe('one:1');
    harness.view.prepend(); harness.ctrl.states.__.flushNow();
    expect(harness.container.querySelector('[data-id="1"]')).toBe(first);
    expect(first.querySelector('span')?.textContent).toBe('one:2');
    expect(input.value).toBe('draft'); expect(document.activeElement).toBe(input);
    expect(harness.container.querySelectorAll('li')).toHaveLength(3);
});
