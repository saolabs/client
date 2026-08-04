/**
 * DevTools (GAP-05) — hook runtime + inspector overlay.
 *
 * Bất biến:
 *   1. TẮT mặc định — không thu thập gì, không tốn chi phí ở production
 *   2. Bật rồi mới ghi nhận sự kiện mount/destroy/state/error
 *   3. Cây view phản ánh layout chain + page + @include con
 *   4. Snapshot state cắt được tham chiếu vòng (không nổ)
 *   5. Panel dựng bằng DOM API — state chứa HTML KHÔNG bị thực thi
 *   6. Log có trần, không phình vô hạn
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Devtools, devtools, inspector } from '../../src/core/devtools';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);

const route = (url: string) => ({ $urlPath: url } as any);
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

function makeViewFactory(path: string, states: Record<string, any> = {}) {
    return () => {
        const view = new View(path, 'view');
        const ctrl = view.__ctrl__;
        const m: any = ctrl.states.__;
        for (const [k, v] of Object.entries(states)) m.useState(v, k);
        ctrl.setup({
            superView: null,
            data: {},
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('el', 'div', parent, {}, () => [this.text('hello')]),
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

beforeEach(() => { Devtools.disable(); devtools.clearLog(); });
afterEach(() => {
    Devtools.disable();
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
});

describe('DevTools hook — tắt mặc định', () => {
    it('chưa bật → không ghi nhận sự kiện nào', async () => {
        const { vm } = createManager({ 'web.a': makeViewFactory('web.a') });
        await vm.mountView('web.a', {}, route('/a'));

        expect(Devtools.isEnabled()).toBe(false);
        expect(Devtools.getLog()).toEqual([]);
    });

    it('getViewTree() gọi lúc nào cũng an toàn (kể cả khi tắt)', () => {
        // Hook là singleton, giữ ref ViewManager theo vòng đời app (giống
        // app('View')) → không assert mảng rỗng vì test khác có thể đã attach.
        // Điều cần bảo đảm: không ném, luôn trả mảng.
        expect(() => Devtools.getViewTree()).not.toThrow();
        expect(Array.isArray(Devtools.getViewTree())).toBe(true);
    });
});

describe('DevTools hook — thu thập sự kiện', () => {
    it('ghi nhận view:mounted khi mount', async () => {
        Devtools.enable();
        const { vm } = createManager({ 'web.a': makeViewFactory('web.a') });
        await vm.mountView('web.a', {}, route('/a'));

        const mounted = Devtools.getLog().filter(e => e.type === 'view:mounted');
        expect(mounted.length).toBeGreaterThan(0);
        expect(mounted[0].path).toBe('web.a');
    });

    it('ghi nhận state:changed kèm danh sách key đổi', async () => {
        Devtools.enable();
        const { vm } = createManager({ 'web.a': makeViewFactory('web.a', { count: 0 }) });
        await vm.mountView('web.a', {}, route('/a'));
        devtools.clearLog();

        vm.getCurrentView()!.__ctrl__.states.__.updateStateByKey('count', 5);
        await frame();

        const changed = Devtools.getLog().filter(e => e.type === 'state:changed');
        expect(changed.length).toBeGreaterThan(0);
        expect(changed[0].detail.keys).toContain('count');
    });

    it('ghi nhận error khi boundary được gọi', async () => {
        Devtools.enable();
        const factory = () => {
            const view = new View('web.boom', 'view');
            view.__ctrl__.setup({
                superView: null, data: {},
                onError: () => undefined,
                render: function (this: any) {
                    return this.wrapper((parent: any) => [
                        this.html('el', 'div', parent, {}, (p: any) => [
                            this.reactive('rc', 'if', null, p, [], () => { throw new Error('nổ'); }),
                        ]),
                    ]);
                },
            } as any);
            return view;
        };
        const { vm } = createManager({ 'web.boom': factory });
        await vm.mountView('web.boom', {}, route('/boom'));

        const errors = Devtools.getLog().filter(e => e.type === 'error');
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].detail.message).toBe('nổ');
    });

    it('log có trần — không phình vô hạn', () => {
        Devtools.enable();
        for (let i = 0; i < 500; i++) devtools.emit('state:changed', { detail: { keys: [String(i)] } });
        expect(Devtools.getLog().length).toBeLessThanOrEqual(200);
    });
});

describe('DevTools hook — cây view + snapshot state', () => {
    it('cây view có path, lifecycleState và state hiện tại', async () => {
        Devtools.enable();
        const { vm } = createManager({ 'web.a': makeViewFactory('web.a', { count: 7, name: 'sao' }) });
        await vm.mountView('web.a', {}, route('/a'));

        const tree = Devtools.getViewTree();
        expect(tree.length).toBe(1);
        expect(tree[0].path).toBe('web.a');
        expect(tree[0].lifecycleState).toBe('active');
        expect(tree[0].state).toMatchObject({ count: 7, name: 'sao' });
    });

    it('state chứa tham chiếu vòng → không nổ, đánh dấu là không serialize được', async () => {
        Devtools.enable();
        const circular: any = { a: 1 };
        circular.self = circular;
        const { vm } = createManager({ 'web.c': makeViewFactory('web.c', { bad: circular }) });
        await vm.mountView('web.c', {}, route('/c'));

        const tree = Devtools.getViewTree();
        expect(tree[0].state.bad).toBe('[không serialize được]');
    });
});

describe('DevTools inspector — panel', () => {
    it('open() dựng panel và tự bật hook; close() gỡ sạch', async () => {
        const { vm } = createManager({ 'web.a': makeViewFactory('web.a', { count: 1 }) });
        await vm.mountView('web.a', {}, route('/a'));

        Devtools.open();
        expect(Devtools.isEnabled()).toBe(true);
        expect(document.getElementById('__saola_devtools_panel__')).not.toBeNull();
        expect(inspector.isOpen()).toBe(true);

        Devtools.close();
        expect(document.getElementById('__saola_devtools_panel__')).toBeNull();
    });

    it('state chứa HTML → hiển thị dạng TEXT, không tạo element (không tiêm HTML)', async () => {
        const evil = '<img src=x onerror="window.__pwned=1">';
        const { vm } = createManager({ 'web.x': makeViewFactory('web.x', { note: evil }) });
        await vm.mountView('web.x', {}, route('/x'));

        Devtools.open();
        // Bấm vào node để mở phần state (mặc định đóng)
        const panel = document.getElementById('__saola_devtools_panel__')!;
        const row = panel.querySelector('[data-role="body"] div div') as HTMLElement;
        row?.click();

        expect(panel.querySelector('img')).toBeNull();
        expect((window as any).__pwned).toBeUndefined();
        expect(panel.textContent).toContain('onerror'); // có mặt, nhưng là text
    });
});
