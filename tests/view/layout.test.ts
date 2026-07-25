/**
 * Integration tests Phase 3b: @extends layout — mount, same-layout swap, đổi layout.
 * Thiết kế: ROUTE_RENDER_FLOW.md §4, §5.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) {
    app.instance('Registry', MarkerRegistry);
}

const mountedLog: string[] = [];
const renderLog: string[] = [];

function makeLayoutFactory(pathName = 'layouts.app', headerText = 'HEADER', extraConfig: Record<string, any> = {}) {
    return () => {
        const view = new View(pathName, 'layout');
        const ctrl = view.__ctrl__;
        (view as any).onMounted = () => mountedLog.push(`layout:${pathName}`);
        ctrl.setup({
            superView: null,
            data: {},
            ...extraConfig,
            render: function (this: any) {
                renderLog.push(pathName);
                return this.wrapper((parent: any) => [
                    this.html('l-header', 'header', parent, {}, (p: any) => [this.text(headerText)]),
                    this.html('l-main', 'main', parent, {}, (p: any) => [
                        this.blockOutlet('ob-content', 'content', p),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

function makeExtendsPageFactory(pathName: string, msg: string, layoutPath = 'layouts.app') {
    return () => {
        const view = new View(pathName, 'view');
        const ctrl = view.__ctrl__;
        const manager: any = ctrl.states.__;
        manager.useState(msg, 'msg');
        (view as any).onMounted = () => mountedLog.push(`page:${pathName}`);
        ctrl.setup({
            superView: layoutPath,
            data: {},
            render: function (this: any) {
                this.block('b-content', 'content', (parentElement: any) => [
                    this.html('pg-section', 'section', parentElement, {}, (p: any) => [
                        this.output('o-msg', p, true, ['msg'], () => manager.states['msg'].value),
                    ]),
                ]);
                return this.extendView(layoutPath);
            },
        } as any);
        return view;
    };
}

function makeStandaloneFactory(pathName: string, text: string) {
    return () => {
        const view = new View(pathName, 'view');
        const ctrl = view.__ctrl__;
        ctrl.setup({
            superView: null,
            data: {},
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('alone', 'article', parent, {}, (p: any) => [this.text(text)]),
                ]);
            },
        } as any);
        return view;
    };
}

function makeBaseLayoutFactory(pathName = 'layouts.base', outletName = 'shell') {
    return () => {
        const view = new View(pathName, 'layout');
        (view as any).onMounted = () => mountedLog.push(`layout:${pathName}`);
        view.__ctrl__.setup({
            superView: null,
            data: {},
            render: function (this: any) {
                renderLog.push(pathName);
                return this.wrapper((parent: any) => [
                    this.html('base-root', 'div', parent, { attrs: { class: { type: 'static', value: 'base-layout' } } }, (p: any) => [
                        this.html('base-header', 'header', p, {}, () => [this.text('BASE')]),
                        this.blockOutlet(`ob-${outletName}`, outletName, p),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

function makeNestedLayoutFactory(
    pathName: string,
    label: string,
    basePath = 'layouts.base',
    parentBlock = 'shell',
    childOutlet = 'content',
) {
    return () => {
        const view = new View(pathName, 'layout');
        (view as any).onMounted = () => mountedLog.push(`layout:${pathName}`);
        view.__ctrl__.setup({
            superView: basePath,
            data: {},
            render: function (this: any) {
                renderLog.push(pathName);
                this.block(`b-${parentBlock}`, parentBlock, (parentElement: any) => [
                    this.html('nested-root', 'div', parentElement, { attrs: { class: { type: 'static', value: `nested-${label}` } } }, (p: any) => [
                        this.html('nested-aside', 'aside', p, {}, () => [this.text(label)]),
                        this.blockOutlet(`ob-${childOutlet}`, childOutlet, p),
                    ]),
                ]);
                return this.extendView(basePath);
            },
        } as any);
        return view;
    };
}

function createManager() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm); // extendView resolve qua App.View
    vm.init({
        container,
        registry: {
            'layouts.app': makeLayoutFactory(),
            'layouts.admin': makeLayoutFactory('layouts.admin', 'ADMIN-BAR'),
            'layouts.nocache': makeLayoutFactory('layouts.nocache', 'NOCACHE-BAR', { cache: false }),
            'layouts.base': makeBaseLayoutFactory(),
            'layouts.nested-app': makeNestedLayoutFactory('layouts.nested-app', 'APP-SHELL'),
            'layouts.nested-admin': makeNestedLayoutFactory('layouts.nested-admin', 'ADMIN-SHELL'),
            'layouts.dup-base': makeBaseLayoutFactory('layouts.dup-base', 'content'),
            'layouts.dup-inner': makeNestedLayoutFactory(
                'layouts.dup-inner', 'DUP-SHELL', 'layouts.dup-base', 'content', 'content',
            ),
            'web.p1': makeExtendsPageFactory('web.p1', 'PAGE-ONE'),
            'web.p2': makeExtendsPageFactory('web.p2', 'PAGE-TWO'),
            'web.padmin': makeExtendsPageFactory('web.padmin', 'PAGE-ADMIN', 'layouts.admin'),
            'web.pnc': makeExtendsPageFactory('web.pnc', 'PAGE-NC', 'layouts.nocache'),
            'web.alone': makeStandaloneFactory('web.alone', 'ALONE'),
            'web.n1': makeExtendsPageFactory('web.n1', 'NESTED-ONE', 'layouts.nested-app'),
            'web.n2': makeExtendsPageFactory('web.n2', 'NESTED-TWO', 'layouts.nested-app'),
            'web.nadmin': makeExtendsPageFactory('web.nadmin', 'NESTED-ADMIN', 'layouts.nested-admin'),
            'web.dup1': makeExtendsPageFactory('web.dup1', 'DUP-ONE', 'layouts.dup-inner'),
            'web.dup2': makeExtendsPageFactory('web.dup2', 'DUP-TWO', 'layouts.dup-inner'),
        },
    });
    return { vm, container };
}

const route = (url: string) => ({ $urlPath: url } as any);

function frame(): Promise<void> {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

describe('mountView — @extends layout', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        BlockManager.destroy(); // BlockManager là global singleton — reset giữa các test
        StoreService.instance('ViewManager').clear(); // store layout cache cũng là singleton
        mountedLog.length = 0;
        renderLog.length = 0;
    });

    it('mount page extends: layout structure + block content trong outlet', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));

        expect(container.querySelector('header')?.textContent).toBe('HEADER');
        // Block content nằm TRONG <main> (giữa outlet markers)
        expect(container.querySelector('main section')?.textContent).toBe('PAGE-ONE');
        // onMounted: layout trước, page sau
        expect(mountedLog).toEqual(['layout:layouts.app', 'page:web.p1']);
    });

    it('standalone: chain chỉ có Page, không có Layout', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.alone', {}, route('/alone'));

        expect(vm.getCurrentLayout()).toBeNull();
        expect(vm.getViewStack().map(v => v.__ctrl__.path)).toEqual(['web.alone']);
        expect(vm.getCurrentView()?.__ctrl__.lifecycleState).toBe('active');
        expect(container.querySelector('article')?.textContent).toBe('ALONE');
    });

    it('nested extends: Page → Layout con → Layout gốc đều mount/start đúng thứ tự', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.n1', {}, route('/n1'));

        expect(container.querySelector('.base-layout header')?.textContent).toBe('BASE');
        expect(container.querySelector('.nested-APP-SHELL aside')?.textContent).toBe('APP-SHELL');
        expect(container.querySelector('.nested-APP-SHELL section')?.textContent).toBe('NESTED-ONE');
        expect(vm.getViewStack().map(v => v.__ctrl__.path)).toEqual([
            'layouts.base', 'layouts.nested-app', 'web.n1',
        ]);
        expect(vm.getViewStack().map(v => v.__ctrl__.lifecycleState)).toEqual([
            'active', 'active', 'active',
        ]);
        expect(mountedLog).toEqual([
            'layout:layouts.base', 'layout:layouts.nested-app', 'page:web.n1',
        ]);
    });

    it('nested same chain: giữ nguyên cả Layout gốc + Layout con, chỉ swap Page', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.n1', {}, route('/n1'));
        const [base, nested] = vm.getViewStack();
        const baseNode = container.querySelector('.base-layout');
        const nestedNode = container.querySelector('.nested-APP-SHELL');
        mountedLog.length = 0;
        renderLog.length = 0;

        await vm.mountView('web.n2', {}, route('/n2'));

        expect(container.querySelector('.base-layout')).toBe(baseNode);
        expect(container.querySelector('.nested-APP-SHELL')).toBe(nestedNode);
        expect(vm.getViewStack()[0]).toBe(base);
        expect(vm.getViewStack()[1]).toBe(nested);
        expect(base.__ctrl__.lifecycleState).toBe('active');
        expect(nested.__ctrl__.lifecycleState).toBe('active');
        expect(container.querySelector('.nested-APP-SHELL section')?.textContent).toBe('NESTED-TWO');
        expect(mountedLog).toEqual(['page:web.n2']);
        expect(renderLog).toEqual([]);
    });

    it('nested bfcache: qua standalone rồi pop về giữ chain instance, DOM và state', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.n1', {}, route('/n1'));
        const [base, nested, page] = vm.getViewStack();
        const baseNode = container.querySelector('.base-layout');
        const nestedNode = container.querySelector('.nested-APP-SHELL');
        (page.__ctrl__.states.__ as any).updateStateByKey('msg', 'NESTED-EDITED');
        await frame();

        await vm.mountView('web.alone', {}, route('/alone'));
        expect(base.__ctrl__.lifecycleState).toBe('paused');
        expect(nested.__ctrl__.lifecycleState).toBe('paused');
        expect(vm.pageCache.has('__layout__::layouts.base>layouts.nested-app')).toBe(true);
        mountedLog.length = 0;

        await vm.mountView('web.n1', {}, route('/n1'), 'pop');

        expect(vm.getViewStack()).toEqual([base, nested, page]);
        expect(container.querySelector('.base-layout')).toBe(baseNode);
        expect(container.querySelector('.nested-APP-SHELL')).toBe(nestedNode);
        expect(container.querySelector('.nested-APP-SHELL section')?.textContent).toBe('NESTED-EDITED');
        expect(vm.getViewStack().map(v => v.__ctrl__.lifecycleState)).toEqual([
            'active', 'active', 'active',
        ]);
        expect(mountedLog).toEqual([]);
    });

    it('nested shared root: reuse Layout gốc, thay Layout con và Page', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.n1', {}, route('/n1'));
        const [base, nestedApp] = vm.getViewStack();
        const baseNode = container.querySelector('.base-layout');
        mountedLog.length = 0;
        renderLog.length = 0;

        await vm.mountView('web.nadmin', {}, route('/nadmin'));

        expect(container.querySelector('.base-layout')).toBe(baseNode);
        expect(vm.getViewStack()[0]).toBe(base);
        expect(nestedApp.__ctrl__.lifecycleState).toBe('destroyed');
        expect(container.querySelector('.nested-APP-SHELL')).toBeNull();
        expect(container.querySelector('.nested-ADMIN-SHELL section')?.textContent).toBe('NESTED-ADMIN');
        expect(mountedLog).toEqual(['layout:layouts.nested-admin', 'page:web.nadmin']);
        expect(renderLog).toEqual(['layouts.nested-admin']);
    });

    it('nested trùng tên outlet: mount và swap đúng outlet gần nhất', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.dup1', {}, route('/dup1'));
        const baseNode = container.querySelector('.base-layout');
        const innerNode = container.querySelector('.nested-DUP-SHELL');

        expect(container.querySelector('.nested-DUP-SHELL section')?.textContent).toBe('DUP-ONE');

        await vm.mountView('web.dup2', {}, route('/dup2'));

        expect(container.querySelector('.base-layout')).toBe(baseNode);
        expect(container.querySelector('.nested-DUP-SHELL')).toBe(innerNode);
        expect(container.querySelector('.nested-DUP-SHELL section')?.textContent).toBe('DUP-TWO');
        expect(container.textContent).not.toContain('DUP-ONE');
    });

    it('nested hydration: claim Blade DOM cho Page → Layout con → Layout gốc, không duplicate', async () => {
        const PAGE_ID = 'v-page-nested';
        const INNER_ID = 'v-layout-inner';
        const BASE_ID = 'v-layout-base';
        const container = document.createElement('div');
        container.innerHTML = `
            <!--s:v:${BASE_ID}-s-->
            <div class="${BASE_ID}-base-root base-layout">
                <header class="${BASE_ID}-base-header">BASE</header>
                <!--s:bo:${BASE_ID}-ob-shell-s-->
                <div class="${INNER_ID}-nested-root nested-APP-SHELL">
                    <aside class="${INNER_ID}-nested-aside">APP-SHELL</aside>
                    <!--s:bo:${INNER_ID}-ob-content-s-->
                    <section class="${PAGE_ID}-pg-section">
                        <!--s:o:${PAGE_ID}-o-msg-s-->NESTED-ONE<!--s:o:${PAGE_ID}-o-msg-e-->
                    </section>
                    <!--s:bo:${INNER_ID}-ob-content-e-->
                </div>
                <!--s:bo:${BASE_ID}-ob-shell-e-->
            </div>
            <!--s:v:${BASE_ID}-e-->
        `;
        document.body.appendChild(container);
        const baseNode = container.querySelector('.base-layout');
        const innerNode = container.querySelector('.nested-APP-SHELL');
        const pageNode = container.querySelector('section');
        const vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({
            container,
            registry: {
                'layouts.base': makeBaseLayoutFactory(),
                'layouts.nested-app': makeNestedLayoutFactory('layouts.nested-app', 'APP-SHELL'),
                'web.n1': makeExtendsPageFactory('web.n1', 'NESTED-ONE', 'layouts.nested-app'),
            },
            ssrData: {
                'web.n1': {
                    instances: {
                        [PAGE_ID]: { viewId: PAGE_ID, children: [{ name: 'layouts.nested-app', id: INNER_ID }] },
                    },
                },
                'layouts.nested-app': {
                    instances: {
                        [INNER_ID]: { viewId: INNER_ID, parent: { name: 'web.n1', id: PAGE_ID }, children: [{ name: 'layouts.base', id: BASE_ID }] },
                    },
                },
                'layouts.base': {
                    instances: {
                        [BASE_ID]: { viewId: BASE_ID, parent: { name: 'layouts.nested-app', id: INNER_ID } },
                    },
                },
            },
        });

        await vm.hydrateView('web.n1', { __SSR_VIEW_ID__: PAGE_ID });

        expect(container.querySelector('.base-layout')).toBe(baseNode);
        expect(container.querySelector('.nested-APP-SHELL')).toBe(innerNode);
        expect(container.querySelector('section')).toBe(pageNode);
        expect(container.querySelectorAll('.base-layout').length).toBe(1);
        expect(container.querySelectorAll('.nested-APP-SHELL').length).toBe(1);
        expect(container.querySelectorAll('section').length).toBe(1);
        expect(vm.getViewStack().map(v => v.__ctrl__.path)).toEqual([
            'layouts.base', 'layouts.nested-app', 'web.n1',
        ]);
        expect(vm.getViewStack().map(v => v.__ctrl__.lifecycleState)).toEqual([
            'active', 'active', 'active',
        ]);
    });

    it('nested hydration → CSR: reuse layout gốc, thay layout con không làm rỗng DOM', async () => {
        const PAGE_ID = 'v-page-hydrated-switch';
        const INNER_ID = 'v-layout-hydrated-switch';
        const BASE_ID = 'v-base-hydrated-switch';
        const container = document.createElement('div');
        container.innerHTML = `
            <!--s:v:${BASE_ID}-s-->
            <div class="${BASE_ID}-base-root base-layout">
                <header class="${BASE_ID}-base-header">BASE</header>
                <!--s:bo:${BASE_ID}-ob-shell-s-->
                <div class="${INNER_ID}-nested-root nested-APP-SHELL">
                    <aside class="${INNER_ID}-nested-aside">APP-SHELL</aside>
                    <!--s:bo:${INNER_ID}-ob-content-s-->
                    <section class="${PAGE_ID}-pg-section">NESTED-ONE</section>
                    <!--s:bo:${INNER_ID}-ob-content-e-->
                </div>
                <!--s:bo:${BASE_ID}-ob-shell-e-->
            </div>
            <!--s:v:${BASE_ID}-e-->
        `;
        document.body.appendChild(container);
        const baseNode = container.querySelector('.base-layout');
        const vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({
            container,
            registry: {
                'layouts.base': makeBaseLayoutFactory(),
                'layouts.nested-app': makeNestedLayoutFactory('layouts.nested-app', 'APP-SHELL'),
                'layouts.nested-admin': makeNestedLayoutFactory('layouts.nested-admin', 'ADMIN-SHELL'),
                'web.n1': makeExtendsPageFactory('web.n1', 'NESTED-ONE', 'layouts.nested-app'),
                'web.nadmin': makeExtendsPageFactory('web.nadmin', 'NESTED-ADMIN', 'layouts.nested-admin'),
            },
            ssrData: {
                'web.n1': { instances: { [PAGE_ID]: { viewId: PAGE_ID, children: [{ name: 'layouts.nested-app', id: INNER_ID }] } } },
                'layouts.nested-app': { instances: { [INNER_ID]: { viewId: INNER_ID, parent: { name: 'web.n1', id: PAGE_ID }, children: [{ name: 'layouts.base', id: BASE_ID }] } } },
                'layouts.base': { instances: { [BASE_ID]: { viewId: BASE_ID, parent: { name: 'layouts.nested-app', id: INNER_ID } } } },
            },
        });

        await vm.hydrateView('web.n1', { __SSR_VIEW_ID__: PAGE_ID });
        await vm.mountView('web.nadmin', {}, route('/nadmin'));

        expect(container.querySelector('.base-layout')).toBe(baseNode);
        expect(container.querySelector('.nested-APP-SHELL')).toBeNull();
        expect(container.querySelector('.nested-ADMIN-SHELL section')?.textContent).toBe('NESTED-ADMIN');
        expect(vm.getViewStack().map(v => v.__ctrl__.path)).toEqual([
            'layouts.base', 'layouts.nested-admin', 'web.nadmin',
        ]);
    });

    it('same layout: navigate p1 → p2 giữ nguyên DOM layout, chỉ swap ruột outlet', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));

        const headerNode = container.querySelector('header');
        const page1 = vm.getCurrentView()!;
        const layout = vm.getCurrentLayout()!;
        const outlet = Array.from(BlockManager.blockOutlets.values()).find(
            candidate => candidate.name === 'content' && candidate.ctx.viewId === layout.__ctrl__.viewId,
        )!;
        const outletOpen = outlet.openTag;
        const outletClose = outlet.closeTag;
        mountedLog.length = 0;
        renderLog.length = 0;

        await vm.mountView('web.p2', {}, route('/p2'), 'push');

        // Layout: CÙNG DOM node — không re-mount, không nháy
        expect(container.querySelector('header')).toBe(headerNode);
        expect(Array.from(BlockManager.blockOutlets.values())).toContain(outlet);
        expect(outlet.openTag).toBe(outletOpen);
        expect(outlet.closeTag).toBe(outletClose);
        // Ruột outlet swap
        expect(container.querySelector('main section')?.textContent).toBe('PAGE-TWO');
        expect(container.textContent).not.toContain('PAGE-ONE');
        // Page cũ pause + vào PageCache (block content detach theo outlet);
        // layout KHÔNG fire onMounted lại
        expect(page1.__ctrl__.lifecycleState).toBe('paused');
        expect(vm.pageCache.has('web.p1::/p1')).toBe(true);
        expect(BlockManager.blocks.has(`content${page1.__ctrl__.viewId}`)).toBe(true);
        expect(BlockManager.activeBlocks.get('content')?.viewId).toBe(vm.getCurrentView()!.__ctrl__.viewId);
        expect(mountedLog).toEqual(['page:web.p2']);
        expect(renderLog).toEqual([]);
    });

    it('render page mới lỗi → rollback page cũ và block content trong Layout', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));
        const page1 = vm.getCurrentView()!;
        const layout = vm.getCurrentLayout()!;

        vm.registerView('web.invalid', () => {
            const invalid = new View('web.invalid', 'view');
            invalid.__ctrl__.setup({ superView: null, data: {}, render: () => null } as any);
            return invalid;
        });

        const result = await vm.mountView('web.invalid', {}, route('/invalid'));

        expect(result).toBeNull();
        expect(vm.getCurrentView()).toBe(page1);
        expect(vm.getCurrentLayout()).toBe(layout);
        expect(page1.__ctrl__.lifecycleState).toBe('active');
        expect(container.querySelector('main section')?.textContent).toBe('PAGE-ONE');
    });

    it('back về page cùng layout: restore block content từ cache — giữ instance + state', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));
        const page1 = vm.getCurrentView()!;
        const layout = vm.getCurrentLayout()!;

        // Đổi state page1 trước khi rời
        (page1.__ctrl__.states.__ as any).updateStateByKey('msg', 'EDITED');
        await frame();
        expect(container.querySelector('main section')?.textContent).toBe('EDITED');

        await vm.mountView('web.p2', {}, route('/p2'), 'push');
        await vm.mountView('web.p1', {}, route('/p1'), 'pop'); // back

        // CÙNG instance page + layout, state giữ nguyên, DOM ở đúng outlet
        expect(vm.getCurrentView()).toBe(page1);
        expect(vm.getCurrentLayout()).toBe(layout);
        expect(page1.__ctrl__.lifecycleState).toBe('active');
        expect(container.querySelector('main section')?.textContent).toBe('EDITED');

        // Reactive vẫn hoạt động sau restore
        (page1.__ctrl__.states.__ as any).updateStateByKey('msg', 'AGAIN');
        await frame();
        expect(container.querySelector('main section')?.textContent).toBe('AGAIN');
    });

    it('bfcache đầy đủ: qua standalone rồi pop về — restore CẢ layout LẪN page', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));
        const page1 = vm.getCurrentView()!;
        const layout = vm.getCurrentLayout()!;
        const headerNode = container.querySelector('header');

        // Đổi state page trước khi rời
        (page1.__ctrl__.states.__ as any).updateStateByKey('msg', 'EDITED');
        await frame();

        await vm.mountView('web.alone', {}, route('/alone'), 'push');
        mountedLog.length = 0;
        await vm.mountView('web.p1', {}, route('/p1'), 'pop'); // back

        // Layout resurrect từ cache + page restore vào outlets — một lần pop
        expect(vm.getCurrentView()).toBe(page1);
        expect(vm.getCurrentLayout()).toBe(layout);
        expect(page1.__ctrl__.lifecycleState).toBe('active');
        expect(layout.__ctrl__.lifecycleState).toBe('active');
        expect(container.querySelector('header')).toBe(headerNode);
        expect(container.querySelector('main section')?.textContent).toBe('EDITED'); // state giữ nguyên
        expect(mountedLog).toEqual([]); // toàn resume — không mount hook nào

        // Reactive vẫn hoạt động
        (page1.__ctrl__.states.__ as any).updateStateByKey('msg', 'AGAIN');
        await frame();
        expect(container.querySelector('main section')?.textContent).toBe('AGAIN');
    });

    it('pop qua 2 layout: đang đứng layout Y, pop về page layout X → swap Y vào cache, restore X + page', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));       // page1 + layout app
        const page1 = vm.getCurrentView()!;
        const layoutApp = vm.getCurrentLayout()!;

        await vm.mountView('web.padmin', {}, route('/padmin'), 'push'); // layout admin
        const layoutAdmin = vm.getCurrentLayout()!;
        mountedLog.length = 0;

        await vm.mountView('web.p1', {}, route('/p1'), 'pop'); // back về page1

        // Layout admin pause + vào cache; layout app + page1 restore nguyên vẹn
        expect(vm.getCurrentView()).toBe(page1);
        expect(vm.getCurrentLayout()).toBe(layoutApp);
        expect(layoutAdmin.__ctrl__.lifecycleState).toBe('paused');
        expect(vm.pageCache.has('__layout__::layouts.admin')).toBe(true);
        expect(container.querySelector('header')?.textContent).toBe('HEADER');
        expect(container.querySelector('main section')?.textContent).toBe('PAGE-ONE');
        expect(mountedLog).toEqual([]); // toàn resume — không mount hook
    });

    it('layout cache:false → destroy như cũ; pop về → page entry putBack, mount tươi', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.pnc', {}, route('/pnc'));
        const pageNC = vm.getCurrentView()!;
        const layoutNC = vm.getCurrentLayout()!;

        await vm.mountView('web.alone', {}, route('/alone'), 'push');
        expect(layoutNC.__ctrl__.lifecycleState).toBe('destroyed'); // cache:false → destroy
        expect(vm.pageCache.has('__layout__::layouts.nocache')).toBe(false);

        await vm.mountView('web.pnc', {}, route('/pnc'), 'pop'); // layout không có trong cache

        // Entry page không restore được → putBack (KHÔNG destroy), mount tươi
        expect(vm.getCurrentView() === pageNC).toBe(false);       // instance mới
        expect(pageNC.__ctrl__.lifecycleState).toBe('paused');    // bản cũ còn sống trong cache
        expect(vm.pageCache.has('web.pnc::/pnc')).toBe(true);     // entry được trả lại
        expect(container.querySelector('main section')?.textContent).toBe('PAGE-NC');
    });

    it('block content của page mới vẫn reactive sau swap', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));
        await vm.mountView('web.p2', {}, route('/p2'), 'push');

        const page2 = vm.getCurrentView()!;
        (page2.__ctrl__.states.__ as any).updateStateByKey('msg', 'CHANGED');
        await frame();
        expect(container.querySelector('main section')?.textContent).toBe('CHANGED');
    });

    it('extends → standalone: layout pause + vào layout cache (KHÔNG destroy)', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));
        const layout = vm.getCurrentLayout()!;

        await vm.mountView('web.alone', {}, route('/alone'), 'push');

        expect(container.textContent).toContain('ALONE');
        expect(container.querySelector('header')).toBeNull();
        expect(layout.__ctrl__.lifecycleState).toBe('paused');
        expect(vm.pageCache.has('__layout__::layouts.app')).toBe(true);
        expect(vm.getCurrentLayout()).toBeNull();
    });

    it('standalone → extends: layout RESUME từ cache — cùng instance, không onMounted lại', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));
        const layout = vm.getCurrentLayout()!;
        const headerNode = container.querySelector('header');

        await vm.mountView('web.alone', {}, route('/alone'), 'push');
        mountedLog.length = 0;
        await vm.mountView('web.p2', {}, route('/p2'), 'push');

        // Layout: CÙNG instance + CÙNG DOM node (resume, không render lại)
        expect(vm.getCurrentLayout()).toBe(layout);
        expect(layout.__ctrl__.lifecycleState).toBe('active');
        expect(container.querySelector('header')).toBe(headerNode);
        expect(container.querySelector('main section')?.textContent).toBe('PAGE-TWO');
        expect(container.textContent).not.toContain('ALONE');
        // resume → chỉ resuming/resumed; onMounted KHÔNG fire lại cho layout
        expect(mountedLog).toEqual(['page:web.p2']);
    });

    it('đổi layout X → Y → X: layout X resurrect từ cache, layout Y vào cache', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1')); // layout app
        const layoutApp = vm.getCurrentLayout()!;
        const headerNode = container.querySelector('header');

        await vm.mountView('web.padmin', {}, route('/padmin'), 'push'); // layout admin
        expect(layoutApp.__ctrl__.lifecycleState).toBe('paused');
        expect(vm.getCurrentLayout()!.__ctrl__.path).toBe('layouts.admin');
        expect(container.querySelector('header')?.textContent).toBe('ADMIN-BAR');
        const layoutAdmin = vm.getCurrentLayout()!;

        await vm.mountView('web.p2', {}, route('/p2'), 'push'); // về layout app (page mới)

        expect(vm.getCurrentLayout()).toBe(layoutApp);            // cùng instance
        expect(layoutApp.__ctrl__.lifecycleState).toBe('active');
        expect(container.querySelector('header')).toBe(headerNode); // cùng DOM node
        expect(container.querySelector('main section')?.textContent).toBe('PAGE-TWO');
        expect(layoutAdmin.__ctrl__.lifecycleState).toBe('paused'); // admin vào cache
        expect(vm.pageCache.has('__layout__::layouts.admin')).toBe(true);
    });
});
