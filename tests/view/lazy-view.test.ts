/**
 * Lazy view registry (GAP-01 Phần A) — `'web.about': () => import('./about.js')`.
 *
 * Kiểu registry đã quảng cáo dạng này từ lâu (ViewManager.setViewRegistry doc)
 * nhưng runtime chưa await → `view` là Promise, mọi `view.__ctrl__` phía sau vỡ.
 *
 * Bất biến kiểm ở đây:
 *   1. factory trả Promise<module {default}> → mount đúng
 *   2. factory trả Promise<factory> → mount đúng
 *   3. factory trả View trực tiếp (eager, toàn bộ app hiện tại) → KHÔNG đổi hành vi
 *   4. import lỗi → app còn sống, không throw ra Router
 *   5. navigate lần 2 → không import lại (factory đã cache)
 *   6. @include/@extends dùng view lazy chưa preload → null + log, không trả Promise
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);

const route = (url: string) => ({ $urlPath: url } as any);

/** Factory kiểu compiled output. */
function makeViewFactory(path: string, text: string) {
    return () => {
        const view = new View(path, 'view');
        view.__ctrl__.setup({
            superView: null,
            data: {},
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('el', 'div', parent, {}, () => [this.text(text)]),
                ]);
            },
        } as any);
        return view;
    };
}

function createManager(registry: Record<string, any>) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({ container, registry });
    return { vm, container };
}

afterEach(() => {
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
});

describe('Registry lazy — các shape được chấp nhận', () => {
    it('Promise<module {default}> — đúng dạng `() => import(...)`', async () => {
        const { vm, container } = createManager({
            'web.lazy': () => Promise.resolve({ default: makeViewFactory('web.lazy', 'LAZY MODULE') }),
        });

        await vm.mountView('web.lazy', {}, route('/lazy'));

        expect(container.textContent).toContain('LAZY MODULE');
        expect(vm.getCurrentView()?.__ctrl__.path).toBe('web.lazy');
    });

    it('Promise<factory> — dạng `async () => (await import(...)).default`', async () => {
        const { vm, container } = createManager({
            'web.lazy': () => Promise.resolve(makeViewFactory('web.lazy', 'LAZY FACTORY')),
        });

        await vm.mountView('web.lazy', {}, route('/lazy'));

        expect(container.textContent).toContain('LAZY FACTORY');
    });

    it('View trực tiếp (eager) — hành vi cũ KHÔNG đổi', async () => {
        const { vm, container } = createManager({
            'web.eager': makeViewFactory('web.eager', 'EAGER'),
        });

        await vm.mountView('web.eager', {}, route('/eager'));

        expect(container.textContent).toContain('EAGER');
    });
});

describe('Registry lazy — lỗi và cache', () => {
    it('import lỗi (chunk 404) → trả null, app còn sống, không throw ra Router', async () => {
        const { vm } = createManager({
            'web.broken': () => Promise.reject(new Error('Failed to fetch dynamically imported module')),
            'web.ok': makeViewFactory('web.ok', 'OK'),
        });

        const result = await vm.mountView('web.broken', {}, route('/broken'));
        expect(result).toBeNull();

        // Router vẫn điều hướng tiếp được sau lỗi
        const { container } = { container: (vm as any).container as HTMLElement };
        await vm.mountView('web.ok', {}, route('/ok'));
        expect(container.textContent).toContain('OK');
    });

    it('resolve về thứ không phải factory/View → null + log, không crash', async () => {
        const { vm } = createManager({
            'web.weird': () => Promise.resolve({ notDefault: 123 }),
        });

        const result = await vm.mountView('web.weird', {}, route('/weird'));
        expect(result).toBeNull();
    });

    it('navigate lần 2 → KHÔNG import lại (factory đã cache)', async () => {
        const loader = vi.fn(() =>
            Promise.resolve({ default: makeViewFactory('web.lazy', 'LAZY') }));
        const { vm } = createManager({
            'web.lazy': loader,
            'web.other': makeViewFactory('web.other', 'OTHER'),
        });

        await vm.mountView('web.lazy', {}, route('/lazy'));
        await vm.mountView('web.other', {}, route('/other'));
        await vm.mountView('web.lazy', {}, route('/lazy2'));

        expect(loader).toHaveBeenCalledTimes(1);
    });
});

describe('resolveViewSync — @include/@extends không await được', () => {
    it('view lazy CHƯA preload → null (không trả Promise làm vỡ ngầm phía sau)', () => {
        const { vm } = createManager({
            'partials.lazy': () => Promise.resolve({ default: makeViewFactory('partials.lazy', 'X') }),
        });

        expect(vm.resolveViewSync('partials.lazy', {}, false)).toBeNull();
    });

    it('sau preloadView() → resolveViewSync trả View thật', async () => {
        const { vm } = createManager({
            'partials.lazy': () => Promise.resolve({ default: makeViewFactory('partials.lazy', 'X') }),
        });

        expect(await vm.preloadView('partials.lazy')).toBe(true);

        const view = vm.resolveViewSync('partials.lazy', {}, false);
        expect(view).not.toBeNull();
        expect(view.__ctrl__.path).toBe('partials.lazy');
    });

    it('view eager → resolveViewSync hoạt động bình thường (không cần preload)', () => {
        const { vm } = createManager({
            'partials.eager': makeViewFactory('partials.eager', 'X'),
        });

        expect(vm.resolveViewSync('partials.eager', {}, false)).not.toBeNull();
    });
});
