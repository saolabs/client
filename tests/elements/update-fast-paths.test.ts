import { afterEach, describe, expect, it, vi } from 'vitest';
import { Html } from '../../src/core/elements/Html';
import { reconcileChildren } from '../../src/core/elements/reconcileChildren';
import { View } from '../../src/core/view/View';

/**
 * Các đường tắt của lượt cập nhật (11/11/2026). Mỗi test canh MỘT bất biến mà
 * số đo benchmark dựa vào — hỏng ở đây thì `@foreach` 1000 dòng chậm lại cả
 * chục lần mà không test hành vi nào đỏ.
 */
function makeController() {
    return new View('test.update-fast-paths', 'view').__ctrl__;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('Html.updateConfig', () => {
    it('giữ nguyên listener gốc khi re-render, nhưng gọi đúng handler MỚI', () => {
        const controller = makeController();
        const calls: string[] = [];
        const html = new Html({ ctx: controller, id: 'btn', tagName: 'button', config: { events: { click: [() => calls.push('cũ')] } } });
        const add = vi.spyOn(html.element, 'addEventListener');
        const remove = vi.spyOn(html.element, 'removeEventListener');

        html.updateConfig({ events: { click: [() => calls.push('mới')] } });
        html.element.click();

        expect(add).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
        expect(calls).toEqual(['mới']);

        // Event rời khỏi config thì listener phải được gỡ thật.
        html.updateConfig({});
        html.element.click();
        expect(calls).toEqual(['mới']);
    });

    it('một handler ném lỗi không chặn handler đứng sau', () => {
        const controller = makeController();
        const calls: string[] = [];
        const html = new Html({ ctx: controller, id: 'btn2', tagName: 'button', config: {
            events: { click: [() => { throw new Error('boom'); }, () => calls.push('sau')] },
        } });
        const onError = (event: ErrorEvent) => event.preventDefault();
        window.addEventListener('error', onError);
        try { html.element.click(); } catch { /* jsdom có thể ném thẳng */ }
        window.removeEventListener('error', onError);
        expect(calls).toEqual(['sau']);
    });

    it('bỏ qua hẳn khi nhận lại ĐÚNG object config compiler đã hoist', () => {
        const controller = makeController();
        const shared = { classes: [{ type: 'static' as const, value: 'cell' }] };
        const html = new Html({ ctx: controller, id: 'td', tagName: 'td', config: shared });
        html.element.classList.remove('cell');   // nếu updateConfig chạy lại, class sẽ quay về

        html.updateConfig(shared);

        expect(html.element.classList.contains('cell')).toBe(false);
    });

    it('element tạo ở client: class tĩnh ghi một lần, không kèm class hydrate', () => {
        const controller = makeController();
        const html = new Html({ ctx: controller, id: 'row', tagName: 'tr', config: {
            classes: [{ type: 'static', value: 'a' }, { type: 'static', value: 'b c' }],
        } });
        expect(html.element.getAttribute('class')).toBe('a b c');
    });

    it('công tắc kiểm thử Html.csrHydrateClass gắn lại class hydrate cho cổng parity', () => {
        Html.csrHydrateClass = true;
        try {
            const controller = makeController();
            const html = new Html({ ctx: controller, id: 'row', tagName: 'tr', config: { classes: [{ type: 'static', value: 'a' }] } });
            expect(html.element.getAttribute('class')).toBe(`${controller.viewId}-row a`);
        } finally { Html.csrHydrateClass = false; }
    });
});

describe('reconcileChildren', () => {
    const items = (n: number) => Array.from({ length: n }, (_, i) => {
        const node = document.createElement('li');
        node.textContent = String(i);
        return node;
    });

    it('đổi chỗ hai phần tử chỉ di chuyển hai node, không phải cả dãy ở giữa', () => {
        const parent = document.createElement('ul');
        document.body.appendChild(parent);
        const previous = items(50);
        reconcileChildren(parent, [], previous);

        const next = previous.slice();
        [next[1], next[48]] = [next[48], next[1]];
        const moved = vi.spyOn(parent, 'insertBefore');
        reconcileChildren(parent, previous, next);

        expect([...parent.children]).toEqual(next);
        expect(moved.mock.calls.length).toBeLessThanOrEqual(2);
    });

    it('dãy không đổi thì không đụng DOM', () => {
        const parent = document.createElement('ul');
        document.body.appendChild(parent);
        const children = items(10);
        reconcileChildren(parent, [], children);

        const observer = new MutationObserver(() => {});
        observer.observe(parent, { childList: true });
        reconcileChildren(parent, children, children.slice());
        expect(observer.takeRecords()).toHaveLength(0);
        observer.disconnect();
    });

    it('xoá, chèn và đảo ngược vẫn ra đúng thứ tự', () => {
        const parent = document.createElement('ul');
        document.body.appendChild(parent);
        const previous = items(8);
        reconcileChildren(parent, [], previous);

        const fresh = items(2);
        const next = [previous[7], fresh[0], previous[3], previous[2], fresh[1], previous[0]];
        reconcileChildren(parent, previous, next);
        expect([...parent.children]).toEqual(next);
    });
});
