import { afterEach, expect, it } from 'vitest';
import { View } from '../../src/core/view/View';
import { Html } from '../../src/core/elements/Html';

let view: View;
let html: Html;
afterEach(() => { html?.destroy(); view?.__ctrl__.destroy(); document.body.innerHTML = ''; });
function bound(tagName = 'textarea', initial: any = 'start', element?: HTMLElement) {
    view = new View('form.editing');
    const ctrl = view.__ctrl__;
    ctrl.states.__.register('value', initial);
    html = new Html({ ctx: ctrl, tagName, element: element as any,
        initMode: element ? 'hydrate' : 'create', config: { bind: { key: 'value' } } });
    return ctrl;
}

it('does not commit incomplete IME input or overwrite composition; commits the finished value', () => {
    const ctrl = bound(); const el = html.element as HTMLTextAreaElement;
    el.dispatchEvent(new CompositionEvent('compositionstart'));
    el.value = 'tiế'; el.dispatchEvent(new InputEvent('input', { isComposing: true }));
    expect(ctrl.states.value).toBe('start');
    ctrl.states.value = 'server'; ctrl.states.__.flushNow();
    expect(el.value).toBe('tiế');
    el.value = 'tiếng Việt'; el.dispatchEvent(new CompositionEvent('compositionend'));
    expect(ctrl.states.value).toBe('tiếng Việt');
    ctrl.states.__.flushNow(); expect(el.value).toBe('tiếng Việt');
});

it('adopts edited SSR textarea into the explicit binding and keeps defaultValue for reset', () => {
    const original = document.createElement('textarea');
    original.defaultValue = 'server'; original.value = 'typed before hydration';
    document.body.append(original);
    const ctrl = bound('textarea', 'server', original);
    expect(ctrl.states.value).toBe('typed before hydration');
    expect(original.value).toBe('typed before hydration');
    expect(original.defaultValue).toBe('server');
    original.focus(); original.setSelectionRange(2, 5);
    ctrl.states.__.flushNow(); expect(original.selectionStart).toBe(2); expect(original.selectionEnd).toBe(5);
});

it('select multiple binds a string array in both directions', async () => {
    const ctrl = bound('select', ['a', 'c']);
    const select = html.element as HTMLSelectElement;
    select.multiple = true;
    // Bind after multiple is configured, matching compiler attribute order.
    html.updateConfig({ bind: { key: 'value' } });
    for (const value of ['a', 'b', 'c']) {
        const option = document.createElement('option'); option.value = value; select.append(option);
    }
    await Promise.resolve();
    expect([...select.selectedOptions].map(option => option.value)).toEqual(['a', 'c']);
    select.options[0].selected = false; select.options[1].selected = true;
    select.dispatchEvent(new Event('change'));
    expect(ctrl.states.value).toEqual(['b', 'c']);
    ctrl.states.value = ['a']; ctrl.states.__.flushNow();
    expect([...select.selectedOptions].map(option => option.value)).toEqual(['a']);
});
