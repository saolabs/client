/**
 * @section / @yield — SectionManager mounts named section content into matching
 * yield markers (text or html), resolves attribute-embedded @yield synchronously,
 * keeps a live <textarea> value in sync without touching its child nodes, and
 * pushes `meta:*` sections to document.title/<meta> for SPA navigation (the
 * app shell's real <head> is plain Blade and never re-runs client-side).
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mountView, nextFrame, visibleText, Harness } from '../helpers/harness';
import SectionManager from '../../src/core/services/SectionManager';

let h: Harness | null = null;
afterEach(() => { h?.destroy(); h = null; });

/** The harness mounts standalone (bypasses ViewManager) — drive SectionManager by hand. */
function activateSections(ctrl: any) {
    SectionManager.mountViewSections(ctrl.viewId);
    SectionManager.startAll();
}

describe('Section/Yield — text content', () => {
    it('renders the section value between the yield markers', () => {
        h = mountView(function () {
            this.section('greeting', { type: 'static', contentType: 'text' }, () => 'hello');
            return this.wrapper((parent: any) => [
                this.html('el1', 'span', parent, {}, (p: any) =>
                    [this.yield('y1', 'greeting', 'fallback', p)]),
            ]);
        });
        activateSections(h.ctrl);
        expect(visibleText(h.container.querySelector('span')!)).toBe('hello');
    });

    it('falls back to the yield default when no matching section is registered', () => {
        h = mountView(function () {
            return this.wrapper((parent: any) => [
                this.html('el1', 'span', parent, {}, (p: any) =>
                    [this.yield('y1', 'nobody-declares-this', 'fallback', p)]),
            ]);
        });
        activateSections(h.ctrl);
        expect(visibleText(h.container.querySelector('span')!)).toBe('fallback');
    });

    it('reactive section re-applies to the yield after a state change', async () => {
        h = mountView(function () {
            const manager: any = this.states.__;
            this.section('title', { type: 'reactive', contentType: 'text', stateKeys: ['title'] },
                () => manager.states['title'].value);
            return this.wrapper((parent: any) => [
                this.html('el1', 'span', parent, {}, (p: any) =>
                    [this.yield('y1', 'title', '', p)]),
            ]);
        }, { states: { title: 'first' } });
        activateSections(h.ctrl);
        expect(visibleText(h.container.querySelector('span')!)).toBe('first');

        h.setState('title', 'second');
        await nextFrame();
        expect(visibleText(h.container.querySelector('span')!)).toBe('second');
    });
});

describe('Section/Yield — html content', () => {
    it('mounts long-section children between the yield markers', () => {
        h = mountView(function () {
            this.section('body', { type: 'static', contentType: 'html' }, (parent: any) => [
                this.html('p1', 'p', parent, {}, (pp: any) => [this.text('block content')]),
            ]);
            return this.wrapper((parent: any) => [
                this.html('el1', 'div', parent, {}, (p: any) =>
                    [this.yield('y1', 'body', null, p)]),
            ]);
        });
        activateSections(h.ctrl);
        expect(h.container.querySelector('div > p')?.textContent).toBe('block content');
    });
});

describe('Section/Yield — <textarea>', () => {
    it('sets .value directly instead of inserting a text node child', () => {
        h = mountView(function () {
            this.section('draft', { type: 'static', contentType: 'text' }, () => 'draft text');
            return this.wrapper((parent: any) => [
                this.html('ta1', 'textarea', parent, {}, (p: any) =>
                    [this.yield('y1', 'draft', '', p)]),
            ]);
        });
        activateSections(h.ctrl);

        const textarea = h.container.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea.value).toBe('draft text');
        // No text node siblings were inserted between the yield's markers.
        expect(Array.from(textarea.childNodes).some(n => n.nodeType === Node.TEXT_NODE)).toBe(false);
    });
});

