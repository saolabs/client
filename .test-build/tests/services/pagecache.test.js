"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Tests cho PageCacheService — LRU + TTL 15' + detach/restore (ROUTE_RENDER_FLOW.md §8.5).
 */
const vitest_1 = require("vitest");
const PageCache_1 = require("../../src/core/services/PageCache");
const harness_1 = require("../helpers/harness");
let h = null;
(0, vitest_1.afterEach)(() => { h?.destroy(); h = null; });
function fakeView() {
    let destroyed = false;
    return {
        __ctrl__: {
            destroy: () => { destroyed = true; },
            get lifecycleState() { return destroyed ? 'destroyed' : 'paused'; },
        },
        get destroyed() { return destroyed; },
    };
}
function makeEntry(cache, url, ttl) {
    const view = fakeView();
    cache.set(url, { views: [view], fragment: document.createDocumentFragment(), ttl });
    return view;
}
(0, vitest_1.describe)('PageCache — LRU + TTL', () => {
    (0, vitest_1.it)('set + take: lấy entry ra khỏi cache (single ownership)', () => {
        const cache = new PageCache_1.PageCacheService();
        makeEntry(cache, '/a');
        (0, vitest_1.expect)(cache.size).toBe(1);
        const entry = cache.take('/a');
        (0, vitest_1.expect)(entry).not.toBeNull();
        (0, vitest_1.expect)(cache.size).toBe(0);
        (0, vitest_1.expect)(cache.take('/a')).toBeNull();
    });
    (0, vitest_1.it)('TTL: entry quá 15 phút bị destroy khi take()', () => {
        const cache = new PageCache_1.PageCacheService();
        let time = 1000000;
        cache.now = () => time;
        const view = makeEntry(cache, '/a');
        time += 15 * 60 * 1000 + 1; // quá 15'
        (0, vitest_1.expect)(cache.take('/a')).toBeNull();
        (0, vitest_1.expect)(view.destroyed).toBe(true);
    });
    (0, vitest_1.it)('TTL: sweep() destroy mọi entry quá hạn, giữ entry còn hạn', () => {
        const cache = new PageCache_1.PageCacheService();
        let time = 0;
        cache.now = () => time;
        const v1 = makeEntry(cache, '/old');
        time += 10 * 60 * 1000; // 10'
        const v2 = makeEntry(cache, '/new');
        time += 6 * 60 * 1000; // /old = 16' (hết hạn), /new = 6'
        const removed = cache.sweep();
        (0, vitest_1.expect)(removed).toBe(1);
        (0, vitest_1.expect)(v1.destroyed).toBe(true);
        (0, vitest_1.expect)(v2.destroyed).toBe(false);
        (0, vitest_1.expect)(cache.has('/new')).toBe(true);
    });
    (0, vitest_1.it)('LRU: vượt maxEntries → destroy entry cũ nhất', () => {
        const cache = new PageCache_1.PageCacheService();
        cache.maxEntries = 2;
        const v1 = makeEntry(cache, '/1');
        const v2 = makeEntry(cache, '/2');
        const v3 = makeEntry(cache, '/3');
        (0, vitest_1.expect)(cache.size).toBe(2);
        (0, vitest_1.expect)(v1.destroyed).toBe(true); // cũ nhất bị evict
        (0, vitest_1.expect)(v2.destroyed).toBe(false);
        (0, vitest_1.expect)(v3.destroyed).toBe(false);
    });
    (0, vitest_1.it)('ttl: 0 → không cache, destroy luôn', () => {
        const cache = new PageCache_1.PageCacheService();
        const view = makeEntry(cache, '/no-cache', 0);
        (0, vitest_1.expect)(cache.size).toBe(0);
        (0, vitest_1.expect)(view.destroyed).toBe(true);
    });
    (0, vitest_1.it)('invalidate: destroy + gọi onEvict (để ViewManager dọn store)', () => {
        const cache = new PageCache_1.PageCacheService();
        const evicted = [];
        cache.onEvict = (e) => evicted.push(e.urlPath);
        const view = makeEntry(cache, '/a');
        (0, vitest_1.expect)(cache.invalidate('/a')).toBe(true);
        (0, vitest_1.expect)(view.destroyed).toBe(true);
        (0, vitest_1.expect)(evicted).toEqual(['/a']);
    });
    (0, vitest_1.it)('set trùng path → destroy bản cũ trước', () => {
        const cache = new PageCache_1.PageCacheService();
        const v1 = makeEntry(cache, '/a');
        const v2 = makeEntry(cache, '/a');
        (0, vitest_1.expect)(cache.size).toBe(1);
        (0, vitest_1.expect)(v1.destroyed).toBe(true);
        (0, vitest_1.expect)(v2.destroyed).toBe(false);
    });
});
(0, vitest_1.describe)('detachWrapperDOM + restore (vòng đời thật với pause/resume)', () => {
    (0, vitest_1.it)('pause → detach → container rỗng; reattach → resume → reactive hoạt động lại', async () => {
        h = (0, harness_1.mountView)(function () {
            const manager = this.states.__;
            return this.wrapper((parent) => [
                this.html('el1', 'span', parent, {}, (p) => [
                    this.output('o1', p, true, ['msg'], () => manager.states['msg'].value),
                ]),
            ]);
        }, { states: { msg: 'hello' } });
        const wrapper = h.wrapper;
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container)).toBe('hello');
        // 1. Pause + detach (như navigate đi)
        h.ctrl.pause();
        const fragment = (0, PageCache_1.detachWrapperDOM)(wrapper);
        (0, vitest_1.expect)(h.container.childNodes.length).toBe(0); // container rỗng
        (0, vitest_1.expect)(fragment.querySelector('span')).not.toBeNull(); // DOM sống trong fragment
        // 2. State đổi trong lúc cached (vd global store update)
        h.setState('msg', 'updated');
        // 3. Restore (như back) — reattach + resume
        h.container.appendChild(fragment);
        h.ctrl.resume();
        await (0, harness_1.nextFrame)();
        // DOM quay lại + dirty key được flush
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('span'))).toBe('updated');
        // 4. Reactive tiếp tục hoạt động bình thường
        h.setState('msg', 'again');
        await (0, harness_1.nextFrame)();
        (0, vitest_1.expect)((0, harness_1.visibleText)(h.container.querySelector('span'))).toBe('again');
    });
});
