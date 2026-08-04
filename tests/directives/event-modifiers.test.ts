/**
 * `@click.prevent.stop(...)` — modifier áp ở runtime.
 * Compiler emit bucket riêng `eventModifiers: { click: [...] }` cạnh `events`,
 * nên view compile TRƯỚC khi có tính năng này (không có key đó) chạy y nguyên.
 *
 * @see ViewController.wrapEventModifiers
 * @see compiler/src/sao2js/template_ast.py EVENT_MODIFIERS
 */
import { describe, it, expect, afterEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import { Html } from '../../src/core/elements/Html';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

/** Gắn 1 element có events + eventModifiers vào DOM, trả element thật. */
function mount(config: any): HTMLElement {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const ctrl = new View('t.v', 'view').__ctrl__;
    const parent = new Html({ ctx: ctrl as any, element: host, childrenFactory: () => [] });
    const el = new Html({ ctx: ctrl as any, tagName: 'button', parentElement: parent, config });
    host.appendChild(el.element);
    return el.element;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('event modifiers', () => {
    it('prevent → preventDefault()', () => {
        let seen: Event | null = null;
        const el = mount({
            events: { click: [(e: Event) => { seen = e; }] },
            eventModifiers: { click: ['prevent'] },
        });
        const ev = new MouseEvent('click', { cancelable: true, bubbles: true });
        el.dispatchEvent(ev);

        expect(seen).not.toBeNull();
        expect(ev.defaultPrevented).toBe(true);
    });

    it('stop → không bubble lên cha', () => {
        let onParent = 0;
        const el = mount({
            events: { click: [() => {}] },
            eventModifiers: { click: ['stop'] },
        });
        el.parentElement!.addEventListener('click', () => { onParent++; });
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(onParent).toBe(0);
    });

    it('self → bỏ qua event bắn từ element con', () => {
        let calls = 0;
        const el = mount({
            events: { click: [() => { calls++; }] },
            eventModifiers: { click: ['self'] },
        });
        const child = document.createElement('span');
        el.appendChild(child);

        child.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(calls).toBe(0);   // target là child → bỏ qua

        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(calls).toBe(1);   // target === currentTarget → chạy
    });

    it('self chặn TRƯỚC prevent — event của con không bị preventDefault', () => {
        const el = mount({
            events: { click: [() => {}] },
            eventModifiers: { click: ['self', 'prevent'] },
        });
        const child = document.createElement('span');
        el.appendChild(child);

        const ev = new MouseEvent('click', { cancelable: true, bubbles: true });
        child.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(false);
    });

    it('once → chỉ chạy một lần', () => {
        let calls = 0;
        const el = mount({
            events: { click: [() => { calls++; }] },
            eventModifiers: { click: ['once'] },
        });
        el.dispatchEvent(new MouseEvent('click'));
        el.dispatchEvent(new MouseEvent('click'));
        el.dispatchEvent(new MouseEvent('click'));

        expect(calls).toBe(1);
    });

    it('không có eventModifiers → hành vi cũ nguyên vẹn', () => {
        let calls = 0;
        const el = mount({ events: { click: [() => { calls++; }] } });
        const ev = new MouseEvent('click', { cancelable: true, bubbles: true });
        el.dispatchEvent(ev);
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(calls).toBe(2);
        expect(ev.defaultPrevented).toBe(false);
    });
});
