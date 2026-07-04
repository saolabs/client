"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Integration tests cho ViewManager.mountView — standalone pages (Phase 2c).
 * Luồng: mount mới → navigate (pause+cache) → back (restore) → TTL.
 */
const vitest_1 = require("vitest");
const ViewManager_1 = require("../../src/core/view/ViewManager");
const View_1 = require("../../src/core/view/View");
const app_1 = require("../../src/core/helpers/app");
const MarkerRegistry_1 = __importDefault(require("../../src/core/services/MarkerRegistry"));
if (!app_1.app.has('Registry')) {
    app_1.app.instance('Registry', MarkerRegistry_1.default);
}
/** Factory giống compiled output: view có 1 state msg + 1 output + 1 button tăng count */
function makePageFactory(pathName, initialMsg) {
    return () => {
        const view = new View_1.View(pathName, 'view');
        const ctrl = view.__ctrl__;
        const manager = ctrl.states.__;
        manager.useState(initialMsg, 'msg');
        manager.useState(0, 'count');
        ctrl.setUserDefinedConfig({
            increment() {
                manager.updateStateByKey('count', manager.states['count'].value + 1);
            },
        });
        ctrl.setup({
            superView: null,
            data: {},
            render: function () {
                return this.wrapper((parent) => [
                    this.html(`pg-${pathName}`, 'div', parent, {}, (p) => [
                        this.output(`o-msg`, p, true, ['msg'], () => manager.states['msg'].value),
                        this.output(`o-count`, p, true, ['count'], () => ` c=${manager.states['count'].value}`),
                        this.html(`btn`, 'button', p, {
                            events: { click: [{ handler: 'increment', params: [] }] },
                        }, (p2) => [this.text('+')]),
                    ]),
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
    vm.init({
        container,
        registry: {
            'web.a': makePageFactory('web.a', 'pageA'),
            'web.b': makePageFactory('web.b', 'pageB'),
        },
    });
    return { vm, container };
}
const route = (url) => ({ $urlPath: url });
function frame() {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}
(0, vitest_1.describe)('mountView — standalone', () => {
    (0, vitest_1.afterEach)(() => {
        document.body.innerHTML = '';
    });
    (0, vitest_1.it)('mount → DOM hiện + commitData + start (events hoạt động, onMounted fire)', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.a', {}, route('/a'));
        (0, vitest_1.expect)(container.textContent).toContain('pageA');
        (0, vitest_1.expect)(container.textContent).toContain('c=0');
        // Event + reactive
        container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        (0, vitest_1.expect)(container.textContent).toContain('c=1');
    });
    (0, vitest_1.it)('navigate đi: trang cũ pause + vào PageCache; trang mới mount', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.a', {}, route('/a'));
        const pageA = vm.getCurrentView();
        await vm.mountView('web.b', {}, route('/b'), 'push');
        (0, vitest_1.expect)(container.textContent).toContain('pageB');
        (0, vitest_1.expect)(container.textContent).not.toContain('pageA');
        (0, vitest_1.expect)(pageA.__ctrl__.lifecycleState).toBe('paused');
        (0, vitest_1.expect)(vm.pageCache.has('/a')).toBe(true);
    });
    (0, vitest_1.it)('back (pop): restore từ cache — giữ nguyên instance + state, không render lại', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.a', {}, route('/a'));
        const pageA = vm.getCurrentView();
        // Tăng count = 2 (state user tạo ra)
        container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        (0, vitest_1.expect)(container.textContent).toContain('c=2');
        await vm.mountView('web.b', {}, route('/b'), 'push');
        await vm.mountView('web.a', {}, route('/a'), 'pop'); // back
        // CÙNG instance, state c=2 còn nguyên — không gọi lại API/render
        (0, vitest_1.expect)(vm.getCurrentView()).toBe(pageA);
        (0, vitest_1.expect)(pageA.__ctrl__.lifecycleState).toBe('active');
        (0, vitest_1.expect)(container.textContent).toContain('c=2');
        (0, vitest_1.expect)(vm.pageCache.has('/a')).toBe(false); // đã take ra khỏi cache
        // Event vẫn hoạt động sau restore
        container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        (0, vitest_1.expect)(container.textContent).toContain('c=3');
    });
    (0, vitest_1.it)('push tới URL đã có cache → invalidate, mount instance MỚI (data tươi)', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.a', {}, route('/a'));
        const firstA = vm.getCurrentView();
        container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        await vm.mountView('web.b', {}, route('/b'), 'push');
        await vm.mountView('web.a', {}, route('/a'), 'push'); // click link, không phải back
        const secondA = vm.getCurrentView();
        (0, vitest_1.expect)(secondA === firstA).toBe(false); // instance mới
        (0, vitest_1.expect)(firstA.__ctrl__.lifecycleState).toBe('destroyed'); // bản cũ bị destroy
        (0, vitest_1.expect)(container.textContent).toContain('c=0'); // state reset (data tươi)
    });
    (0, vitest_1.it)('TTL: trang paused quá 15 phút bị destroy, back sau đó mount mới', async () => {
        const { vm, container } = createManager();
        let time = 1000000;
        vm.pageCache.now = () => time;
        await vm.mountView('web.a', {}, route('/a'));
        const pageA = vm.getCurrentView();
        await vm.mountView('web.b', {}, route('/b'), 'push');
        (0, vitest_1.expect)(vm.pageCache.has('/a')).toBe(true);
        time += 16 * 60 * 1000; // 16 phút
        await vm.mountView('web.a', {}, route('/a'), 'pop'); // back sau 16'
        (0, vitest_1.expect)(pageA.__ctrl__.lifecycleState).toBe('destroyed'); // bản cache bị destroy do TTL
        (0, vitest_1.expect)(vm.getCurrentView() === pageA).toBe(false); // mount instance mới
        (0, vitest_1.expect)(container.textContent).toContain('pageA');
    });
    (0, vitest_1.it)('duplicate guard: mount lại đúng URL đang đứng → no-op', async () => {
        const { vm } = createManager();
        await vm.mountView('web.a', {}, route('/a'));
        const pageA = vm.getCurrentView();
        const result = await vm.mountView('web.a', {}, route('/a'), 'push');
        (0, vitest_1.expect)(result).toBeNull();
        (0, vitest_1.expect)(vm.getCurrentView()).toBe(pageA);
    });
});
