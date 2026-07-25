/**
 * Tests cho bộ 14 lifecycle hook (mẫu examples/sao/app.sao) + asset ref-count.
 * Cặp before/after: mounting/mounted, starting/started, pausing/paused,
 * resuming/resumed, stopping/stopped, unmounting/unmounted, destroying/destroyed.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mountView, nextFrame, Harness } from '../helpers/harness';
import AssetManager from '../../src/core/services/AssetManager';

let h: Harness | null = null;
afterEach(() => { h?.destroy(); h = null; AssetManager.clear(); });

/** View đơn giản có 1 <span> reactive theo count. */
function makeView(hooks: Record<string, (...a: any[]) => any> = {}, opts: any = {}) {
    return mountView(function () {
        const manager: any = this.states.__;
        return this.wrapper((parent: any) => [
            this.html('el1', 'span', parent, {}, (p: any) => [
                this.output('o1', p, true, ['count'], () => String(manager.states['count'].value)),
            ]),
        ]);
    }, { states: { count: 0 }, methods: hooks, ...opts });
}

describe('Lifecycle hooks — cặp before/after fire đúng thứ tự', () => {
    it('mount + start fire mounting→mounted→starting→started (mounted trước starting)', () => {
        const log: string[] = [];
        const names = ['mounting', 'mounted', 'starting', 'started'];
        const hooks: any = {};
        for (const n of names) hooks[n] = () => log.push(n);
        h = makeView(hooks);
        expect(log).toEqual(['mounting', 'mounted', 'starting', 'started']);
    });

    it('pause fire pausing→paused; resume fire resuming→resumed', () => {
        const log: string[] = [];
        const hooks: any = {};
        for (const n of ['pausing', 'paused', 'resuming', 'resumed']) hooks[n] = () => log.push(n);
        h = makeView(hooks);
        h.ctrl.pause();
        h.ctrl.resume();
        expect(log).toEqual(['pausing', 'paused', 'resuming', 'resumed']);
    });

    it('stop fire stopping→stopped', () => {
        const log: string[] = [];
        const hooks: any = { stopping: () => log.push('stopping'), stopped: () => log.push('stopped') };
        h = makeView(hooks);
        h.ctrl.stop();
        expect(log).toEqual(['stopping', 'stopped']);
    });

    it('start/stop idempotent — không nhân đôi subscription và hook', () => {
        const log: string[] = [];
        h = makeView({
            starting: () => log.push('starting'),
            started: () => log.push('started'),
            stopping: () => log.push('stopping'),
            stopped: () => log.push('stopped'),
        });

        h.ctrl.start();
        h.ctrl.stop();
        h.ctrl.stop();

        expect(log).toEqual(['starting', 'started', 'stopping', 'stopped']);
    });

    it('destroy fire destroying→unmounting→unmounted→destroyed', () => {
        const log: string[] = [];
        const hooks: any = {};
        for (const n of ['destroying', 'unmounting', 'unmounted', 'destroyed']) hooks[n] = () => log.push(n);
        const local = makeView(hooks);
        local.ctrl.destroy();
        local.container.remove();
        expect(log).toEqual(['destroying', 'unmounting', 'unmounted', 'destroyed']);
    });

    it('destroy một view active phải stop trước khi unmount', () => {
        const log: string[] = [];
        const names = ['destroying', 'stopping', 'stopped', 'unmounting', 'unmounted', 'destroyed'];
        const hooks: any = {};
        for (const name of names) hooks[name] = () => log.push(name);

        const local = makeView(hooks);
        local.ctrl.destroy();
        local.container.remove();

        expect(log).toEqual(names);
    });

    it('legacy alias vẫn fire: onMounted (start), onPause/onResume, onDeactivated (stop), onDestroy', () => {
        const log: string[] = [];
        const hooks: any = {
            onMounted: () => log.push('onMounted'),
            onPause: () => log.push('onPause'),
            onResume: () => log.push('onResume'),
            onDeactivated: () => log.push('onDeactivated'),
            onDestroy: () => log.push('onDestroy'),
        };
        const local = makeView(hooks);
        expect(log).toContain('onMounted');
        local.ctrl.pause();
        local.ctrl.resume();
        expect(log).toContain('onPause');
        expect(log).toContain('onResume');
        local.ctrl.stop();
        expect(log).toContain('onDeactivated');
        local.ctrl.destroy();
        local.container.remove();
        expect(log).toContain('onDestroy');
    });

    it('hook throw không làm vỡ transition (try/catch)', async () => {
        const hooks: any = { mounted: () => { throw new Error('boom'); } };
        h = makeView(hooks);
        await nextFrame();
        expect(h.ctrl.lifecycleState).toBe('active'); // vẫn active dù hook lỗi
    });

    it('hook async reject được log, không thành unhandled rejection', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        h = makeView({ mounted: async () => { throw new Error('async boom'); } });

        await Promise.resolve();

        expect(h.ctrl.lifecycleState).toBe('active');
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining('async hook "mounted" error'),
            expect.any(Error),
        );
        error.mockRestore();
    });
});

