/**
 * Tests cho bộ 14 lifecycle hook (mẫu examples/sao/app.sao) + asset ref-count.
 * Cặp before/after: mounting/mounted, starting/started, pausing/paused,
 * resuming/resumed, stopping/stopped, unmounting/unmounted, destroying/destroyed.
 */
import { describe, it, expect, afterEach } from 'vitest';
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

    it('destroy fire destroying→unmounting→unmounted→destroyed', () => {
        const log: string[] = [];
        const hooks: any = {};
        for (const n of ['destroying', 'unmounting', 'unmounted', 'destroyed']) hooks[n] = () => log.push(n);
        const local = makeView(hooks);
        local.ctrl.destroy();
        local.container.remove();
        expect(log).toEqual(['destroying', 'unmounting', 'unmounted', 'destroyed']);
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
});

describe('AssetManager — global style ref-count theo component path', () => {
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
});

describe('AssetManager — script (không export)', () => {
    it('insert <script> inline, ref-count + remove khi hết instance', () => {
        const a = makeView({}, { path: 'comp.J', scripts: [{ type: 'code', content: 'window.__x=1' }] });
        const b = makeView({}, { path: 'comp.J', scripts: [{ type: 'code', content: 'window.__x=1' }] });
        expect(document.head.querySelectorAll('script[data-sao-asset]').length).toBe(1);
        a.ctrl.destroy(); a.container.remove();
        expect(document.head.querySelectorAll('script[data-sao-asset]').length).toBe(1);
        b.ctrl.destroy(); b.container.remove();
        expect(document.head.querySelectorAll('script[data-sao-asset]').length).toBe(0);
    });
});
