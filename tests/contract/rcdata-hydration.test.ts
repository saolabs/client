import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { Html } from '../../src/core/elements/Html';
import { View } from '../../src/core/view/View';

let view: View | undefined;
let html: Html | undefined;
afterEach(() => { html?.destroy(); view?.__ctrl__.destroy(); document.body.innerHTML = ''; });

function context() {
    view = new View('test.rcdata', 'view');
    const ctrl = view.__ctrl__;
    ctrl.viewId = 'v_ssr';
    ctrl.states.__.register('message', 'hello <world> & friends');
    return ctrl;
}

it('real Blade SSR is readable before JS and hydration preserves typed text and the existing node', () => {
    const fixture = path.join(__dirname, '../fixtures/compiled');
    const ssr = execFileSync('php', [path.join(fixture, 'render-rcdata.php'), path.join(fixture, '.generated/blade/rcdata-content.blade.php')], { encoding: 'utf8' });
    document.body.innerHTML = ssr;
    const original = document.querySelector('#plain') as HTMLTextAreaElement;
    expect(original.value).toBe('Prefix & hello <world> & friends <b>');
    expect((document.querySelector('#bound') as HTMLTextAreaElement).value).toBe('hello <world> & friends');
    expect((document.querySelector('#raw') as HTMLTextAreaElement).value).toBe('&<b>literal</b>');
    expect(ssr).not.toContain('<!--s:');
    original.value = 'typed before hydration';
    const ctrl = context();
    html = new Html({ ctx: ctrl, id: 'e11', tagName: 'textarea', initMode: 'hydrate', config: {
        content: { factory: () => `Prefix & ${ctrl.states.message} <b>`, stateKeys: ['message'] },
    } });
    html.render();
    expect(html.element).toBe(original);
    expect(original.value).toBe('typed before hydration');
    ctrl.states.__.setters.message('updated & <text>');
    ctrl.states.__.flushNow();
    expect(original.value).toBe('Prefix & updated & <text> <b>');
    expect(original.defaultValue).toBe('Prefix & hello <world> & friends <b>');
    expect([...original.childNodes].every(n => n.nodeType === Node.TEXT_NODE)).toBe(true);
});

it('partial hydration creates clean content when no SSR element exists', () => {
    const ctrl = context();
    html = new Html({ ctx: ctrl, id: 'missing', tagName: 'textarea', initMode: 'hydrate', config: {
        content: { factory: () => '\n' + ctrl.states.message, stateKeys: ['message'] },
    } });
    html.render();
    expect((html.element as HTMLTextAreaElement).value).toBe('hello <world> & friends');
    ctrl.states.__.setters.message('\nnew value');
    ctrl.states.__.flushNow();
    expect((html.element as HTMLTextAreaElement).value).toBe('\n\nnew value');
});

it('reconciliation and destroy dispose the old content subscription', () => {
    const ctrl = context();
    let oldCalls = 0;
    html = new Html({ ctx: ctrl, tagName: 'title', config: {
        content: { factory: () => { oldCalls++; return ctrl.states.message; }, stateKeys: ['message'] },
    } });
    html.render();
    const element = html.element;
    const initialCalls = oldCalls;
    html.updateConfig({ content: { factory: () => 'fixed', stateKeys: [] } });
    html.render();
    ctrl.states.__.setters.message('ignored');
    ctrl.states.__.flushNow();
    expect(oldCalls).toBe(initialCalls);
    expect(element.textContent).toBe('fixed');
    let newCalls = 0;
    html.updateConfig({ content: { factory: () => { newCalls++; return ctrl.states.message; }, stateKeys: ['message'] } });
    html.render();
    html.destroy();
    const callsAtDestroy = newCalls;
    ctrl.states.__.setters.message('after destroy');
    ctrl.states.__.flushNow();
    expect(newCalls).toBe(callsAtDestroy);
});