describe('AssetManager — global style ref-count theo asset identity', () => {
    const GLOBAL_STYLE = [{ type: 'code', content: '.gx{color:red}' }];

    function headStyles(): HTMLStyleElement[] {
        return Array.from(document.head.querySelectorAll('style[data-sao-asset]'));
    }

    it('mount insert đúng 1 <style>; destroy remove', () => {
        const local = makeView({}, { path: 'comp.A', styles: GLOBAL_STYLE });
        expect(headStyles().length).toBe(1);
        expect(document.head.textContent).toContain('.gx{color:red}');
        local.ctrl.destroy();
        local.container.remove();
        expect(headStyles().length).toBe(0);
    });

    it('2 instance cùng path → insert 1 lần; remove instance 1 KHÔNG gỡ style (ref còn)', () => {
        const a = makeView({}, { path: 'comp.A', styles: GLOBAL_STYLE });
        const b = makeView({}, { path: 'comp.A', styles: GLOBAL_STYLE });
        expect(headStyles().length).toBe(1); // chỉ 1 node dù 2 instance
        expect(AssetManager.refCount('comp.A', 'sty', 0)).toBe(2);

        a.ctrl.destroy(); a.container.remove();
        expect(headStyles().length).toBe(1); // b còn → giữ style
        expect(AssetManager.refCount('comp.A', 'sty', 0)).toBe(1);

        b.ctrl.destroy(); b.container.remove();
        expect(headStyles().length).toBe(0); // hết instance → remove
    });

    it('pause (rời real DOM) remove style; resume (back) insert lại', () => {
        h = makeView({}, { path: 'comp.A', styles: GLOBAL_STYLE });
        expect(headStyles().length).toBe(1);

        h.ctrl.pause();
        expect(headStyles().length).toBe(0); // rời DOM → gỡ

        h.ctrl.resume();
        expect(headStyles().length).toBe(1); // back → insert lại
    });

    it('pause instance 1 nhưng instance 2 còn active → style KHÔNG bị gỡ', () => {
        const a = makeView({}, { path: 'comp.A', styles: GLOBAL_STYLE });
        const b = makeView({}, { path: 'comp.A', styles: GLOBAL_STYLE });
        a.ctrl.pause();
        expect(headStyles().length).toBe(1); // b vẫn giữ
        expect(AssetManager.refCount('comp.A', 'sty', 0)).toBe(1);
        a.ctrl.destroy(); a.container.remove();
        b.ctrl.destroy(); b.container.remove();
    });

    it('2 path khác nhau → 2 node style riêng', () => {
        const a = makeView({}, { path: 'comp.A', styles: [{ type: 'code', content: '.a{}' }] });
        const b = makeView({}, { path: 'comp.B', styles: [{ type: 'code', content: '.b{}' }] });
        expect(headStyles().length).toBe(2);
        a.ctrl.destroy(); a.container.remove();
        b.ctrl.destroy(); b.container.remove();
    });

    it('2 path khác nhau khai báo cùng CSS global → dùng chung đúng 1 node', () => {
        const a = makeView({}, { path: 'comp.A', styles: GLOBAL_STYLE });
        const b = makeView({}, { path: 'comp.B', styles: GLOBAL_STYLE });
        expect(headStyles().length).toBe(1);

        a.ctrl.destroy(); a.container.remove();
        expect(headStyles().length).toBe(1);

        b.ctrl.destroy(); b.container.remove();
        expect(headStyles().length).toBe(0);
    });

    it('stylesheet cùng href + attributes được dedup; media khác là asset khác', () => {
        const shared = [{ type: 'href', href: '/shared.css', attributes: { media: 'screen' } }];
        const a = makeView({}, { path: 'comp.A', styles: shared });
        const b = makeView({}, { path: 'comp.B', styles: shared });
        const c = makeView({}, {
            path: 'comp.C',
            styles: [{ type: 'href', href: '/shared.css', attributes: { media: 'print' } }],
        });
        expect(document.head.querySelectorAll('link[data-sao-asset]').length).toBe(2);
        a.ctrl.destroy(); a.container.remove();
        b.ctrl.destroy(); b.container.remove();
        c.ctrl.destroy(); c.container.remove();
    });

    it('hydrate adopt stylesheet Blade SSR, không chèn link thứ hai', () => {
        const ssrLink = document.createElement('link');
        ssrLink.rel = 'stylesheet';
        ssrLink.href = '/shared-ssr.css';
        ssrLink.media = 'screen';
        document.head.appendChild(ssrLink);

        const local = makeView({}, {
            path: 'comp.SSR',
            styles: [{ type: 'href', href: '/shared-ssr.css', attributes: { media: 'screen' } }],
        });

        const links = document.head.querySelectorAll('link[href$="/shared-ssr.css"]');
        expect(links.length).toBe(1);
        expect(links[0]).toBe(ssrLink);
        expect(ssrLink.getAttribute('data-sao-asset')).toBe('comp.SSR');

        local.ctrl.destroy(); local.container.remove();
        expect(document.head.querySelector('link[href$="/shared-ssr.css"]')).toBeNull();
    });
});

