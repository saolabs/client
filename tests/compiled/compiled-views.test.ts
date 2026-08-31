/**
 * Compile→mount — mount OUTPUT COMPILER THẬT (không chép tay pattern).
 *
 * Khác biệt cốt lõi so với `tests/contract/*.ts`: những bài đó re-implement
 * TAY pattern mà compiler ĐƯỢC KỲ VỌNG sinh ra, nên compiler sinh sai vẫn lọt
 * (xem docs/FIX_PLAN_2026-08-14.md §F5). Ở đây `.sao` trong
 * `tests/fixtures/compiled/src/` được `globalSetup.ts` compile bằng đúng
 * `@saolabs/builder` + `saola/compiler`, rồi bài test mount thẳng file `.js`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { app } from '../../src/core/helpers/app';
import { mount, nextFrame, type Harness } from '../../src/testing';

const GENERATED_JS = path.join(__dirname, '..', 'fixtures', 'compiled', '.generated', 'js');
const GENERATED_BLADE = path.join(__dirname, '..', 'fixtures', 'compiled', '.generated', 'blade');

function skipIfMissing(name: string): boolean {
    const file = path.join(GENERATED_JS, `${name}.js`);
    if (existsSync(file)) return false;
    console.warn(
        `[compiled-views.test] BỎ QUA — không tìm thấy ${file}. ` +
        'globalSetup không compile được fixture (kiểm tra Builder/Composer). ' +
        'Đây KHÔNG phải pass — kiểm tra log globalSetup ở đầu run.'
    );
    return true;
}

async function loadFixture(name: string): Promise<any> {
    const mod = await import(/* @vite-ignore */ path.join(GENERATED_JS, `${name}.js`));
    return mod.default ?? mod[Object.keys(mod).find((k) => k !== 'default')!];
}

let harness: Harness | null = null;
afterEach(() => {
    harness?.destroy();
    harness = null;
});

describe('compiled-views: counter (đường cơ sở — output + event handler đơn giản)', () => {
    it('click tăng state và cập nhật DOM', async () => {
        if (skipIfMissing('counter')) return;
        const Counter = await loadFixture('counter');
        harness = mount(Counter, {});
        const value = () => harness!.container.querySelector('#value')!.textContent;

        expect(value()).toBe('0');
        (harness.container.querySelector('#inc') as HTMLElement).click();
        await nextFrame();
        expect(value()).toBe('1');
    });
});

describe('compiled-views: events (F1 — property access trong @click, F2 — arrow inline)', () => {
    it('remove theo item.id KHÔNG được biến thành item+id', async () => {
        if (skipIfMissing('events')) return;
        const Events = await loadFixture('events');
        harness = mount(Events, {});
        const len = () => harness!.container.querySelector('#len')!.textContent;

        expect(len()).toBe('2');
        const delButtons = harness.container.querySelectorAll('.del');
        (delButtons[0] as HTMLElement).click();
        await nextFrame();
        // Xoá ĐÚNG item id=1 → còn lại 1 item (id=2). Nếu bug F1 còn sống,
        // `removeItem(item.id)` compile thành `removeItem(item+id)` → tham số
        // sai kiểu (NaN hoặc chuỗi ghép) → filter không khớp gì → length không đổi.
        expect(len()).toBe('1');
        expect(harness.container.querySelector('li')?.getAttribute('data-id')).toBe('2');
    });

    it('arrow function bọc method component: @click(() => pickItem(x.y)) chạy ĐÚNG MỘT LẦN VÀ resolve đúng method (F2 + N7)', async () => {
        if (skipIfMissing('events')) return;
        const Events = await loadFixture('events');
        harness = mount(Events, {});
        const picked = () => harness!.container.querySelector('#picked')!.textContent;

        expect(picked()).toBe('');
        const pickButtons = harness.container.querySelectorAll('.pick');
        (pickButtons[0] as HTMLElement).click();
        await nextFrame();
        // Hai lớp bug từng chồng lên nhau ở đúng pattern này:
        //   F2 (đã vá): `() => pickItem(item.name)` bị bọc lần nữa thành
        //     `() => () => pickItem(item+name)` — click chỉ tạo ra 1 function,
        //     KHÔNG gọi pickItem.
        //   N7 (đã vá): dù F2 xong, `pickItem` bên trong arrow vẫn là định
        //     danh TRẦN (không đi qua đường object-handler dispatch như
        //     `@click(pickItem(x))` không-bọc-arrow) → ReferenceError lúc
        //     click, không throw lúc compile.
        expect(picked()).toBe('a');
    });
});

