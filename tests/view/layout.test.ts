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
            'web.p1': makeExtendsPageFactory('web.p1', 'PAGE-ONE'),
            'web.p2': makeExtendsPageFactory('web.p2', 'PAGE-TWO'),
            'web.padmin': makeExtendsPageFactory('web.padmin', 'PAGE-ADMIN', 'layouts.admin'),
            'web.pnc': makeExtendsPageFactory('web.pnc', 'PAGE-NC', 'layouts.nocache'),
            'web.alone': makeStandaloneFactory('web.alone', 'ALONE'),
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

    it('same layout: navigate p1 → p2 giữ nguyên DOM layout, chỉ swap ruột outlet', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));

        const headerNode = container.querySelector('header');
        const page1 = vm.getCurrentView()!;
        mountedLog.length = 0;

        await vm.mountView('web.p2', {}, route('/p2'), 'push');

        // Layout: CÙNG DOM node — không re-mount, không nháy
        expect(container.querySelector('header')).toBe(headerNode);
        // Ruột outlet swap
        expect(container.querySelector('main section')?.textContent).toBe('PAGE-TWO');
        expect(container.textContent).not.toContain('PAGE-ONE');
        // Page cũ pause + vào PageCache (block content detach theo outlet);
        // layout KHÔNG fire onMounted lại
        expect(page1.__ctrl__.lifecycleState).toBe('paused');
        expect(vm.pageCache.has('web.p1::/p1')).toBe(true);
        expect(mountedLog).toEqual(['page:web.p2']);
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
