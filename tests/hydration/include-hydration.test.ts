/**
 * @include hydration tests — đảm bảo include hoạt động tương đồng Blade:
 * SSR và CSR cho cùng một kết quả, JS hydrate claim DOM server thay vì tạo mới.
 *
 * Server contract (MarkerRegistryDirectiveService + SmartBladeCompiler):
 *   @startMarker('component', '{hash}') → <!--s:c:{parentViewId}-{hash}-s-->
 *   @include(...)                        → child view render với $__VIEW_ID__ riêng
 *                                          (bọc trong <!--s:v:{childViewId}-s/-e-->)
 *   @endMarker('component', '{hash}')   → <!--s:c:{parentViewId}-{hash}-e-->
 *
 * Client (Component.hydrateChild):
 *   1. Claim cặp marker s:c:{id}
 *   2. Discover viewId của child từ marker s:v: bên trong
 *   3. Child render ở HYDRATE mode → claim DOM (không chèn node mới)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

const PARENT_ID = 'vssr-parent';
const CHILD_ID = 'vssr-child';

/** Child view (partial được @include) — có state reactive */
function makeChildFactory() {
    return () => {
        const view = new View('web.child', 'view');
        const ctrl = view.__ctrl__;
        const manager: any = ctrl.states.__;
        manager.useState('hello', 'greeting');

        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() {},
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('child-root', 'section', p, {}, (p2: any) => [
                        this.text('Msg: '),
                        this.output('child-out', p2, true, ['greeting'], () => manager.states['greeting'].value),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

/** Parent view — render có @include('web.child') */
function makeParentFactory() {
    return () => {
        const view = new View('web.parent', 'view');
        const ctrl = view.__ctrl__;
        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() {},
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('page-root', 'div', p, {}, (p2: any) => [
                        this.include('inc1', 'web.child', p2, [], () => ({})),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

describe('@include — SSR hydration', () => {
    let container: HTMLElement;
    let vm: ViewManager;

    beforeEach(() => {
        container = document.createElement('div');
        // Server-rendered HTML: component markers bọc child view (contract §5.1)
        container.innerHTML = [
            `<!--s:v:${PARENT_ID}-s-->`,
            `<div class="${PARENT_ID}-page-root">`,
            `<!--s:c:${PARENT_ID}-inc1-s-->`,
            `<!--s:v:${CHILD_ID}-s-->`,
            `<section class="${CHILD_ID}-child-root">Msg: <!--s:o:${CHILD_ID}-child-out-s-->hello<!--s:o:${CHILD_ID}-child-out-e--></section>`,
            `<!--s:v:${CHILD_ID}-e-->`,
            `<!--s:c:${PARENT_ID}-inc1-e-->`,
            `</div>`,
            `<!--s:v:${PARENT_ID}-e-->`,
        ].join('');
        document.body.appendChild(container);

        vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({
            container,
            registry: {
                'web.parent': makeParentFactory(),
                'web.child': makeChildFactory(),
            },
        });
    });

    afterEach(() => {
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
        document.body.innerHTML = '';
    });

    const frame = () => new Promise<void>(r =>
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );

    it('hydrate: child CLAIM DOM server — cùng node reference, không nhân đôi', async () => {
        const ssrSection = container.querySelector('section')!;

        const result = await vm.hydrateView('web.parent', { __SSR_VIEW_ID__: PARENT_ID });
        expect(result).not.toBeNull();

        // Không tạo section thứ hai — child claim đúng node server
        const sections = container.querySelectorAll('section');
        expect(sections.length).toBe(1);
        expect(sections[0]).toBe(ssrSection);
        expect(container.textContent).toContain('Msg: hello');
    });

    it('hydrate: child view nhận đúng SSR viewId (discover từ marker s:v: bên trong)', async () => {
        await vm.hydrateView('web.parent', { __SSR_VIEW_ID__: PARENT_ID });

        const parent = vm.getCurrentView()!;
        const childCtrl = parent.__ctrl__.children[0];
        expect(childCtrl).toBeDefined();
        expect(childCtrl.viewId).toBe(CHILD_ID);
    });

    it('sau hydrate: reactive của child hoạt động (state đổi → DOM cập nhật)', async () => {
        await vm.hydrateView('web.parent', { __SSR_VIEW_ID__: PARENT_ID });

        const parent = vm.getCurrentView()!;
        const childCtrl: any = parent.__ctrl__.children[0];
        childCtrl.states.__.updateStateByKey('greeting', 'xin chào');
        await frame();

        expect(container.textContent).toContain('Msg: xin chào');
    });

    it('CSR mount cùng view → cấu trúc marker tương đồng SSR (s:c: + s:v:)', async () => {
        // Xoá SSR DOM — mount CSR từ đầu
        container.innerHTML = '';
        await vm.mountView('web.parent', {}, { $urlPath: '/parent' } as any);

        const html = container.innerHTML;
        // Component markers đúng format chuẩn (không còn component-start legacy)
        expect(html).toContain('-inc1-s');
        expect(html).toContain('-inc1-e');
        expect(html).toContain('<!--s:c:');
        expect(html).not.toContain('component-start');
        expect(container.querySelector('section')?.textContent).toContain('Msg: hello');
    });
});
