/**
 * Nested route — `children` trong RouteDefinition.
 *
 * Đây là tầng CẤU HÌNH: path con nối vào path cha, meta kế thừa, rồi flatten
 * thành đúng bảng phẳng mà `matchRoute()` vẫn dùng. Việc GIỮ NGUYÊN view cha
 * khi chuyển giữa các con là do chuỗi layout lo (`@extends` + `@useBlock` +
 * `ViewManager.currentLayoutChain`) — test cuối kiểm chính điều đó end-to-end.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Router } from '../../src/core/routers/Router';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

const paths = (r: Router) => (r as any).routes.map((x: any) => x.path);
const metaOf = (r: Router, p: string) =>
    (r as any).routes.find((x: any) => x.path === p)?.options;
const compOf = (r: Router, p: string) =>
    (r as any).routes.find((x: any) => x.path === p)?.component;

function bare(routes: any[]): Router {
    const router = new Router(app() as any);
    router.configure({ mode: 'history', routes });
    return router;
}

afterEach(() => {
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
});

describe('nested route — flatten', () => {
    it('nối path con vào cha, giữ thứ tự khai báo', () => {
        const r = bare([{
            path: '/users', component: 'web.users',
            children: [
                { path: 'profile', component: 'web.users.profile' },
                { path: '{id}', component: 'web.users.detail' },
            ],
        }]);
        // thứ tự = độ ưu tiên: 'profile' phải đứng TRƯỚC '{id}'
        expect(paths(r)).toEqual(['/users', '/users/profile', '/users/{id}']);
    });

    it("index child ('') thay route riêng của cha cho cùng URL", () => {
        const r = bare([{
            path: '/users', component: 'web.users.shell',
            children: [
                { path: '', component: 'web.users.index' },
                { path: 'new', component: 'web.users.new' },
            ],
        }]);
        expect(paths(r)).toEqual(['/users', '/users/new']);
        expect(compOf(r, '/users')).toBe('web.users.index');   // con thắng
    });

    it('cha không có component = nhóm thuần tuý, không sinh route riêng', () => {
        const r = bare([{
            path: '/admin',
            meta: { auth: true },
            children: [{ path: 'stats', component: 'admin.stats' }],
        }]);
        expect(paths(r)).toEqual(['/admin/stats']);
    });

    it('meta kế thừa từ cha, con ghi đè khi trùng key', () => {
        const r = bare([{
            path: '/admin', meta: { auth: true, layout: 'admin' },
            children: [
                { path: 'stats', component: 'a.stats' },
                { path: 'public', component: 'a.public', meta: { auth: false } },
            ],
        }]);
        expect(metaOf(r, '/admin/stats')).toMatchObject({ auth: true, layout: 'admin' });
        expect(metaOf(r, '/admin/public')).toMatchObject({ auth: false, layout: 'admin' });
    });

    it('lồng nhiều tầng', () => {
        const r = bare([{
            path: '/a', children: [
                { path: 'b', children: [{ path: 'c', component: 'x.c' }] },
            ],
        }]);
        expect(paths(r)).toEqual(['/a/b/c']);
    });

    it('con bắt đầu bằng "/" là tuyệt đối, thoát khỏi prefix cha', () => {
        const r = bare([{
            path: '/users', children: [{ path: '/login', component: 'auth.login' }],
        }]);
        expect(paths(r)).toEqual(['/login']);
    });

    it('không có children → hành vi cũ nguyên vẹn', () => {
        const r = bare([
            { path: '/', component: 'web.home' },
            { path: '/about', component: 'web.about' },
        ]);
        expect(paths(r)).toEqual(['/', '/about']);
    });

    it('không sinh dấu / thừa', () => {
        const r = bare([{ path: '/users/', children: [{ path: 'x', component: 'c' }] }]);
        expect(paths(r)).toEqual(['/users/x']);
    });
});

// ─── End-to-end: cha có được giữ nguyên khi chuyển giữa các con? ────────────

let shellRenders = 0;

function shellFactory() {
    return () => {
        const v = new View('web.shell', 'layout');
        v.__ctrl__.setup({
            superView: null, data: {},
            commitConstructorData() {}, updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                shellRenders++;
                return this.wrapper((p: any) => [
                    this.html('shell', 'div', p, { attrs: { id: { type: 'static', value: 'shell' } } },
                        (p2: any) => [this.blockOutlet('ob-content', 'content', p2)]),
                ]);
            },
        } as any);
        return v;
    };
}

function pageFactory(path: string, label: string) {
    return () => {
        const v = new View(path, 'view');
        v.__ctrl__.setup({
            superView: 'web.shell', data: {},
            commitConstructorData() {}, updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                this.block('b-content', 'content', (p: any) => [
                    this.html(`pg-${label}`, 'span', p,
                        { attrs: { id: { type: 'static', value: `page-${label}` } } },
                        () => [this.text(label)]),
                ]);
                return this.extendView('web.shell');
            },
        } as any);
        return v;
    };
}

const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

describe('nested route — end-to-end', () => {
    it('chuyển giữa 2 route con: layout cha KHÔNG render lại, DOM node giữ nguyên', async () => {
        shellRenders = 0;
        const container = document.createElement('div');
        document.body.appendChild(container);

        const vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({ container, registry: {
            'web.shell': shellFactory(),
            'web.users.profile': pageFactory('web.users.profile', 'profile'),
            'web.users.settings': pageFactory('web.users.settings', 'settings'),
        }});

        const router = new Router(app() as any);
        router.setViewManager(vm);
        router.configure({ mode: 'history', routes: [{
            path: '/users', meta: { auth: true },
            children: [
                { path: 'profile', component: 'web.users.profile' },
                { path: 'settings', component: 'web.users.settings' },
            ],
        }]});
        (app() as any).set('Router', router);

        await router.navigate('/users/profile');
        await frame();
        const shellNode = container.querySelector('#shell');
        expect(container.querySelector('#page-profile')).not.toBeNull();
        expect(shellRenders).toBe(1);

        await router.navigate('/users/settings');
        await frame();
        expect(container.querySelector('#page-settings')).not.toBeNull();
        expect(container.querySelector('#page-profile')).toBeNull();
        // cha giữ nguyên: không render thêm lần nào, vẫn đúng DOM node cũ
        expect(shellRenders).toBe(1);
        expect(container.querySelector('#shell')).toBe(shellNode);

        router.destroy();
    });
});
