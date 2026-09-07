/**
 * MarkerRegistry marker index — claim O(1) khi hydrate.
 *
 * Trước đây mỗi element tự tạo TreeWalker quét toàn bộ comment trong parent để
 * tìm đúng 2 chuỗi → O(số element × số comment). Index dựng 1 lượt, claim =
 * Map.get. Test này khoá các ràng buộc mà index PHẢI giữ nguyên so với scan cũ.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import { MarkerService } from '../../src/core/services/MarkerService';

const pair = (tag: string, id: string, inner = 'x') =>
    `<!--${MarkerRegistry.openComment(tag, id)}-->${inner}<!--${MarkerRegistry.closeComment(tag, id)}-->`;

describe('MarkerRegistry.claim (marker index)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        MarkerRegistry.clear(); // clear() bỏ luôn index
    });

    it('claim cặp marker SSR và giữ đúng node trong DOM', () => {
        document.body.innerHTML = `<div id="host">${pair('output', 'v1-e1')}</div>`;
        const claimed = MarkerRegistry.claim('output', 'v1-e1');

        expect(claimed).not.toBeNull();
        expect(claimed!.open.nodeValue).toBe('s:o:v1-e1-s');
        expect(claimed!.close.nodeValue).toBe('s:o:v1-e1-e');
        expect(claimed!.open.nextSibling).toBe(claimed!.close.previousSibling);
    });

    it('trả null khi server không render vùng đó (partial hydration)', () => {
        document.body.innerHTML = `<div>${pair('output', 'v1-e1')}</div>`;
        expect(MarkerRegistry.claim('output', 'khong-ton-tai')).toBeNull();
    });

    it('MỌI marker cùng loại đều claim được, không chỉ cái đầu tiên', () => {
        // Regression: SaoMarker dùng chung một TreeWalker và không reset
        // currentNode → từ lần query thứ hai trở đi mọi marker "biến mất",
        // nên @block thứ 2 trở đi lặng lẽ tạo marker mới thay vì claim.
        document.body.innerHTML =
            ['A', 'B', 'C'].map(id => pair('block', id)).join('');

        for (const id of ['A', 'B', 'C']) {
            expect(MarkerRegistry.claim('block', id), `block ${id}`).not.toBeNull();
        }

        const svc = new MarkerService();
        for (const id of ['A', 'B', 'C']) {
            expect(svc.first('block', id), `MarkerService block ${id}`).not.toBeNull();
        }
    });

    it('tự dựng lại khi HTML server mới vào DOM sau lần index đầu', async () => {
        document.body.innerHTML = pair('view', 'old');
        expect(MarkerRegistry.claim('view', 'old')).not.toBeNull();

        document.body.innerHTML = pair('view', 'new');
        await Promise.resolve(); // mở lại quota rebuild (1 lần / microtask)

        expect(MarkerRegistry.claim('view', 'new')).not.toBeNull();
        expect(MarkerRegistry.claim('view', 'old')).toBeNull(); // node đã rời DOM
    });

    it('scope: không claim cặp nằm ngoài parent được truyền vào', () => {
        document.body.innerHTML =
            `<div id="a">${pair('reactive', 'dup')}</div><div id="b"></div>`;
        const b = document.getElementById('b')!;

        expect(MarkerRegistry.claim('reactive', 'dup')).not.toBeNull();
        expect(MarkerRegistry.claim('reactive', 'dup', b)).toBeNull();
    });
});
