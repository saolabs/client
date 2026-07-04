"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextFrame = nextFrame;
exports.mountView = mountView;
exports.visibleText = visibleText;
/**
 * Test harness — dựng View + ViewController + root container trong jsdom,
 * mô phỏng đúng luồng ViewManager: render → mountTo → start.
 *
 * Dùng cho baseline tests theo docs/RUNTIME_CONTRACT.md.
 */
const View_1 = require("../../src/core/view/View");
const Html_1 = require("../../src/core/elements/Html");
const app_1 = require("../../src/core/helpers/app");
const MarkerRegistry_1 = __importDefault(require("../../src/core/services/MarkerRegistry"));
// ── RAF polyfill (jsdom có thể không có) ─────────────────────
if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
/** Chờ qua batch RAF flush (state → DOM) */
function nextFrame() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
        });
    });
}
/**
 * Mount một view với render factory như compiled output.
 *
 * renderFn chạy với this = ViewController, giống config.render trong setup().
 * Trả về this.wrapper(...) như compiled output.
 */
function mountView(renderFn, options = {}) {
    // DI: Wrapper cần app("Registry")
    if (!app_1.app.has('Registry')) {
        app_1.app.instance('Registry', MarkerRegistry_1.default);
    }
    const view = new View_1.View(`test.view`, 'view');
    const ctrl = view.__ctrl__;
    // Khai báo states trước (compiled output làm trong constructor)
    const manager = ctrl.states.__;
    for (const [key, value] of Object.entries(options.states ?? {})) {
        manager.useState(value, key);
    }
    if (options.methods) {
        ctrl.setUserDefinedConfig(options.methods);
    }
    ctrl.setup({
        superView: null,
        data: {},
        render: renderFn,
    });
    // Root container thật trong DOM
    const container = document.createElement('div');
    container.setAttribute('data-test-root', '');
    document.body.appendChild(container);
    const rootHtml = new Html_1.Html({
        ctx: ctrl,
        tagName: 'div',
        element: container,
        initMode: 'hydrate',
        childrenFactory: () => [],
    });
    // Luồng chuẩn: render → mount → commitData → start (như ViewManager case standalone)
    const wrapper = ctrl.render();
    if (wrapper && typeof wrapper.mountTo === 'function') {
        wrapper.mountTo(rootHtml);
        ctrl.commitData();
        ctrl.start(); // ctrl.start → _rootTree.start + lifecycleState 'active' + onMounted
    }
    return {
        view,
        ctrl,
        container,
        rootHtml,
        wrapper,
        setState: (key, value) => manager.updateStateByKey(key, value),
        getState: (key) => manager.getState?.(key) ?? manager.states?.[key]?.value,
        destroy: () => {
            try {
                ctrl.destroy();
            }
            catch { /* baseline: destroy có thể lỗi */ }
            container.remove();
        },
    };
}
/** Text content của container, bỏ qua comment markers */
function visibleText(el) {
    return (el.textContent ?? '').trim();
}
