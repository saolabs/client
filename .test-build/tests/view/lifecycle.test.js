"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Tests cho pause/resume lifecycle + dirty tracking — ROUTE_RENDER_FLOW.md §7, §8.
 */
const vitest_1 = require("vitest");
const harness_1 = require("../helpers/harness");
let h = null;
(0, vitest_1.afterEach)(() => { h?.destroy(); h = null; });
function counterView() {
    return (0, harness_1.mountView)(function () {
        const manager = this.states.__;
        return this.wrapper((parent) => [
            this.html('el1', 'span', parent, {}, (p) => [
                this.output('o1', p, true, ['count'], () => String(manager.states['count'].value)),
            ]),
        ]);
    }, { states: { count: 0 } });
}
(0, vitest_1.describe)('pause() — dirty mode', () => {
    (0, vitest_1.it)('state đổi trong lúc paused KHÔNG đụng DOM', async () => {
        h = counterView();
        h.ctrl.pause();
        (0, vitest_1.expect)(h.ctrl.lifecycleState).toBe('paused');
        h.setState('count', 99);
        await (0, harness_1.nextFrame)();
        // DOM giữ nguyên snapshot lúc pause
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('span'))).toBe('0');
        // Nhưng giá trị state ĐÃ được cập nhật (đọc được ngay)
        (0, vitest_1.expect)(h.getState('count')).toBe(99);
    });
    (0, vitest_1.it)('pause flush nốt update đang chờ RAF trước khi dừng (không mất update)', async () => {
        h = counterView();
        h.setState('count', 5); // RAF đang chờ
        h.ctrl.pause(); // phải flush 5 vào DOM trước khi pause
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('span'))).toBe('5');
    });
    (0, vitest_1.it)('pause 2 lần / pause khi chưa active → an toàn, không throw', () => {
        h = counterView();
        h.ctrl.pause();
        h.ctrl.pause(); // no-op
        (0, vitest_1.expect)(h.ctrl.lifecycleState).toBe('paused');
    });
});
(0, vitest_1.describe)('resume() — flush dirty', () => {
    (0, vitest_1.it)('resume flush đúng key dirty → DOM cập nhật', async () => {
        h = counterView();
        h.ctrl.pause();
        h.setState('count', 42);
        h.ctrl.resume();
        await (0, harness_1.nextFrame)(); // listener notify → Output.update
        (0, vitest_1.expect)(h.ctrl.lifecycleState).toBe('active');
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('span'))).toBe('42');
    });
    (0, vitest_1.it)('resume khi không có gì đổi → DOM không bị render lại (giữ nguyên text node)', () => {
        h = counterView();
        const textNodeBefore = h.container.querySelector('span').childNodes[1]; // [marker, text, marker]
        h.ctrl.pause();
        h.ctrl.resume();
        const textNodeAfter = h.container.querySelector('span').childNodes[1];
        (0, vitest_1.expect)(textNodeBefore).toBe(textNodeAfter);
    });
    (0, vitest_1.it)('hooks onPause/onResume được gọi', () => {
        const calls = [];
        h = counterView();
        h.view.onPause = () => calls.push('pause');
        h.view.onResume = () => calls.push('resume');
        h.ctrl.pause();
        h.ctrl.resume();
        (0, vitest_1.expect)(calls).toEqual(['pause', 'resume']);
    });
    (0, vitest_1.it)('updateData trong lúc paused được buffer, apply khi resume', async () => {
        // View có updateVariableData như compiled output
        let applied = null;
        h = (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
                this.html('el1', 'span', parent, {}, (p) => [
                    this.output('o1', p, true, ['count'], () => String(manager.states['count'].value)),
                ]),
            ]);
        }, { states: { count: 0 } });
        h.ctrl.runtimeConfig = {
            ...h.ctrl.runtimeConfig,
            updateVariableData(data) { applied = data; },
        };
        h.ctrl.pause();
        h.ctrl.updateData({ count: 7 });
        (0, vitest_1.expect)(applied).toBeNull(); // chưa apply — đang buffer
        h.ctrl.resume();
        (0, vitest_1.expect)(applied).toEqual({ count: 7 }); // apply lúc resume
    });
});
(0, vitest_1.describe)('destroy() từ paused', () => {
    (0, vitest_1.it)('destroy được từ trạng thái paused, lifecycleState = destroyed', () => {
        h = counterView();
        h.ctrl.pause();
        h.ctrl.destroy();
        (0, vitest_1.expect)(h.ctrl.lifecycleState).toBe('destroyed');
        // resume sau destroy → no-op an toàn
        h.ctrl.resume();
        (0, vitest_1.expect)(h.ctrl.lifecycleState).toBe('destroyed');
    });
});
