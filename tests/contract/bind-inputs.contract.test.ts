/**
 * Cross-contract test — @bind trên các loại input đặc thù + props binding.
 *
 * 1. @bind theo input type (Html.setupTwoWayBinding):
 *      - checkbox : state boolean ↔ el.checked (change event)
 *      - radio    : el.checked = (String(state) === el.value); change → state = el.value
 *      - select   : el.value ↔ state (change event); initial DEFER 1 microtask
 *                   (options chưa append lúc constructor chạy)
 *      - number   : input → state là number (valueAsNumber); dở dang → string thô
 *      - text     : như cũ (input event, String)
 *
 * 2. props binding (compiler emit từ @checked(expr)/@disabled(expr)...):
 *      props: { "checked": { type:'binding', factory: () => expr, stateKeys:[...] } }
 *      → el.checked = factory(), subscribe stateKeys để cập nhật.
 *      Đây là DOM PROPERTY — không phải attribute (set attr 'checked' không đổi
 *      trạng thái sau khi user đã tương tác).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { Html } from '../../src/core/elements/Html';
import { app } from '../../src/core/helpers/app';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);

/** View + state keys đã đăng ký — trả về ctrl để làm ctx cho Html trực tiếp. */
function makeCtx(keys: Record<string, any>) {
    const view = new View('test.bind-inputs', 'view');
    const ctrl = view.__ctrl__;
    const m: any = ctrl.states.__;
    for (const [key, initial] of Object.entries(keys)) {
        m.register(key, initial); // register tự gán setters[key]
    }
    return { ctrl, m };
}

const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const microtask = () => Promise.resolve();

const bindAttrs = (stateKey: string, extra: Record<string, any> = {}) => ({
    attrs: {
        ...extra,
        bind: { type: 'static', value: true },
        [stateKey]: { type: 'static', value: true },
    },
});

afterEach(() => { document.body.innerHTML = ''; });

describe('@bind — checkbox', () => {
    it('initial: state true → el.checked (không đụng el.value)', () => {
        const { ctrl } = makeCtx({ agreed: true });
        const el = new Html({
            ctx: ctrl, id: 'cb', tagName: 'input',
            config: bindAttrs('agreed', { type: { type: 'static', value: 'checkbox' } }),
        } as any);
        expect((el.element as HTMLInputElement).checked).toBe(true);
    });

    it('change → state boolean; state → checked sync', async () => {
        const { ctrl, m } = makeCtx({ agreed: false });
        const el = new Html({
            ctx: ctrl, id: 'cb', tagName: 'input',
            config: bindAttrs('agreed', { type: { type: 'static', value: 'checkbox' } }),
        } as any);
        const input = el.element as HTMLInputElement;

        input.checked = true;
        input.dispatchEvent(new Event('change'));
        expect(m.getStateByKey('agreed')).toBe(true);

        m.setters.agreed(false);
        await frame();
        expect(input.checked).toBe(false);
    });
});

describe('@bind — radio group', () => {
    function makeRadios() {
        const { ctrl, m } = makeCtx({ pick: 'b' });
        const mk = (value: string) => new Html({
            ctx: ctrl, id: `r-${value}`, tagName: 'input',
            config: bindAttrs('pick', {
                type: { type: 'static', value: 'radio' },
                value: { type: 'static', value },
            }),
        } as any).element as HTMLInputElement;
        return { m, a: mk('a'), b: mk('b') };
    }

    it('initial: chỉ radio có value trùng state được checked', () => {
        const { a, b } = makeRadios();
        expect(a.checked).toBe(false);
        expect(b.checked).toBe(true);
    });

    it('change radio → state = value; state đổi → group sync', async () => {
        const { m, a, b } = makeRadios();

        a.checked = true;
        a.dispatchEvent(new Event('change'));
        expect(m.getStateByKey('pick')).toBe('a');
        await frame();
        expect(b.checked).toBe(false); // radio kia unsync qua subscribe

        m.setters.pick('b');
        await frame();
        expect(a.checked).toBe(false);
        expect(b.checked).toBe(true);
    });
});

describe('@bind — select', () => {
    function makeSelect(initial: string) {
        const { ctrl, m } = makeCtx({ city: initial });
        const el = new Html({
            ctx: ctrl, id: 'sel', tagName: 'select',
            config: bindAttrs('city'),
        } as any);
        const sel = el.element as HTMLSelectElement;
        // Mô phỏng children render SAU constructor (như render pass thật)
        for (const v of ['hn', 'hcm', 'dn']) {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            sel.appendChild(opt);
        }
        return { m, sel };
    }

    it('initial value áp SAU khi options có mặt (defer microtask)', async () => {
        const { sel } = makeSelect('hcm');
        await microtask();
        expect(sel.value).toBe('hcm');
    });

    it('change → state; state → value sync', async () => {
        const { m, sel } = makeSelect('hcm');
        await microtask();

        sel.value = 'hn';
        sel.dispatchEvent(new Event('change'));
        expect(m.getStateByKey('city')).toBe('hn');

        m.setters.city('dn');
        await frame();
        expect(sel.value).toBe('dn');
    });
});

describe('@bind — number input', () => {
    it('input → state là number, không phải string', () => {
        const { ctrl, m } = makeCtx({ qty: 1 });
        const el = new Html({
            ctx: ctrl, id: 'num', tagName: 'input',
            config: bindAttrs('qty', { type: { type: 'static', value: 'number' } }),
        } as any);
        const input = el.element as HTMLInputElement;

        input.value = '42';
        input.dispatchEvent(new Event('input'));
        expect(m.getStateByKey('qty')).toBe(42);
    });

    it('giá trị không parse được → giữ string thô (không NaN)', () => {
        const { ctrl, m } = makeCtx({ qty: 1 });
        const el = new Html({
            ctx: ctrl, id: 'num', tagName: 'input',
            config: bindAttrs('qty', { type: { type: 'static', value: 'number' } }),
        } as any);
        const input = el.element as HTMLInputElement;

        input.value = '';
        input.dispatchEvent(new Event('input'));
        expect(m.getStateByKey('qty')).toBe('');
    });
});

describe('props binding — @checked(expr)/@disabled(expr) (DOM property)', () => {
    it('checked: init từ factory + reactive theo stateKeys', async () => {
        const { ctrl, m } = makeCtx({ done: true });
        const el = new Html({
            ctx: ctrl, id: 'cb', tagName: 'input',
            config: {
                attrs: { type: { type: 'static', value: 'checkbox' } },
                props: {
                    checked: {
                        type: 'binding',
                        factory: () => m.getStateByKey('done'),
                        stateKeys: ['done'],
                    },
                },
            },
        } as any);
        const input = el.element as HTMLInputElement;
        expect(input.checked).toBe(true);

        m.setters.done(false);
        await frame();
        expect(input.checked).toBe(false);
    });

    it('disabled: expression factory reactive', async () => {
        const { ctrl, m } = makeCtx({ count: 0 });
        const el = new Html({
            ctx: ctrl, id: 'btn', tagName: 'button',
            config: {
                props: {
                    disabled: {
                        type: 'binding',
                        factory: () => m.getStateByKey('count') > 3,
                        stateKeys: ['count'],
                    },
                },
            },
        } as any);
        const btn = el.element as HTMLButtonElement;
        expect(btn.disabled).toBe(false);

        m.setters.count(5);
        await frame();
        expect(btn.disabled).toBe(true);
    });
});
