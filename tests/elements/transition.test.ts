/**
 * `@transition('fade')` — enter/leave class + hoãn gỡ node tới khi animation xong.
 *
 * jsdom KHÔNG có `getAnimations()`, nên mặc định mọi transition kết thúc ngay —
 * đó chính là đường "không khai báo CSS → hành vi y như cũ". Muốn kiểm phần
 * hoãn thì phải stub `getAnimations` để giữ animation ở trạng thái chưa xong.
 *
 * @see src/core/helpers/transition.ts
 */
import { describe, it, expect, afterEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import { Html } from '../../src/core/elements/Html';
import { InitModes } from '../../src/core/contracts/common';
import { isLeaving } from '../../src/core/helpers/transition';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Giữ animation ở trạng thái CHƯA xong; gọi hàm trả về để kết thúc. */
function pendingAnimation(el: Element): () => void {
    let done!: () => void;
    const finished = new Promise<void>(r => { done = r; });
    (el as any).getAnimations = () => [{ finished }];
    return () => { (el as any).getAnimations = () => []; done(); };
}

function makeEl(config: any, initMode: any = InitModes.CREATE) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const ctrl = new View('t.v', 'view').__ctrl__;
    const parent = new Html({ ctx: ctrl as any, element: host, childrenFactory: () => [] });
    const el = new Html({
        ctx: ctrl as any, tagName: 'div', parentElement: parent, config, initMode,
        childrenFactory: (p: any) => [ctrl.text('nội dung')],
    });
    host.appendChild(el.element);
    return { el, host };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('@transition — enter', () => {
    it('áp class theo đúng trình tự from → to → sạch', async () => {
        const { el } = makeEl({ transition: { name: 'fade' } });
        const done = pendingAnimation(el.element);

        el.render();
        expect(el.element.classList.contains('fade-enter-from')).toBe(true);
        expect(el.element.classList.contains('fade-enter-active')).toBe(true);

        await frame();
        expect(el.element.classList.contains('fade-enter-from')).toBe(false);
        expect(el.element.classList.contains('fade-enter-to')).toBe(true);
        expect(el.element.classList.contains('fade-enter-active')).toBe(true);

        done();
        await frame();
        expect(el.element.className).not.toContain('fade-enter');
    });

    it('chỉ chạy MỘT lần, re-render không lặp lại', async () => {
        const { el } = makeEl({ transition: { name: 'fade' } });
        el.render();
        await frame();
        el.render();
        expect(el.element.classList.contains('fade-enter-from')).toBe(false);
    });

    it('HYDRATE không chạy enter — DOM là của server', async () => {
        const { el } = makeEl({ transition: { name: 'fade' } }, InitModes.HYDRATE);
        el.render();
        expect(el.element.className).not.toContain('fade-enter');
    });

    it('không có @transition → không đụng class', async () => {
        const { el } = makeEl({});
        el.render();
        await frame();
        expect(el.element.className).toBe('');
    });
});

describe('@transition — leave', () => {
    it('node NẰM LẠI DOM tới khi animation xong rồi mới bị gỡ', async () => {
        const { el, host } = makeEl({ transition: { name: 'fade' } });
        el.render();
        await frame();
        const node = el.element;
        const done = pendingAnimation(node);

        el.destroy();
        expect(node.isConnected).toBe(true);
        expect(node.classList.contains('fade-leave-from')).toBe(true);
        expect(isLeaving(node)).toBe(true);

        await frame();
        expect(node.isConnected).toBe(true);
        expect(node.classList.contains('fade-leave-to')).toBe(true);

        done();
        await frame();
        expect(node.isConnected).toBe(false);
        expect(host.contains(node)).toBe(false);
        expect(isLeaving(node)).toBe(false);
    });

    it('nội dung KHÔNG bị xoá trắng trong lúc leave', async () => {
        const { el } = makeEl({ transition: { name: 'fade' } });
        el.render();
        await frame();
        const node = el.element;
        expect(node.textContent).toContain('nội dung');

        const done = pendingAnimation(node);
        el.destroy();
        await frame();
        // teardown cây con bị hoãn — element bay ra vẫn còn nội dung
        expect(node.textContent).toContain('nội dung');

        done();
        await frame();
        expect(node.isConnected).toBe(false);
    });

    it('không có CSS animation → gỡ sau đúng 1 nhịp, không treo', async () => {
        const { el } = makeEl({ transition: { name: 'fade' } });
        el.render();
        await frame();
        const node = el.element;

        // getAnimations vắng mặt (jsdom) → whenAnimationsDone resolve ngay,
        // nhưng runLeave vẫn nhường 1 nhịp `nextFrame` để trình duyệt kịp áp
        // class `-from`. Khai báo @transition mà quên viết CSS thì node biến
        // mất sau ~1 frame chứ KHÔNG kẹt lại.
        el.destroy();
        await frame();
        await frame();
        expect(node.isConnected).toBe(false);
    });

    it('không có @transition → gỡ ĐỒNG BỘ, không đợi frame', () => {
        const { el } = makeEl({});
        el.render();
        const node = el.element;
        el.destroy();
        expect(node.isConnected).toBe(false);
        expect(isLeaving(node)).toBe(false);
    });
});

describe('@transition trong vùng Reactive', () => {
    it('item rời @foreach không bị vòng quét của Reactive giật mất', async () => {
        // Dựng đúng shape compiled: reactive foreach + Html có transition.
        const view = new View('t.list', 'view');
        const ctrl = view.__ctrl__;
        const S = ctrl.states;
        const set = S.__.register('items', []);
        let items: any[] = [];
        const setItems = (v: any[]) => { items = v; set(v); };

        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = new Html({ ctx: ctrl as any, element: host, childrenFactory: () => [] });

        const region = ctrl.reactive('fe', 'foreach', null, root as any, ['items'],
            (_pr: any, pe: any) => ctrl.__foreach(items, (it: any) => [
                ctrl.html(`li-${it.id}`, 'li', pe, { transition: { name: 'fade' } },
                    () => [ctrl.text(String(it.id))]),
            ], (it: any) => it.id));
        region.render();
        region.start();

        setItems([{ id: 1 }, { id: 2 }]);
        S.__.flushNow();
        await frame();
        expect(host.querySelectorAll('li').length).toBe(2);

        const doomed = host.querySelector('li')!;      // item id=1
        const done = pendingAnimation(doomed);

        setItems([{ id: 2 }]);                          // id=1 rời list
        S.__.flushNow();
        await frame();

        // clearContent/_cleanOrphanNodes KHÔNG được gỡ node đang leave
        expect(doomed.isConnected).toBe(true);
        expect(isLeaving(doomed)).toBe(true);
        expect(doomed.classList.contains('fade-leave-active')).toBe(true);

        done();
        await frame();
        expect(doomed.isConnected).toBe(false);
        expect(host.querySelectorAll('li').length).toBe(1);
    });
});
