/**
 * Regression — refresh list từ server: cùng cache key (`@key(item.id)`) nhưng
 * object ref MỚI (JSON parse). `ForeachSlotCache.store()` từng ghi đè slot cũ
 * tại `slots[occ]` khiến nó rơi khỏi `_map` trước khi `prunePass()` kịp thấy →
 * elements cũ không bao giờ destroy. Hệ quả đo được:
 *   - view con của @include bị tái dùng trong DOM đã detach → biến mất khỏi trang
 *   - `ctrl.elements` phình vô hạn (32 → 182 sau 6 trang, DOM vẫn 10 item)
 *
 * @see ForeachSlotCache.store / prunePass
 * @see ViewController.releaseElement
 */
import { describe, it, expect, afterEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';
import { ForeachSlotCache } from '../../src/core/elements/ForeachSlotCache';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

type User = { id: number; name: string; roles: { name: string }[] };

/** View con của @include — render {{ user.name }}. */
function makeCardFactory() {
    return (__data__: any = {}) => {
        const view = new View('user.card', 'view');
        const ctrl = view.__ctrl__;
        const S = ctrl.states;
        let user: any = __data__.user ?? {};
        const TRAIT: any = { user: (v: any) => { user = v; S.__.updateStateByKey('user', v); } };
        S.__.register('user', user);
        ctrl.setup({
            superView: null,
            data: __data__,
            commitConstructorData() { S.__.updateStateByKey('user', user); S.__.lockUpdateRealState(); },
            updateVariableData(this: any, data: any) {
                for (const k in data) this.config.updateVariableItemData.call(this, k, data[k]);
            },
            updateVariableItemData(this: any, k: string, v: any) { this.data[k] = v; TRAIT[k]?.(v); },
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((parent: any) => [
                    this.html('card', 'b', parent, {}, (p: any) => [
                        this.output('card-name', p, true, ['user'], () => String(user?.name ?? '')),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

/**
 * Tương đương compiled output của:
 *   @foreach($users as $user) @key($user['id'])
 *     <li>@include('user.card', ['user' => $user])
 *         @foreach($user['roles'] as $role)<span>{{ $role.name }}</span>@endforeach</li>
 *   @endforeach
 *
 * `nestedInline` = @foreach lồng nằm TRỰC TIẾP trong loop body (không bọc thẻ) →
 * chạy ngay trong cửa sổ cache của loop ngoài.
 */
function makeFactory(nestedInline = false) {
    return () => {
        const view = new View('probe.list', 'view');
        const ctrl = view.__ctrl__;
        const S = ctrl.states;
        const set$users = S.__.register('users');
        let users: User[] = [];
        S.__.setters.setUsers = (v: User[]) => { users = v; set$users(v); };

        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() { S.__.updateStateByKey('users', []); S.__.lockUpdateRealState(); },
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((parent: any) => [
                    this.html('ul-root', 'ul', parent, { attrs: { id: { type: 'static', value: 'list' } } }, (p: any) => [
                        this.reactive('fe-users', 'foreach', null, p, ['users'], (_pr: any, pe: any) =>
                            this.__foreach(users, (user: User) => nestedInline
                                ? [
                                    ...this.__foreach(user.roles, (role: any, _k: any, i: number) => [
                                        this.html(`sp-${user.id}-${i + 1}`, 'span', pe, {}, () => [this.text(role.name)]),
                                    ]),
                                ]
                                : [
                                    this.html(`li-${user.id}`, 'li', pe, {
                                        attrs: { 'data-id': { type: 'static', value: String(user.id) } },
                                    }, (p2: any) => [
                                        // compiler emit stateKeys=[] cho include trong loop
                                        this.include(`inc-${user.id}`, 'user.card', p2, [], () => ({ user })),
                                        // @if trong loop → reactive id kèm item (`{viewId}-if-${user.id}`)
                                        this.reactive(`if-${user.id}`, 'if', null, p2, ['users'], (_r: any, e: any) =>
                                            user.roles.length ? [this.html(`badge-${user.id}`, 'i', e, {}, () => [this.text('*')])] : []
                                        ),
                                        ...this.__foreach(user.roles, (role: any, _k: any, i: number) => [
                                            this.html(`sp-${user.id}-${i + 1}`, 'span', p2, {}, () => [this.text(role.name)]),
                                        ]),
                                    ]),
                                ]
                            , (u: User) => u.id)
                        ),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

let container: HTMLElement;
let vm: ViewManager;
function createManager(nestedInline = false) {
    container = document.createElement('div');
    document.body.appendChild(container);
    vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({ container, registry: { 'probe.list': makeFactory(nestedInline), 'user.card': makeCardFactory() } });
}
const route = (url: string) => ({ $urlPath: url } as any);
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const html = () => container.querySelector('#list')!.innerHTML.replace(/<!--.*?-->/g, '');

afterEach(() => {
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
});

describe('@foreach — refresh list từ server', () => {
    it('store() ghi đè slot cùng key: slot cũ phải được prunePass destroy', () => {
        const c = new ForeachSlotCache();
        const oldEls = ['OLD'];

        c.beginPass();
        const a = c.claim(1, { id: 1 });
        c.store(1, a.occ, { id: 1 }, oldEls);
        const p1: any[] = [];
        c.prunePass(s => p1.push(s.elements));
        expect(p1).toEqual([]);

        // pass 2 — cùng key, ref MỚI (refresh từ server)
        c.beginPass();
        const b = c.claim(1, { id: 1 });
        expect(b.slot).toBe(null); // ref đổi → miss
        c.store(1, b.occ, { id: 1 }, ['NEW']);
        const p2: any[] = [];
        c.prunePass(s => p2.push(s.elements));

        expect(p2).toEqual([oldEls]);
    });

    it('view con của @include phải cập nhật, không biến mất', async () => {
        createManager();
        await vm.mountView('probe.list', {}, route('/'));
        const ctrl: any = vm.getCurrentView()!.__ctrl__;
        const server = (n: string) => JSON.parse(JSON.stringify([
            { id: 1, name: n, roles: [{ name: 'admin' }] },
            { id: 2, name: 'Bob', roles: [{ name: 'user' }] },
        ])) as User[];

        ctrl.states.__.setters.setUsers(server('Alice'));
        await frame();
        expect(html()).toContain('Alice');

        ctrl.states.__.setters.setUsers(server('Alice EDITED'));
        await frame();
        expect(html()).toContain('Alice EDITED');
        expect(html()).not.toContain('>Alice<');
        expect(container.querySelectorAll('#list li').length).toBe(2);
    });

    it('@foreach lồng inline: item ngoài ref-stable không bị mất nội dung loop trong', async () => {
        createManager(true);
        await vm.mountView('probe.list', {}, route('/'));
        const ctrl = vm.getCurrentView()!.__ctrl__;

        const u1: User = { id: 1, name: 'Alice', roles: [{ name: 'admin' }, { name: 'dev' }] };
        const u2: User = { id: 2, name: 'Bob', roles: [{ name: 'user' }] };
        ctrl.states.__.setters.setUsers([u1, u2]);
        await frame();

        // sửa u1 kiểu immutable — u2 giữ nguyên ref → cache HIT
        ctrl.states.__.setters.setUsers([{ ...u1, name: 'Alice edited' }, u2]);
        await frame();

        expect(html()).toContain('user'); // role của u2 không được biến mất
        expect(html()).toContain('admin');
    });

    it('phân trang: registry co lại theo DOM, không tích luỹ corpse', async () => {
        createManager();
        await vm.mountView('probe.list', {}, route('/'));
        const ctrl: any = vm.getCurrentView()!.__ctrl__;
        const page = (p: number) => Array.from({ length: 10 }, (_, i) => ({
            id: p * 10 + i, name: `U${p * 10 + i}`, roles: [{ name: 'r' }],
        })) as User[];

        ctrl.states.__.setters.setUsers(page(0));
        await frame();
        const afterFirstPage = ctrl.elements.size;
        const markersFirstPage = MarkerRegistry.size;

        for (let p = 1; p <= 5; p++) {
            ctrl.states.__.setters.setUsers(page(p));
            await frame();
        }

        expect(container.querySelectorAll('#list li').length).toBe(10);
        expect(ctrl.elements.size).toBe(afterFirstPage); // hằng số, không phải 6×
        // MarkerRegistry là singleton toàn cục — Reactive per-item phải tự gỡ record
        expect(MarkerRegistry.size).toBe(markersFirstPage);
    });
});
