/**
 * Sự kiện con → cha, qua OUTPUT COMPILER THẬT
 * (`tests/fixtures/compiled/src/emit-{parent,child}.sao`).
 *
 * Bọc cả hai mặt chữ và cả bốn dạng handler, vì chúng đi chung một đường:
 *   thẻ       <emitchild @edit(...) @pair((a, b) => ...) />
 *   @include  @include('...', {on$edit: takeOne, on$pair: (a, b) => { … }})
 * Chép tay một đầu là mù đúng khâu sinh code (FIX_PLAN §F5).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { app } from '../../src/core/helpers/app';
import { ViewManager } from '../../src/core/view/ViewManager';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

const GENERATED_JS = path.join(__dirname, '..', 'fixtures', 'compiled', '.generated', 'js');

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);

async function loadFixture(name: string): Promise<any> {
    const mod = await import(/* @vite-ignore */ path.join(GENERATED_JS, `${name}.js`));
    return mod.default ?? mod[Object.keys(mod).find((k) => k !== 'default')!];
}

let container: HTMLElement | null = null;

afterEach(() => {
    document.body.innerHTML = '';
    container = null;
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
});

async function mountPair() {
    container = document.createElement('div');
    document.body.appendChild(container);
    const vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({
        container,
        registry: {
            'fixtures.emit-parent': await loadFixture('emit-parent'),
            'fixtures.emit-child': await loadFixture('emit-child'),
        },
    });
    await vm.mountView('fixtures.emit-parent', {}, { $urlPath: '/emit' } as any);
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const skip = () => !existsSync(path.join(GENERATED_JS, 'emit-parent.js'));

/** Bấm nút trong đúng nhánh (thẻ hay @include) rồi đọc giá trị cha nhận được. */
async function click(scope: string, button: string): Promise<string | null> {
    (container!.querySelector(`#${scope} .${button}`) as HTMLElement).click();
    await frame();
    return container!.querySelector('#picked')!.textContent;
}

// prop num = 7 → emit('edit', 7) | emit('close', 14) | emit('pair', 7, 100)
describe.each([
    ['viaTag', 'thẻ component'],
    ['viaInclude', '@include với khoá on$'],
])('compiled: sự kiện con → cha qua %s (%s)', (scope) => {
    it('emit trong template tới listener của cha', async () => {
        if (skip()) return;
        await mountPair();
        expect(container!.querySelector('#picked')!.textContent).toBe('0');
        // thẻ: setPicked(event) — @include: takeOne (tên trần)
        expect(await click(scope, 'child-edit')).toBe('7');
    });

    it('emit gọi từ <script setup> của con cũng tới nơi', async () => {
        if (skip()) return;
        await mountPair();
        // thẻ: setPicked(event) = 14 — @include: (v) => setPicked(v + 1) = 15
        expect(await click(scope, 'child-close')).toBe(scope === 'viaTag' ? '14' : '15');
    });

    it('emit NHIỀU đối số tới đủ tham số của handler', async () => {
        if (skip()) return;
        await mountPair();
        // thẻ: (a, b) => setPicked(a + b) — @include: (a, b) => { …; setPicked(a + b) }
        expect(await click(scope, 'child-pair')).toBe('107');
    });

    it("tên sự kiện có ':' + handler gỡ rối/rest", async () => {
        if (skip()) return;
        await mountPair();
        // emit('row:changed', {id: 7, extra: 1})
        //   thẻ:      @on('row:changed', ({id, extra}) => setPicked(id + extra))
        //   @include: 'on$row:changed': (...args) => setPicked(args[0].id + args[0].extra)
        expect(await click(scope, 'child-ns')).toBe('8');
    });
});
