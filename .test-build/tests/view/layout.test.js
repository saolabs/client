"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Integration tests Phase 3b: @extends layout — mount, same-layout swap, đổi layout.
 * Thiết kế: ROUTE_RENDER_FLOW.md §4, §5.
 */
const vitest_1 = require("vitest");
const ViewManager_1 = require("../../src/core/view/ViewManager");
const View_1 = require("../../src/core/view/View");
const app_1 = require("../../src/core/helpers/app");
const MarkerRegistry_1 = __importDefault(require("../../src/core/services/MarkerRegistry"));
const BlockManager_1 = __importDefault(require("../../src/core/services/BlockManager"));
const StoreService_1 = require("../../src/core/services/StoreService");
if (!app_1.app.has('Registry')) {
    app_1.app.instance('Registry', MarkerRegistry_1.default);
}
const mountedLog = [];
function makeLayoutFactory(pathName = 'layouts.app') {
    return () => {
        const view = new View_1.View(pathName, 'layout');
        const ctrl = view.__ctrl__;
        view.onMounted = () => mountedLog.push(`layout:${pathName}`);
        ctrl.setup({
            superView: null,
            data: {},
            render: function () {
                return this.wrapper((parent) => [
                    this.html('l-header', 'header', parent, {}, (p) => [this.text('HEADER')]),
                    this.html('l-main', 'main', parent, {}, (p) => [
                        this.blockOutlet('ob-content', 'content', p),
                    ]),
                ]);
            },
        });
        return view;
    };
}
function makeExtendsPageFactory(pathName, msg) {
    return () => {
        const view = new View_1.View(pathName, 'view');
        const ctrl = view.__ctrl__;
        const manager = ctrl.states.__;
        manager.useState(msg, 'msg');
        view.onMounted = () => mountedLog.push(`page:${pathName}`);
        ctrl.setup({
            superView: 'layouts.app',
            data: {},
            render: function () {
                this.block('b-content', 'content', (parentElement) => [
                    this.html('pg-section', 'section', parentElement, {}, (p) => [
                        this.output('o-msg', p, true, ['msg'], () => manager.states['msg'].value),
                    ]),
                ]);
                return this.extendView('layouts.app');
            },
        });
        return view;
    };
}
function makeStandaloneFactory(pathName, text) {
    return () => {
        const view = new View_1.View(pathName, 'view');
        const ctrl = view.__ctrl__;
        ctrl.setup({
            superView: null,
            data: {},
            render: function () {
                return this.wrapper((parent) => [
                    this.html('alone', 'article', parent, {}, (p) => [this.text(text)]),
                ]);
            },
        });
        return view;
    };
}
function createManager() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const vm = new ViewManager_1.ViewManager((0, app_1.app)());
    vm.setApp((0, app_1.app)());
    (0, app_1.app)().set('View', vm); // extendView resolve qua App.View
    vm.init({
        container,
        registry: {
            'layouts.app': makeLayoutFactory(),
            'web.p1': makeExtendsPageFactory('web.p1', 'PAGE-ONE'),
            'web.p2': makeExtendsPageFactory('web.p2', 'PAGE-TWO'),
            'web.alone': makeStandaloneFactory('web.alone', 'ALONE'),
        },
    });
    return { vm, container };
}
const route = (url) => ({ $urlPath: url });
function frame() {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}
(0, vitest_1.describe)('mountView — @extends layout', () => {
    (0, vitest_1.afterEach)(() => {
        document.body.innerHTML = '';
        BlockManager_1.default.destroy(); // BlockManager là global singleton — reset giữa các test
        StoreService_1.StoreService.instance('ViewManager').clear(); // store layout cache cũng là singleton
        mountedLog.length = 0;
    });
    (0, vitest_1.it)('mount page extends: layout structure + block content trong outlet', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));
        (0, vitest_1.expect)(container.querySelector('header')?.textContent).toBe('HEADER');
        // Block content nằm TRONG <main> (giữa outlet markers)
        (0, vitest_1.expect)(container.querySelector('main section')?.textContent).toBe('PAGE-ONE');
        // onMounted: layout trước, page sau
        (0, vitest_1.expect)(mountedLog).toEqual(['layout:layouts.app', 'page:web.p1']);
    });
    (0, vitest_1.it)('same layout: navigate p1 → p2 giữ nguyên DOM layout, chỉ swap ruột outlet', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));
        const headerNode = container.querySelector('header');
        const page1 = vm.getCurrentView();
        mountedLog.length = 0;
        await vm.mountView('web.p2', {}, route('/p2'), 'push');
        // Layout: CÙNG DOM node — không re-mount, không nháy
        (0, vitest_1.expect)(container.querySelector('header')).toBe(headerNode);
        // Ruột outlet swap
        (0, vitest_1.expect)(container.querySelector('main section')?.textContent).toBe('PAGE-TWO');
        (0, vitest_1.expect)(container.textContent).not.toContain('PAGE-ONE');
        // Page cũ destroy; layout KHÔNG fire onMounted lại
        (0, vitest_1.expect)(page1.__ctrl__.lifecycleState).toBe('destroyed');
        (0, vitest_1.expect)(mountedLog).toEqual(['page:web.p2']);
    });
    (0, vitest_1.it)('block content của page mới vẫn reactive sau swap', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));
        await vm.mountView('web.p2', {}, route('/p2'), 'push');
        const page2 = vm.getCurrentView();
        page2.__ctrl__.states.__.updateStateByKey('msg', 'CHANGED');
        await frame();
        (0, vitest_1.expect)(container.querySelector('main section')?.textContent).toBe('CHANGED');
    });
    (0, vitest_1.it)('extends → standalone: layout bị destroy toàn bộ', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));
        const layout = vm.getCurrentLayout();
        await vm.mountView('web.alone', {}, route('/alone'), 'push');
        (0, vitest_1.expect)(container.textContent).toContain('ALONE');
        (0, vitest_1.expect)(container.querySelector('header')).toBeNull();
        (0, vitest_1.expect)(layout.__ctrl__.lifecycleState).toBe('destroyed');
        (0, vitest_1.expect)(vm.getCurrentLayout()).toBeNull();
    });
    (0, vitest_1.it)('standalone → extends: layout mount lại bình thường (store không trả instance chết)', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.p1', {}, route('/p1'));
        await vm.mountView('web.alone', {}, route('/alone'), 'push');
        await vm.mountView('web.p2', {}, route('/p2'), 'push');
        (0, vitest_1.expect)(container.querySelector('header')?.textContent).toBe('HEADER');
        (0, vitest_1.expect)(container.querySelector('main section')?.textContent).toBe('PAGE-TWO');
        (0, vitest_1.expect)(container.textContent).not.toContain('ALONE');
    });
});
