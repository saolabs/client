/**
 * Tests cho pause/resume lifecycle + dirty tracking — ROUTE_RENDER_FLOW.md §7, §8.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mountView, nextFrame, visibleText, Harness } from '../helpers/harness';

let h: Harness | null = null;
afterEach(() => { h?.destroy(); h = null; });

function counterView() {
    return mountView(function () {
        const manager: any = this.states.__;
        return this.wrapper((parent: any) => [
            this.html('el1', 'span', parent, {}, (p: any) => [
                this.output('o1', p, true, ['count'], () => String(manager.states['count'].value)),
            ]),
        ]);
    }, { states: { count: 0 } });
}

describe('pause() — dirty mode', () => {
    it('state đổi trong lúc paused KHÔNG đụng DOM', async () => {
        h = counterView();
        h.ctrl.pause();
        expect(h.ctrl.lifecycleState).toBe('paused');

        h.setState('count', 99);
        await nextFrame();
        // DOM giữ nguyên snapshot lúc pause
        expect(visibleText(h.container.querySelector('span')!)).toBe('0');
        // Nhưng giá trị state ĐÃ được cập nhật (đọc được ngay)
        expect(h.getState('count')).toBe(99);
    });

    it('pause flush nốt update đang chờ RAF trước khi dừng (không mất update)', async () => {
        h = counterView();
        h.setState('count', 5);  // RAF đang chờ
        h.ctrl.pause();          // phải flush 5 vào DOM trước khi pause
        expect(visibleText(h.container.querySelector('span')!)).toBe('5');
    });

    it('pause 2 lần / pause khi chưa active → an toàn, không throw', () => {
        h = counterView();
        h.ctrl.pause();
        h.ctrl.pause(); // no-op
        expect(h.ctrl.lifecycleState).toBe('paused');
    });
});

describe('resume() — flush dirty', () => {
    it('resume flush đúng key dirty → DOM cập nhật', async () => {
        h = counterView();
        h.ctrl.pause();
        h.setState('count', 42);

        h.ctrl.resume();
        await nextFrame(); // listener notify → Output.update
        expect(h.ctrl.lifecycleState).toBe('active');
        expect(visibleText(h.container.querySelector('span')!)).toBe('42');
    });

    it('resume khi không có gì đổi → DOM không bị render lại (giữ nguyên text node)', () => {
        h = counterView();
        const textNodeBefore = h.container.querySelector('span')!.childNodes[1]; // [marker, text, marker]
        h.ctrl.pause();
        h.ctrl.resume();
        const textNodeAfter = h.container.querySelector('span')!.childNodes[1];
        expect(textNodeBefore).toBe(textNodeAfter);
    });

    it('hooks onPause/onResume được gọi', () => {
        const calls: string[] = [];
        h = counterView();
        (h.view as any).onPause = () => calls.push('pause');
        (h.view as any).onResume = () => calls.push('resume');

        h.ctrl.pause();
        h.ctrl.resume();
        expect(calls).toEqual(['pause', 'resume']);
    });

    it('updateData trong lúc paused được buffer, apply khi resume', async () => {
        // View có updateVariableData như compiled output
        let applied: any = null;
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('el1', 'span', parent, {}, (p: any) => [
                    this.output('o1', p, true, ['count'], () => String(manager.states['count'].value)),
                ]),
            ]);
        }, { states: { count: 0 } });

        (h.ctrl as any).runtimeConfig = {
            ...(h.ctrl as any).runtimeConfig,
            updateVariableData(data: any) { applied = data; },
        };

        h.ctrl.pause();
        h.ctrl.updateData({ count: 7 });
        expect(applied).toBeNull(); // chưa apply — đang buffer

        h.ctrl.resume();
        expect(applied).toEqual({ count: 7 }); // apply lúc resume
    });
});

describe('destroy() từ paused', () => {
    it('destroy được từ trạng thái paused, lifecycleState = destroyed', () => {
        h = counterView();
        h.ctrl.pause();
        h.ctrl.destroy();
        expect(h.ctrl.lifecycleState).toBe('destroyed');
        // resume sau destroy → no-op an toàn
        h.ctrl.resume();
        expect(h.ctrl.lifecycleState).toBe('destroyed');
    });
});
