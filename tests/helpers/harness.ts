/**
 * Test harness — dựng View + ViewController + root container trong jsdom,
 * mô phỏng đúng luồng ViewManager: render → mountTo → start.
 *
 * Dùng cho baseline tests theo docs/RUNTIME_CONTRACT.md.
 */
import { View } from '../../src/core/view/View';
import { ViewController } from '../../src/core/view/ViewController';
import { Html } from '../../src/core/elements/Html';
import { app } from '../../src/core/helpers/app';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';

// ── RAF polyfill (jsdom có thể không có) ─────────────────────
if (typeof globalThis.requestAnimationFrame !== 'function') {
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
        setTimeout(() => cb(performance.now()), 0) as unknown as number;
    (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
}

/** Chờ qua batch RAF flush (state → DOM) */
export function nextFrame(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
        });
    });
}

export interface Harness {
    view: View;
    ctrl: ViewController;
    /** DOM container thật trong document.body */
    container: HTMLElement;
    /** Html wrapper của container (rootElement) */
    rootHtml: Html;
    wrapper: any;
    /** set state qua StateManager */
    setState: (key: string, value: any) => void;
    getState: (key: string) => any;
    destroy: () => void;
}

export interface MountOptions {
    /** states khởi tạo: { count: 0 } → useState(0, 'count') */
    states?: Record<string, any>;
    /** methods gắn lên view (như <script setup>) */
    methods?: Record<string, (...args: any[]) => any>;
    /** path của view (component type) — dùng cho AssetManager ref-count */
    path?: string;
    /** styles/scripts của component (như register_data) — cho AssetManager test */
    styles?: any[];
    scripts?: any[];
}

/**
 * Mount một view với render factory như compiled output.
 *
 * renderFn chạy với this = ViewController, giống config.render trong setup().
 * Trả về this.wrapper(...) như compiled output.
 */
export function mountView(
    renderFn: (this: ViewController) => any,
    options: MountOptions = {}
): Harness {
    // DI: Wrapper cần app("Registry")
    if (!app.has('Registry')) {
        app.instance('Registry', MarkerRegistry);
    }

    const view = new View(options.path ?? `test.view`, 'view');
    const ctrl = view.__ctrl__;

    // Khai báo states trước (compiled output làm trong constructor)
    const manager: any = ctrl.states.__;
    for (const [key, value] of Object.entries(options.states ?? {})) {
        manager.useState(value, key);
    }

    if (options.methods) {
        ctrl.setUserDefinedConfig(options.methods);
    }

    ctrl.setup({
        superView: null,
        data: {},
        path: options.path,
        styles: options.styles,
        scripts: options.scripts,
        render: renderFn,
    } as any);

    // Root container thật trong DOM
    const container = document.createElement('div');
    container.setAttribute('data-test-root', '');
    document.body.appendChild(container);

    const rootHtml = new Html({
        ctx: ctrl,
        tagName: 'div',
        element: container,
        initMode: 'hydrate',
        childrenFactory: () => [],
    });

    // Luồng chuẩn: render → mount → commitData → start (như ViewManager case standalone)
    const wrapper = ctrl.render();
    if (wrapper && typeof wrapper.mountTo === 'function') {
        ctrl.mount(rootHtml); // DOM + mounting/mounted + acquire style/script
        ctrl.commitData();
        ctrl.start(); // ctrl.start → _rootTree.start + lifecycleState 'active' + starting/started/onMounted
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
            try { ctrl.destroy(); } catch { /* baseline: destroy có thể lỗi */ }
            container.remove();
        },
    };
}

/** Text content của container, bỏ qua comment markers */
export function visibleText(el: HTMLElement): string {
    return (el.textContent ?? '').trim();
}
