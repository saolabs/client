import { afterEach, expect, it } from 'vitest';
import path from 'node:path';
import { mount, nextFrame, type Harness } from '../../src/testing';
let harness: Harness | undefined;
afterEach(() => { harness?.destroy(); harness = undefined; });

it('typed .sao methods use public watch and cleanup through real lifecycle transitions', async () => {
    const generated = path.join(__dirname, '../fixtures/compiled/.generated/js/scoped-watch.ts');
    const module = await import(/* @vite-ignore */ generated);
    harness = mount(module.default);
    await nextFrame();
    expect(harness.text()).toBe('initial'); expect(harness.view.runs).toBe(1);
    harness.view.change('next'); await nextFrame();
    expect(harness.text()).toBe('next'); expect(harness.view.cleanups).toBe(1);
    harness.ctrl.pause(); expect(harness.view.cleanups).toBe(2);
    harness.view.change('paused'); await nextFrame(); expect(harness.view.runs).toBe(2);
    harness.ctrl.resume(); await nextFrame();
    expect(harness.text()).toBe('paused'); expect(harness.view.runs).toBe(3);
    harness.ctrl.destroy(); expect(harness.view.cleanups).toBe(3);
});
