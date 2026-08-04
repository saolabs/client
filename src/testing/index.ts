/**
 * `@saolabs/client/testing` — tiện ích test view trong jsdom/happy-dom.
 *
 * Hai mức dùng:
 *   - `mount(factory, data)` — mount một view ĐÃ COMPILE (factory compiler sinh).
 *     Đây là API dành cho người dùng framework test component `.sao` của mình.
 *   - `mountView(renderFn, options)` — mount từ một render function viết tay,
 *     không cần compile. Dùng để test riêng lẻ element/lifecycle.
 *
 * Không phụ thuộc test runner nào (không import vitest/jest) — chạy được với
 * bất kỳ runner nào miễn là môi trường có DOM.
 */
import { View } from '../core/view/View';
import { ViewController } from '../core/view/ViewController';
import { Html } from '../core/elements/Html';
import { app } from '../core/helpers/app';
import MarkerRegistry from '../core/services/MarkerRegistry';

// ── RAF polyfill (một số môi trường DOM giả lập không có) ─────
if (typeof globalThis.requestAnimationFrame !== 'function') {
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number;
    (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
}

/**
 * Chờ qua batch RAF flush (state → DOM).
 * State update được gom theo requestAnimationFrame nên sau khi set state phải
 * `await nextFrame()` rồi mới assert DOM.
 */
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
    /** Container thật trong document.body */
    container: HTMLElement;
    /** Html wrapper của container (rootElement) */
    rootHtml: Html;
    wrapper: any;
    /** Đặt state qua StateManager (như user thao tác) */
    setState: (key: string, value: any) => void;
    getState: (key: string) => any;
    /** textContent của container, đã trim (bỏ qua comment marker) */
    text: () => string;
    destroy: () => void;
}

export interface MountOptions {
    /** states khởi tạo: { count: 0 } → useState(0, 'count') */
    states?: Record<string, any>;
    /** methods gắn lên view (như `<script setup>`) */
    methods?: Record<string, (...args: any[]) => any>;
    /** path của view — dùng cho AssetManager ref-count */
    path?: string;
    /** styles/scripts của component — cho AssetManager */
    styles?: any[];
    scripts?: any[];
}

function ensureRegistry(): void {
    if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
}

function createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.setAttribute('data-test-root', '');
    document.body.appendChild(container);
    return container;
}

function buildHarness(view: View, container: HTMLElement): Harness {
    const ctrl = view.__ctrl__ as ViewController;
    const manager: any = ctrl.states.__;

    const rootHtml = new Html({
        ctx: ctrl,
        tagName: 'div',
        element: container,
        initMode: 'hydrate',
        childrenFactory: () => [],
    });

    // Luồng chuẩn như ViewManager case standalone: render → mount → commitData → start
    const wrapper = ctrl.render();
    if (wrapper && typeof (wrapper as any).mountTo === 'function') {
        ctrl.mount(rootHtml);
        ctrl.commitData();
        ctrl.start();
    }

    return {
        view,
        ctrl,
        container,
        rootHtml,
        wrapper,
        setState: (key, value) => manager.updateStateByKey(key, value),
        getState: (key) => manager.getState?.(key) ?? manager.states?.[key]?.value,
        text: () => (container.textContent ?? '').trim(),
        destroy: () => {
            try { ctrl.destroy(); } catch { /* view có thể đã destroy */ }
            container.remove();
        },
    };
}

/**
 * Mount một view ĐÃ COMPILE.
 *
 * @example
 * import { mount, nextFrame } from '@saolabs/client/testing';
 * import Counter from './views/counter.js';
 *
 * const c = mount(Counter, { start: 5 });
 * c.container.querySelector('button')!.click();
 * await nextFrame();
 * expect(c.text()).toContain('6');
 * c.destroy();
 */
export function mount(
    factory: (data?: any, systemData?: any) => View,
    data: Record<string, any> = {},
): Harness {
    ensureRegistry();
    const container = createContainer();
    const view = factory(data, { App: app(), View: (app() as any).View });
    return buildHarness(view, container);
}

/**
 * Mount từ render function viết tay — không cần compile.
 * `renderFn` chạy với `this` = ViewController, giống `config.render` compiler sinh.
 */
export function mountView(
    renderFn: (this: ViewController) => any,
    options: MountOptions = {},
): Harness {
    ensureRegistry();

    const view = new View(options.path ?? 'test.view', 'view');
    const ctrl = view.__ctrl__ as ViewController;

    // Khai báo states trước (compiled output làm trong constructor)
    const manager: any = ctrl.states.__;
    for (const [key, value] of Object.entries(options.states ?? {})) {
        manager.useState(value, key);
    }

    if (options.methods) ctrl.setUserDefinedConfig(options.methods);

    ctrl.setup({
        superView: null,
        data: {},
        path: options.path,
        styles: options.styles,
        scripts: options.scripts,
        render: renderFn,
    } as any);

    return buildHarness(view, createContainer());
}

/** textContent của element, đã trim. */
export function visibleText(el: HTMLElement): string {
    return (el.textContent ?? '').trim();
}
