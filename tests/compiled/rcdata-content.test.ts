import { afterEach, expect, it } from 'vitest';
import path from 'node:path';
import { mount, nextFrame, type Harness } from '../../src/testing';

let harness: Harness | undefined;
afterEach(() => { harness?.destroy(); harness = undefined; });

it('real compiler output updates RCDATA properties without inserting markers or implicit @bind', async () => {
    const generated = path.join(__dirname, '../fixtures/compiled/.generated/js/rcdata-content.js');
    const module = await import(/* @vite-ignore */ generated);
    harness = mount(module.default);
    const textarea = (id: string) => harness!.container.querySelector(`#${id}`) as HTMLTextAreaElement;
    const plain = textarea('plain');
    const bound = textarea('bound');
    expect(plain.value).toBe('Prefix & hello <world> & friends <b>');
    expect(bound.value).toBe('hello <world> & friends');
    expect(textarea('explicit').value).toBe(bound.value);
    expect(textarea('raw').value).toBe('&<b>literal</b>');
    for (const el of harness.container.querySelectorAll('textarea, title')) {
        expect([...el.childNodes].every(node => node.nodeType === Node.TEXT_NODE)).toBe(true);
        expect(el.textContent).not.toContain('s:o:');
    }
    // A one-way interpolation must not start writing back into state.
    plain.value = 'user text';
    plain.dispatchEvent(new Event('input'));
    expect(harness.getState('message')).toBe('hello <world> & friends');
    bound.value = 'two-way';
    bound.dispatchEvent(new Event('input'));
    await nextFrame();
    expect(harness.getState('message')).toBe('two-way');
    expect(plain.value).toBe('Prefix & two-way <b>');
    (harness.container.querySelector('#change') as HTMLElement).click();
    await nextFrame();
    expect(plain.value).toBe('Prefix & changed <value> & ok <b>');
    expect(bound.value).toBe('changed <value> & ok');
    expect(harness.container.querySelector('#heading')?.textContent).toBe('changed <value> & ok');
    expect(textarea('plain')).toBe(plain);
});
