/**
 * Tests cho PageCacheService — LRU + TTL 15' + detach/restore (ROUTE_RENDER_FLOW.md §8.5).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { PageCacheService, detachWrapperDOM } from '../../src/core/services/PageCache';
import { mountView, nextFrame, visibleText, Harness } from '../helpers/harness';

let h: Harness | null = null;
afterEach(() => { h?.destroy(); h = null; });

function fakeView(): any {
    let destroyed = false;
    return {
        __ctrl__: {
            destroy: () => { destroyed = true; },
            get lifecycleState() { return destroyed ? 'destroyed' : 'paused'; },
        },
        get destroyed() { return destroyed; },
    };
}

function makeEntry(cache: PageCacheService, url: string, ttl?: number) {
    const view = fakeView();
    cache.set(url, { views: [view], fragment: document.createDocumentFragment(), ttl });
    return view;
}

describe('PageCache — LRU + TTL', () => {
    it('set + take: lấy entry ra khỏi cache (single ownership)', () => {
        const cache = new PageCacheService();
        makeEntry(cache, '/a');
        expect(cache.size).toBe(1);
        const entry = cache.take('/a');
        expect(entry).not.toBeNull();
        expect(cache.size).toBe(0);
        expect(cache.take('/a')).toBeNull();
    });

    it('TTL: entry quá 15 phút bị destroy khi take()', () => {
        const cache = new PageCacheService();
        let time = 1_000_000;
        cache.now = () => time;

        const view = makeEntry(cache, '/a');
        time += 15 * 60 * 1000 + 1; // quá 15'

        expect(cache.take('/a')).toBeNull();
        expect(view.destroyed).toBe(true);
    });

    it('TTL: sweep() destroy mọi entry quá hạn, giữ entry còn hạn', () => {
        const cache = new PageCacheService();
        let time = 0;
        cache.now = () => time;

        const v1 = makeEntry(cache, '/old');
        time += 10 * 60 * 1000;            // 10'
        const v2 = makeEntry(cache, '/new');
        time += 6 * 60 * 1000;             // /old = 16' (hết hạn), /new = 6'

        const removed = cache.sweep();
        expect(removed).toBe(1);
        expect(v1.destroyed).toBe(true);
        expect(v2.destroyed).toBe(false);
        expect(cache.has('/new')).toBe(true);
    });

    it('LRU: vượt maxEntries → destroy entry cũ nhất', () => {
        const cache = new PageCacheService();
        cache.maxEntries = 2;
        const v1 = makeEntry(cache, '/1');
        const v2 = makeEntry(cache, '/2');
        const v3 = makeEntry(cache, '/3');

        expect(cache.size).toBe(2);
        expect(v1.destroyed).toBe(true);  // cũ nhất bị evict
        expect(v2.destroyed).toBe(false);
        expect(v3.destroyed).toBe(false);
    });

    it('ttl: 0 → không cache, destroy luôn', () => {
        const cache = new PageCacheService();
        const view = makeEntry(cache, '/no-cache', 0);
        expect(cache.size).toBe(0);
        expect(view.destroyed).toBe(true);
    });

    it('invalidate: destroy + gọi onEvict (để ViewManager dọn store)', () => {
        const cache = new PageCacheService();
        const evicted: string[] = [];
        cache.onEvict = (e) => evicted.push(e.urlPath);

        const view = makeEntry(cache, '/a');
        expect(cache.invalidate('/a')).toBe(true);
        expect(view.destroyed).toBe(true);
        expect(evicted).toEqual(['/a']);
    });

    it('set trùng path → destroy bản cũ trước', () => {
        const cache = new PageCacheService();
        const v1 = makeEntry(cache, '/a');
        const v2 = makeEntry(cache, '/a');
        expect(cache.size).toBe(1);
        expect(v1.destroyed).toBe(true);
        expect(v2.destroyed).toBe(false);
    });
});

describe('detachWrapperDOM + restore (vòng đời thật với pause/resume)', () => {
    it('pause → detach → container rỗng; reattach → resume → reactive hoạt động lại', async () => {
        h = mountView(function () {
            const manager: any = this.states.__;
            return this.wrapper((parent: any) => [
                this.html('el1', 'span', parent, {}, (p: any) => [
                    this.output('o1', p, true, ['msg'], () => manager.states['msg'].value),
                ]),
            ]);
        }, { states: { msg: 'hello' } });

        const wrapper = h.wrapper;
        expect(visibleText(h.container)).toBe('hello');

        // 1. Pause + detach (như navigate đi)
        h.ctrl.pause();
        const fragment = detachWrapperDOM(wrapper);
        expect(h.container.childNodes.length).toBe(0);          // container rỗng
        expect(fragment.querySelector('span')).not.toBeNull();   // DOM sống trong fragment

        // 2. State đổi trong lúc cached (vd global store update)
        h.setState('msg', 'updated');

        // 3. Restore (như back) — reattach + resume
        h.container.appendChild(fragment);
        h.ctrl.resume();
        await nextFrame();

        // DOM quay lại + dirty key được flush
        expect(visibleText(h.container.querySelector('span')!)).toBe('updated');

        // 4. Reactive tiếp tục hoạt động bình thường
        h.setState('msg', 'again');
        await nextFrame();
        expect(visibleText(h.container.querySelector('span')!)).toBe('again');
    });
});