describe('AssetManager — scoped style', () => {
    it('scoped → selector được prefix scope attr + node có data-sao-scope', () => {
        const local = makeView({}, {
            path: 'comp.S',
            styles: [{ type: 'code', content: '.box{color:blue}', scoped: true }],
        });
        const styleEl = document.head.querySelector('style[data-sao-scope]') as HTMLStyleElement;
        expect(styleEl).toBeTruthy();
        const scopeId = styleEl.getAttribute('data-sao-scope')!;
        expect(styleEl.textContent).toContain(`[data-sao-scope="${scopeId}"] .box`);
        // subtree của instance được tag scope
        const span = local.container.querySelector('span');
        expect(span?.getAttribute('data-sao-scope')).toBe(scopeId);
        local.ctrl.destroy(); local.container.remove();
    });

    it('cùng CSS scoped nhưng khác View path → scope và style node tách biệt', () => {
        const styles = [{ type: 'code', content: '.box{color:blue}', scoped: true }];
        const a = makeView({}, { path: 'comp.SA', styles });
        const b = makeView({}, { path: 'comp.SB', styles });
        const nodes = Array.from(document.head.querySelectorAll('style[data-sao-scope]'));
        expect(nodes.length).toBe(2);
        expect(nodes[0].getAttribute('data-sao-scope')).not.toBe(nodes[1].getAttribute('data-sao-scope'));
        a.ctrl.destroy(); a.container.remove();
        b.ctrl.destroy(); b.container.remove();
    });
});

describe('AssetManager — script (không export)', () => {
    it('inline script cùng identity chỉ insert một lần và giữ tới teardown document', () => {
        const a = makeView({}, { path: 'comp.J', scripts: [{ type: 'code', content: 'window.__x=1' }] });
        const b = makeView({}, { path: 'comp.K', scripts: [{ type: 'code', content: 'window.__x=1' }] });
        expect(document.head.querySelectorAll('script[data-sao-asset]').length).toBe(1);
        a.ctrl.destroy(); a.container.remove();
        expect(document.head.querySelectorAll('script[data-sao-asset]').length).toBe(1);
        b.ctrl.destroy(); b.container.remove();
        // Gỡ <script> không hoàn tác side effect; giữ node/record để back không execute lại.
        expect(document.head.querySelectorAll('script[data-sao-asset]').length).toBe(1);
    });

    it('script src dedup theo src + attributes và không reload khi pause/resume', () => {
        const scripts = [{ type: 'src', src: '/shared.js', attributes: { defer: true } }];
        const a = makeView({}, { path: 'comp.JA', scripts });
        const b = makeView({}, { path: 'comp.JB', scripts });
        const node = document.head.querySelector('script[src="/shared.js"]');
        expect(document.head.querySelectorAll('script[src="/shared.js"]').length).toBe(1);

        a.ctrl.pause();
        b.ctrl.pause();
        expect(document.head.querySelector('script[src="/shared.js"]')).toBe(node);

        a.ctrl.resume();
        expect(document.head.querySelector('script[src="/shared.js"]')).toBe(node);
        a.ctrl.destroy(); a.container.remove();
        b.ctrl.destroy(); b.container.remove();
    });
});
