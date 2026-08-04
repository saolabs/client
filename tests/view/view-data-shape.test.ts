/**
 * view() data-shape contract — compiler ↔ client đồng bộ.
 *
 * Compiled factory nhận __data__ là object data PHẲNG:
 *   - đọc __data__.__SSR_VIEW_ID__ để set viewId
 *   - setup({ data: __data__ }) → ctrl.data = chính object đó
 *
 * ViewManager.view() PHẢI truyền data phẳng (không bọc { data }).
 * Tham chiếu: docs/HYDRATION.md §9.2
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper'))   app.instance('Helper', new HelperService(app() as any));

// Factory MÔ PHỎNG compiled output: nhận (__data__, systemData) phẳng.
function makeCompiledStyleFactory() {
    return (__data__: any = {}, _systemData: any = {}) => {
        const view = new View('web.compiled', 'view');
        const ctrl = view.__ctrl__;
        const __VIEW_ID__ = __data__.__SSR_VIEW_ID__ || ctrl.viewId;
        ctrl.setup({
            superView: null,
            data: __data__,          // compiled: data: __data__ (phẳng)
            viewId: __VIEW_ID__,
            commitConstructorData() {},
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('root', 'div', p, {}, (p2: any) => [this.text('x')]),
                ]);
            },
        } as any);
        return view;
    };
}

let vm: ViewManager;

afterEach(() => {
    StoreService.instance('ViewManager').clear();
    document.body.innerHTML = '';
});

function setup() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    vm.init({ container, registry: { 'web.compiled': makeCompiledStyleFactory() } });
}

describe('ViewManager.view() — data shape phẳng', () => {
    it('factory nhận __data__ PHẲNG (không bọc { data })', async () => {
        setup();
        const view = await vm.view('web.compiled', { foo: 'bar', n: 1 }, false);
        // ctrl.data phải = chính object data, KHÔNG lồng dưới key "data"
        expect(view.__ctrl__.data).toEqual({ foo: 'bar', n: 1 });
        expect((view.__ctrl__.data as any).data).toBeUndefined();
    });

    it('factory đọc được __data__.__SSR_VIEW_ID__ → set viewId', async () => {
        setup();
        const view = await vm.view('web.compiled', { __SSR_VIEW_ID__: 'vx-123' }, false);
        expect(view.__ctrl__.viewId).toBe('vx-123');
    });

    it('không data → factory nhận {} (không lỗi)', async () => {
        setup();
        const view = await vm.view('web.compiled', {} as any, false);
        expect(view).not.toBeNull();
        expect(view.__ctrl__.data).toEqual({});
    });
});
