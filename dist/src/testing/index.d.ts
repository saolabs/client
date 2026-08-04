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
/**
 * Chờ qua batch RAF flush (state → DOM).
 * State update được gom theo requestAnimationFrame nên sau khi set state phải
 * `await nextFrame()` rồi mới assert DOM.
 */
export declare function nextFrame(): Promise<void>;
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
export declare function mount(factory: (data?: any, systemData?: any) => View, data?: Record<string, any>): Harness;
/**
 * Mount từ render function viết tay — không cần compile.
 * `renderFn` chạy với `this` = ViewController, giống `config.render` compiler sinh.
 */
export declare function mountView(renderFn: (this: ViewController) => any, options?: MountOptions): Harness;
/** textContent của element, đã trim. */
export declare function visibleText(el: HTMLElement): string;
//# sourceMappingURL=index.d.ts.map