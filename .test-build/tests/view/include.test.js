"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Tests Phase 3c: Component (@include / @includeIf / @includeWhen).
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
/** Child component: nhận props label qua data, có updateVariableData như compiled output */
function makeCardFactory() {
    return (__data__ = {}) => {
        const view = new View_1.View('partials.card', 'view');
        const ctrl = view.__ctrl__;
        const manager = ctrl.states.__;
        manager.useState(__data__?.data?.label ?? __data__?.label ?? 'empty', 'label');
        ctrl.setup({
            superView: null,
            data: __data__,
            render: function () {
                return this.wrapper((parent) => [
                    this.html('card', 'article', parent, {}, (p) => [
                        this.output('o-label', p, true, ['label'], () => manager.states['label'].value),
                    ]),
                ]);
            },
            updateVariableData: function (data) {
                if (data && 'label' in data) {
                    manager.updateStateByKey('label', data.label);
                }
            },
        });
        return view;
    };
}
/** Page chứa @include('partials.card', ['label' => $msg]) — props reactive theo state msg */
function makeHostFactory(opts = {}) {
    return () => {
        const view = new View_1.View('web.host', 'view');
        const ctrl = view.__ctrl__;
        const manager = ctrl.states.__;
        manager.useState('hello', 'msg');
        manager.useState(true, 'showCard');
        ctrl.setup({
            superView: null,
            data: {},
            render: function () {
                return this.wrapper((parent) => [
                    this.html('host', 'div', parent, {}, (p) => [
                        opts.when
                            ? this.includeWhen('cpn-1', { stateKeys: ['showCard'], checker: () => manager.states['showCard'].value }, 'partials.card', p, ['msg'], () => ({ label: manager.states['msg'].value }))
                            : this.include('cpn-1', 'partials.card', p, ['msg'], () => ({ label: manager.states['msg'].value })),
                        this.html('after', 'footer', p, {}, () => [this.text('FOOTER')]),
                    ]),
                ]);
            },
        });
        return view;
    };
}
function createManager(opts = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const vm = new ViewManager_1.ViewManager((0, app_1.app)());
    vm.setApp((0, app_1.app)());
    (0, app_1.app)().set('View', vm);
    vm.init({
        container,
        registry: {
            'web.host': makeHostFactory(opts),
            'partials.card': makeCardFactory(),
        },
    });
    return { vm, container };
}
const route = (url) => ({ $urlPath: url });
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
(0, vitest_1.describe)('@include — Component', () => {
    (0, vitest_1.afterEach)(() => {
        document.body.innerHTML = '';
        BlockManager_1.default.destroy();
        StoreService_1.StoreService.instance('ViewManager').clear();
    });
    (0, vitest_1.it)('render child view giữa component markers, đúng vị trí (trước footer)', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.host', {}, route('/host'));
        const article = container.querySelector('article');
        (0, vitest_1.expect)(article?.textContent).toBe('hello');
        // Component đứng TRƯỚC footer trong DOM order
        const footer = container.querySelector('footer');
        (0, vitest_1.expect)(article.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    (0, vitest_1.it)('props reactive: state cha đổi → dataFactory mới → child updateData', async () => {
        const { vm, container } = createManager();
        await vm.mountView('web.host', {}, route('/host'));
        const hostCtrl = vm.getCurrentView().__ctrl__;
        hostCtrl.states.__.updateStateByKey('msg', 'world');
        await frame(); // host flush → component subscriber → child updateData
        await frame(); // child state flush → output update
        (0, vitest_1.expect)(container.querySelector('article')?.textContent).toBe('world');
    });
    (0, vitest_1.it)('child view liên kết parent/children + bị destroy theo cha', async () => {
        const { vm } = createManager();
        await vm.mountView('web.host', {}, route('/host'));
        const hostCtrl = vm.getCurrentView().__ctrl__;
        (0, vitest_1.expect)(hostCtrl.children.length).toBe(1);
        const childCtrl = hostCtrl.children[0];
        (0, vitest_1.expect)(childCtrl.path).toBe('partials.card');
        (0, vitest_1.expect)(childCtrl.lifecycleState).toBe('active');
        hostCtrl.destroy();
        (0, vitest_1.expect)(childCtrl.lifecycleState).toBe('destroyed');
    });
    (0, vitest_1.it)('@includeWhen: condition đổi → unmount/mount child', async () => {
        const { vm, container } = createManager({ when: true });
        await vm.mountView('web.host', {}, route('/host'));
        (0, vitest_1.expect)(container.querySelector('article')).not.toBeNull();
        const hostCtrl = vm.getCurrentView().__ctrl__;
        hostCtrl.states.__.updateStateByKey('showCard', false);
        await frame();
        (0, vitest_1.expect)(container.querySelector('article')).toBeNull();
        (0, vitest_1.expect)(container.querySelector('footer')).not.toBeNull(); // phần còn lại nguyên vẹn
        hostCtrl.states.__.updateStateByKey('showCard', true);
        await frame();
        (0, vitest_1.expect)(container.querySelector('article')).not.toBeNull();
        (0, vitest_1.expect)(container.querySelector('article')?.textContent).toBe('hello');
    });
});
