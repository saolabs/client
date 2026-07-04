/**
 * Cross-contract test — Layout extends (compiler/examples/js/demo2-extends + demo2-layout).
 *
 * Kiểm tra pattern từ compiler:
 *   1. Layout view: blockOutlet(id, name, parentElement) — không có data arg
 *   2. Page view: block(id, name, factory) + this.superViewPath = ... + extendView(path, {})
 *   3. App.Helper.count() được gọi bởi compiled code (template @if + @foreach)
 *   4. Binding class: { type: 'binding', value: 'active', factory: () => status, stateKeys: ['status'] }
 *   5. Inline event handler: events: { click: [(event) => setStatus(!status)] }
 *
 * Tham chiếu: docs/COMPILER_CONTRACT.md §2, §4.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

// ─── Layout factory (pattern từ demo2-layout.js) ──────────────────────────

function makeLayoutFactory() {
    return () => {
        const view = new View('examples.demo2-layout', 'layout');
        const ctrl = view.__ctrl__;
        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData: function () {},
            updateVariableData: function () {},
            prerender: function () { return null; },
            render: function (this: any) {
                return this.wrapper((parentElement: any) => [
                    this.html('d69e6b1d', 'div', parentElement,
                        { classes: [{ type: 'static', value: 'container' }] },
                        (p: any) => [
                            // ── blockOutlet: compiler dùng 3 args (id, name, parent) ──
                            this.blockOutlet('d9c86768', 'content', p),
                        ]),
                ]);
            },
        } as any);
        return view;
    };
}

// ─── Page factory (pattern từ demo2-extends.js) ───────────────────────────

function makePageFactory(pathName = 'examples.demo2-extends') {
    return () => {
        const view = new View(pathName, 'view');
        const ctrl = view.__ctrl__;
        const __STATE__ = ctrl.states;

        const App = app() as any;

        const set$status = __STATE__.__.register('status');
        let status: any = null;
        const setStatus = (state: any) => { status = state; set$status(state); };
        __STATE__.__.setters.setStatus = setStatus;

        const set$user = __STATE__.__.register('user');
        let user: any = null;
        const setUser = (state: any) => { user = state; set$user(state); };
        __STATE__.__.setters.setUser = setUser;

        const set$posts = __STATE__.__.register('posts');
        let posts: any = null;
        const setPosts = (state: any) => { posts = state; set$posts(state); };
        __STATE__.__.setters.setPosts = setPosts;

        const lockUpdateRealState = () => __STATE__.__.lockUpdateRealState();
        const updateStateByKey = (k: string, v: any) => __STATE__.__.updateStateByKey(k, v);
        const update$status = (v: any) => {
            if (__STATE__.__.canUpdateStateByKey) { updateStateByKey('status', v); status = v; }
        };
        const update$user = (v: any) => {
            if (__STATE__.__.canUpdateStateByKey) { updateStateByKey('user', v); user = v; }
        };
        const update$posts = (v: any) => {
            if (__STATE__.__.canUpdateStateByKey) { updateStateByKey('posts', v); posts = v; }
        };

        ctrl.setup({
            superView: 'examples.demo2-layout',
            data: {},
            commitConstructorData: function () {
                update$status(false);
                update$user({ name: 'Jane', email: 'jane@test.com' });
                update$posts([
                    { title: 'Post 1', content: 'Content 1' },
                    { title: 'Post 2', content: 'Content 2' },
                ]);
                lockUpdateRealState();
            },
            updateVariableData: function () {},
            prerender: function () { return null; },
            render: function (this: any) {
                let parentReactive: any = null;
                // ── block(id, name, factory) — compiler pattern ───────────────
                this.block('block-content', 'content', (parentElement: any) => [
                    this.html('e085b222', 'div', parentElement,
                        {
                            classes: [
                                { type: 'static',  value: 'demo' },
                                // ── binding class — compiler pattern ─────────────────
                                { type: 'binding', value: 'active', factory: () => status, stateKeys: ['status'] },
                            ],
                        },
                        (p: any) => [
                            this.html('06fe9377', 'h1', p, {}, (p2: any) => [
                                this.text('Hello, '),
                                this.output('34dcf3fa', p2, true, ['user'], () => user?.name),
                                this.text('!'),
                            ]),
                            // ── inline event handler ─────────────────────────────
                            this.html('21f51b84', 'button', p, {
                                events: { click: [(event: Event) => setStatus(!status)] },
                            }, (p2: any) => [
                                this.text('Toggle: '),
                                this.output('a24990ac', p2, true, ['status'], () => status ? 'On' : 'Off'),
                            ]),
                            this.html('7ad81052', 'ul', p, {}, (p2: any) => [
                                // ── @if with App.Helper.count() ──────────────────────
                                this.reactive('40a9567d', 'if', parentReactive, p2, ['posts'],
                                    (pr: any, pe: any) => {
                                        const out: any[] = [];
                                        if (App.Helper.count(posts) === 0) {
                                            out.push(this.html('091f500d', 'li', pe, {},
                                                (p3: any) => [this.text('No posts.')]));
                                        } else {
                                            out.push(this.reactive('f47cbfd6', 'foreach', pr, pe,
                                                ['posts'], (pr2: any, pe2: any) => {
                                                    return this.__foreach(posts, (post: any, _k: string, idx: number) => [
                                                        this.html(`bce9cd15-${idx + 1}`, 'li', pe2, {},
                                                            (p3: any) => [
                                                                this.output(`b2ad0128-${idx + 1}`, p3, true, [], () => post.title),
                                                            ]),
                                                    ]);
                                                }));
                                        }
                                        return out;
                                    }),
                            ]),
                        ]),
                ]);
                // ── extendView(path, {}) — 2 args (compiler always passes {}) ─
                this.superViewPath = 'examples.demo2-layout';
                return this.extendView(this.superViewPath, {});
            },
        } as any);
        return view;
    };
}

// ─── Setup ─────────────────────────────────────────────────────────────────

function createManager() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({
        container,
        registry: {
            'examples.demo2-layout':  makeLayoutFactory(),
            'examples.demo2-extends': makePageFactory(),
        },
    });
    return { vm, container };
}

const route = (url: string) => ({ $urlPath: url } as any);
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Layout extends — cross-contract (compiler pattern)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
    });

    it('layout mount: container + block content trong outlet', async () => {
        const { container, vm } = createManager();
        await vm.mountView('examples.demo2-extends', {}, route('/demo'));

        // Layout: .container div
        expect(container.querySelector('.container')).not.toBeNull();
        // Block content: .demo div với user name
        const demo = container.querySelector('.demo');
        expect(demo).not.toBeNull();
        expect(demo?.querySelector('h1')?.textContent).toBe('Hello, Jane!');
    });

    it('App.Helper.count() dùng trong @if — posts > 0 → hiển thị list', async () => {
        const { container, vm } = createManager();
        await vm.mountView('examples.demo2-extends', {}, route('/demo'));

        // 2 posts → không có "No posts" text
        expect(container.textContent).not.toContain('No posts.');
        // 2 li items
        const items = container.querySelectorAll('ul li');
        expect(items.length).toBe(2);
        expect(items[0].textContent).toBe('Post 1');
        expect(items[1].textContent).toBe('Post 2');
    });

    it('binding class: status false → NO .active; true → có .active', async () => {
        const { container, vm } = createManager();
        await vm.mountView('examples.demo2-extends', {}, route('/demo'));

        const demo = container.querySelector('.demo')!;
        // Initial: status = false → không có .active
        expect(demo.classList.contains('active')).toBeFalsy();

        // Click toggle button → status = true
        const btn = container.querySelector('button')!;
        btn.click();
        await frame();
        expect(demo.classList.contains('active')).toBeTruthy();
        expect(container.querySelector('button')?.textContent).toContain('On');
    });

    it('inline event handler: click → setStatus(!status)', async () => {
        const { container, vm } = createManager();
        await vm.mountView('examples.demo2-extends', {}, route('/demo'));

        const btn = container.querySelector('button')!;
        // Toggle On
        btn.click();
        await frame();
        expect(container.querySelector('button')?.textContent).toContain('On');
        // Toggle Off
        btn.click();
        await frame();
        expect(container.querySelector('button')?.textContent).toContain('Off');
    });

    it('extendView(path, {}) — 2 args accepted without error', async () => {
        // Kiểm tra ViewController.extendView nhận 2 arg (compiler luôn truyền {})
        const { vm } = createManager();
        // Nếu extendView throw lỗi, test này sẽ fail
        await vm.mountView('examples.demo2-extends', {}, route('/demo'));
        expect(vm.getCurrentView()).not.toBeNull();
        expect(vm.getCurrentLayout()).not.toBeNull();
    });
});