describe('yieldContent() — attribute usage', () => {
    it('resolves the active section synchronously, falling back to defaultValue', () => {
        h = mountView(function () {
            this.section('theme', { type: 'static', contentType: 'text' }, () => 'dark');
            return this.wrapper(() => []);
        });
        expect(h.ctrl.yieldContent('theme', 'light')).toBe('dark');
        expect(h.ctrl.yieldContent('unknown-section', 'light')).toBe('light');
    });

    it('an attr="@yield(...)" binding updates live when the section it resolves is reactive — no stateKeys of its own', async () => {
        h = mountView(function () {
            const manager: any = this.states.__;
            this.section('theme-color', { type: 'reactive', contentType: 'text', stateKeys: ['color'] },
                () => manager.states['color'].value);
            return this.wrapper((parent: any) => [
                this.html('el1', 'meta', parent, {
                    attrs: {
                        content: {
                            type: 'binding',
                            value: this.yieldContent('theme-color', '#000'),
                            factory: () => this.yieldContent('theme-color', '#000'),
                            stateKeys: [],
                            yieldName: 'theme-color',
                        },
                    },
                }, () => []),
            ]);
        }, { states: { color: '#111' } });
        activateSections(h.ctrl);

        const meta = h.container.querySelector('meta')!;
        expect(meta.getAttribute('content')).toBe('#111');

        h.setState('color', '#222');
        await nextFrame();
        expect(meta.getAttribute('content')).toBe('#222');
    });
});

describe('Section — head metadata sync (meta:*)', () => {
    // HeadService is a process-wide singleton (like BlockManager/SectionManager) —
    // go through resetPageHead() so both its tracked state AND the DOM it wrote
    // are cleared consistently between tests, not just the DOM.
    beforeEach(() => { SectionManager.resetPageHead(); });

    it('pushes meta:title to document.title and meta:description to a <meta> tag', () => {
        h = mountView(function () {
            this.section('meta:title', { type: 'static', contentType: 'text' }, () => 'Page One');
            this.section('meta:description', { type: 'static', contentType: 'text' }, () => 'First page');
            return this.wrapper(() => []);
        });
        activateSections(h.ctrl);

        expect(document.title).toBe('Page One');
        expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('First page');
    });

    it('updates document.title live when the reactive section changes', async () => {
        h = mountView(function () {
            const manager: any = this.states.__;
            this.section('meta:title', { type: 'reactive', contentType: 'text', stateKeys: ['count'] },
                () => `Count: ${manager.states['count'].value}`);
            return this.wrapper(() => []);
        }, { states: { count: 0 } });
        activateSections(h.ctrl);
        expect(document.title).toBe('Count: 0');

        h.setState('count', 1);
        await nextFrame();
        expect(document.title).toBe('Count: 1');
    });

    it('resetPageHead() (called by ViewManager at the start of every navigation) prevents a tag from leaking into the next page', () => {
        h = mountView(function () {
            this.section('meta:description', { type: 'static', contentType: 'text' }, () => 'Page A description');
            return this.wrapper(() => []);
        });
        activateSections(h.ctrl);
        expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Page A description');

        // Simulate ViewManager.mountView()'s navigation-start reset, then mount a
        // page that never declares meta:description.
        SectionManager.resetPageHead();
        h.destroy();
        h = mountView(function () {
            return this.wrapper(() => []);
        });
        activateSections(h.ctrl);

        expect(document.head.querySelector('meta[name="description"]')).toBeNull();
    });
});

describe('Section/Yield — cleanup on destroy', () => {
    it('unregisters sections and yields owned by the destroyed view', () => {
        h = mountView(function () {
            this.section('scoped', { type: 'static', contentType: 'text' }, () => 'value');
            return this.wrapper((parent: any) => [
                this.html('el1', 'span', parent, {}, (p: any) =>
                    [this.yield('y1', 'scoped', '', p)]),
            ]);
        });
        activateSections(h.ctrl);
        const viewId = h.ctrl.viewId;

        expect(Array.from(SectionManager.sections.values()).some(s => s.viewId === viewId)).toBe(true);
        expect(Array.from(SectionManager.yields.values()).some((y: any) => y.ctx?.viewId === viewId)).toBe(true);

        h.destroy();
        h = null;

        expect(Array.from(SectionManager.sections.values()).some(s => s.viewId === viewId)).toBe(false);
        expect(Array.from(SectionManager.yields.values()).some((y: any) => y.ctx?.viewId === viewId)).toBe(false);
    });
});