describe('compiled-views: methods (F3 — gọi method component trong {{ }})', () => {
    it('{{ label() }} gọi ĐÚNG method của component, KHÔNG rơi vào App.Helper', async () => {
        if (skipIfMissing('methods')) return;
        const Methods = await loadFixture('methods');
        // Trước khi F3 được vá: mount() ném ngay (App.Helper.label is not a
        // function) vì compiler emit `App.Helper.label()` cho một method định
        // nghĩa trong <script setup>. Bài test PHẢI throw rõ ràng ở đây thay vì
        // nuốt lỗi, để đỏ đúng nghĩa khi bug còn sống.
        harness = mount(Methods, {});
        const label = () => harness!.container.querySelector('#label')!.textContent;
        const counted = () => harness!.container.querySelector('#counted')!.textContent;

        expect(label()).toBe('n=0');
        // App.Helper.count(...) là helper THẬT (PHP count()) — vẫn phải hoạt động
        // song song với method component, không được prefix nhầm chiều ngược lại.
        expect(counted()).toBe('3');

        (harness.container.querySelector('#inc') as HTMLElement).click();
        await nextFrame();
        expect(harness.container.querySelector('#raw')!.textContent).toBe('1');
        // `{{ label() }}` KHÔNG re-render theo click — giới hạn ĐÃ BIẾT, NGOÀI
        // phạm vi F3 (xem docs/FIX_PLAN_2026-08-14.md §F3 "Giới hạn còn lại"
        // và GAPS_AND_ROADMAP.md mục D1): stateKeys của output này rỗng vì
        // compiler chỉ quét định danh NGAY TRONG biểu thức `{{ }}` — ở đây chỉ
        // có `label`, không có `n` — không nhìn vào THÂN method để tìm state
        // nó đọc. F3 chỉ đảm bảo lời gọi RESOLVE ĐÚNG (this.view.label(),
        // không rơi vào App.Helper) và trả giá trị đúng tại thời điểm render;
        // nó không thêm reactivity mà compiler chưa từng theo dõi được.
        expect(label()).toBe('n=0');
    });
});

/**
 * Marker parity SSR↔CSR trên fixture của PIPELINE THẬT (F4).
 *
 * Bài này đọc đồng thời hai output của cùng một `CompileResult`, đúng đường
 * Builder dùng trong production, nên bắt được mọi lệch marker SSR↔CSR.
 *
 * Bất biến: dãy id output của sao2js và dãy marker id của sao2blade phải khớp
 * TUYỆT ĐỐI theo thứ tự — lệch một vị trí làm mọi id sau nó trong cùng scope
 * lệch theo, khiến Output claim NHẦM marker lúc hydrate (hoán đổi + nhân bản
 * nội dung, không chỉ dư chữ).
 */
describe('compiled-views: marker parity SSR↔CSR (F4, qua pipeline thật)', () => {
    const jsIds = (src: string) =>
        [...src.matchAll(/this\.output\(`([a-f0-9]+)/g)].map((m) => m[1]);
    const bladeIds = (src: string) =>
        [...src.matchAll(/startMarker\('output',\s*['"]([a-f0-9]+)/g)].map((m) => m[1]);

    it('mọi fixture: dãy id output khớp tuyệt đối giữa sao2js và sao2blade', () => {
        if (!existsSync(GENERATED_JS) || !existsSync(GENERATED_BLADE)) {
            console.warn('[compiled-views.test] BỎ QUA parity — chưa có .generated (kiểm tra Builder/Composer).');
            return;
        }
        const names = readdirSync(GENERATED_JS)
            .filter((f) => f.endsWith('.js'))
            .map((f) => f.replace(/\.js$/, ''));
        expect(names.length).toBeGreaterThan(0);

        for (const name of names) {
            const js = jsIds(readFileSync(path.join(GENERATED_JS, `${name}.js`), 'utf-8'));
            const blade = bladeIds(readFileSync(path.join(GENERATED_BLADE, `${name}.blade.php`), 'utf-8'));
            expect(blade, `fixture "${name}": dãy marker id lệch giữa SSR và CSR`).toEqual(js);
        }
    });

    it('echo tĩnh dùng this.text(String(x ?? "")) — null/undefined rỗng như Blade', () => {
        if (!existsSync(GENERATED_JS)) return;
        for (const f of readdirSync(GENERATED_JS).filter((n) => n.endsWith('.js'))) {
            const src = readFileSync(path.join(GENERATED_JS, f), 'utf-8');
            for (const m of src.matchAll(/this\.text\(String\(([^\n]*?)\)\)/g)) {
                expect(m[1], `${f}: this.text(String(...)) thiếu guard "?? ''"`).toContain("?? ''");
            }
        }
    });
});
