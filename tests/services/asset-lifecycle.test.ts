/**
 * Vòng đời `<link>`/`<script src>` của view qua điều hướng SPA.
 *
 * Vì sao quan trọng: hai trang khác nhau có thể dùng CÙNG selector với CSS khác
 * nhau (`.card`, `.rs-page`…). Rời trang mà stylesheet còn nằm lại trong <head>
 * thì trang mới bị style của trang cũ đè — sai hiển thị chứ không nổ, nên rất
 * khó thấy. Bộ này khoá đúng bốn mốc: mount / pause (PageCache) / resume /
 * destroy, cộng ref-count khi hai view dùng chung một file.
 *
 * SSR: server in sẵn `<link>` (qua `@addCssLink`); AssetManager ADOPT node đó
 * thay vì chèn bản thứ hai, và vì đã nhận quyền sở hữu nên cũng phải gỡ được
 * nó khi view rời DOM — test cuối kiểm đúng đường đó.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mountView, Harness } from '../helpers/harness';

const HREF_A = '/test/page-a.css';
const HREF_B = '/test/page-b.css';

const links = (href?: string) => [...document.head.querySelectorAll('link[rel~="stylesheet"]')]
    .filter(l => !href || l.getAttribute('href') === href);

function page(path: string, href: string): Harness {
    return mountView(function (this: any) {
        return this.wrapper((p: any) => [this.html('root', 'div', p, {}, () => [this.text(path)])]);
    }, { path, styles: [{ type: 'href', href }] } as any);
}

let harnesses: Harness[] = [];
afterEach(() => {
    harnesses.forEach(h => { try { h.destroy(); } catch { /* đã destroy */ } });
    harnesses = [];
    document.head.querySelectorAll('link[rel~="stylesheet"]').forEach(l => l.remove());
});

describe('Asset của view qua vòng đời', () => {
    it('mount chèn <link>, destroy gỡ đi', () => {
        const a = page('web.a', HREF_A);
        harnesses.push(a);
        expect(links(HREF_A).length).toBe(1);

        a.ctrl.destroy();
        expect(links(HREF_A).length).toBe(0);
    });

    it('rời trang A sang B: CSS của A KHÔNG nằm lại', () => {
        const a = page('web.a', HREF_A);
        harnesses.push(a);
        a.ctrl.destroy();

        const b = page('web.b', HREF_B);
        harnesses.push(b);

        expect(links(HREF_A).length).toBe(0);
        expect(links(HREF_B).length).toBe(1);
    });

    it('pause (vào PageCache) gỡ CSS, resume trả lại đúng một thẻ', () => {
        const a = page('web.a', HREF_A);
        harnesses.push(a);

        a.ctrl.pause();
        expect(links(HREF_A).length).toBe(0);

        a.ctrl.resume();
        expect(links(HREF_A).length).toBe(1);

        a.ctrl.mount();   // acquire lần hai (remount) — không được nhân đôi thẻ
        expect(links(HREF_A).length).toBe(1);
    });

    it('hai view dùng chung một file: chỉ gỡ khi view CUỐI rời đi', () => {
        // Layout + page cùng khai báo một stylesheet là chuyện thường.
        const layout = page('web.layout', HREF_A);
        const child = page('web.child', HREF_A);
        harnesses.push(layout, child);
        expect(links(HREF_A).length).toBe(1);

        child.ctrl.destroy();
        expect(links(HREF_A).length).toBe(1);   // layout còn giữ

        layout.ctrl.destroy();
        expect(links(HREF_A).length).toBe(0);
    });

    it('link do SSR in sẵn: adopt chứ không chèn thêm, và vẫn gỡ được', () => {
        const ssr = document.createElement('link');
        ssr.setAttribute('rel', 'stylesheet');
        ssr.setAttribute('href', HREF_A);
        document.head.appendChild(ssr);

        const a = page('web.a', HREF_A);
        harnesses.push(a);
        expect(links(HREF_A).length).toBe(1);
        expect(links(HREF_A)[0]).toBe(ssr);          // đúng node server, không phải bản mới

        a.ctrl.destroy();
        expect(links(HREF_A).length).toBe(0);        // node SSR cũng phải đi
    });

    it('<script src> thì GIỮ lại sau khi rời trang', () => {
        // Gỡ thẻ script không hoàn tác side effect của nó, mà chèn lại sẽ chạy
        // lần hai (nạp lại Prism là xoá sạch grammar đã đăng ký).
        const s = mountView(function (this: any) {
            return this.wrapper((p: any) => [this.html('root', 'div', p, {}, () => [this.text('s')])]);
        }, { path: 'web.s', scripts: [{ type: 'src', src: '/test/lib.js' }] } as any);
        harnesses.push(s);

        const count = () => document.head.querySelectorAll('script[src="/test/lib.js"]').length;
        expect(count()).toBe(1);

        s.ctrl.destroy();
        expect(count()).toBe(1);

        document.head.querySelectorAll('script[src="/test/lib.js"]').forEach(n => n.remove());
    });
});
