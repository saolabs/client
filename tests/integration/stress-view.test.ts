/**
 * End-to-end trên OUTPUT COMPILER THẬT.
 *
 * `tests/fixtures/stress/*.ts` là kết quả compile thật của
 * `saola/resources/saola/web/views/modules/stress/*.sao` — không phải harness
 * viết tay. Mọi test khác trong repo đều dựng cây element bằng tay, nên chúng
 * không bắt được lỗi ở khâu SINH CODE. Test này lấp đúng khoảng đó.
 *
 * Bao phủ, theo đúng các cơ chế đã vá:
 *   - @foreach + @key + component include mỗi hàng, refresh sinh ref MỚI (§2.10)
 *   - @foreach lồng + @if trong loop (Reactive theo từng item)
 *   - @foreach KHÔNG @key (§2.19 — hậu tố chỉ số)
 *   - event modifier .prevent/.stop/.self/.once (§2.14)
 *   - @transition (§2.15)
 *   - @computed
 *   - registry co lại khi item bị xoá thật (§2.18)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';
import StressPage from '../fixtures/stress/index';
import StressUserCard from '../fixtures/stress/usercard';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

/** Layout tối thiểu cung cấp outlet 'workspace' mà view stress @extends vào. */
function workspaceLayout() {
    return () => {
        const v = new View('web.layouts.workspace', 'layout');
        v.__ctrl__.setup({
            superView: null, data: {},
            commitConstructorData() {}, updateVariableData() {}, prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('ws', 'main', p, { attrs: { id: { type: 'static', value: 'ws' } } },
                        (p2: any) => [this.blockOutlet('ob-workspace', 'workspace', p2)]),
                ]);
            },
        } as any);
        return v;
    };
}

let container: HTMLElement;
let vm: ViewManager;
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
/**
 * Chờ tới khi DOM ổn định. Cần vì `@transition` GIỮ node đang leave lại cho tới
 * khi animation xong — trong cửa sổ đó số hàng là tổng (cũ + mới), không phải
 * trạng thái cuối. Đếm ngay sau 1 frame sẽ ra số trung gian.
 */
async function settle(maxFrames = 12) {
    let prev = -1;
    for (let i = 0; i < maxFrames; i++) {
        await frame();
        const n = container.querySelectorAll('.stress__row').length;
        if (n === prev) return;
        prev = n;
    }
}
const rows = () => Array.from(container.querySelectorAll('.stress__row'));
const ctrl = () => vm.getCurrentView()!.__ctrl__ as any;

beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({
        container,
        systemData: { __layout__: 'web.layouts.', __base__: 'web.' },
        registry: {
            'web.layouts.workspace': workspaceLayout(),
            'web.modules.stress.index': StressPage,
            'web.modules.stress.usercard': StressUserCard,
        },
    });
    await vm.mountView('web.modules.stress.index', {}, { $urlPath: '/stress' } as any);
    await settle();
});

afterEach(() => {
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
    MarkerRegistry.clear();
    document.body.innerHTML = '';
});

describe('view stress — output compiler thật', () => {
    it('render đủ danh sách, component con và loop lồng', () => {
        expect(rows().length).toBe(3);
        // @include mỗi hàng → usercard render tên + email
        expect(container.textContent).toContain('Mai Lan');
        expect(container.textContent).toContain('bao@saola.dev');
        // @foreach lồng: roles
        expect(container.textContent).toContain('admin');
        expect(container.textContent).toContain('viewer');
        // @if trong loop: user 3 không có role
        expect(container.textContent).toContain('chưa có vai trò');
        // @foreach KHÔNG @key
        expect(container.querySelectorAll('.chip--tag').length).toBe(4);
    });

    it('@computed tính đúng và cập nhật theo state', async () => {
        expect(container.textContent).toContain('2/3');   // activeCount/users.length
        expect(container.textContent).toContain('3 vai trò');

        ctrl().states.__.setters.users(
            ctrl().states.__.getStateByKey('users').filter((u: any) => u.id !== 1)
        );
        await frame();
        expect(container.textContent).toContain('1/2');
        expect(container.textContent).toContain('1 vai trò');
    });

    it('REFRESH TỪ SERVER: ref mới + id cũ → view con vẫn còn và cập nhật', async () => {
        expect(container.textContent).toContain('rev 1');

        // Đây là đường từng làm view con của @include biến mất (§2.10)
        (vm.getCurrentView() as any).refreshFromServer();
        await settle();

        expect(rows().length).toBe(3);
        expect(container.querySelectorAll('.ucard').length).toBe(3);  // KHÔNG biến mất
        expect(container.textContent).toContain('rev 2');
        expect(container.textContent).not.toContain('rev 1');
        expect(container.textContent).toContain('Mai Lan');
    });

    it('refresh nhiều lần: registry không phình', async () => {
        const view: any = vm.getCurrentView();
        view.refreshFromServer();
        await settle();
        const baseline = ctrl().elements.size;

        for (let i = 0; i < 6; i++) { view.refreshFromServer(); await settle(); }

        expect(ctrl().elements.size).toBe(baseline);
        expect(rows().length).toBe(3);
        expect(container.textContent).toContain('rev 8');
    });

    it('.stop — nút xoá không kích hoạt click của hàng', async () => {
        const row = rows()[0] as HTMLElement;
        const del = row.querySelector('.stress__del') as HTMLElement;

        del.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await settle();

        expect(rows().length).toBe(2);                       // đã xoá
        expect(ctrl().states.__.getStateByKey('selectedId')).toBe(0);  // KHÔNG select
    });

    it('.once — nút chỉ chạy một lần', async () => {
        const btns = Array.from(container.querySelectorAll('button'));
        const once = btns.find(b => b.textContent?.includes('Chỉ chạy 1 lần')) as HTMLElement;

        once.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        expect(container.textContent).toContain('hết lượt');

        ctrl().states.__.setters.banner('');
        await frame();
        once.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        expect(container.textContent).not.toContain('hết lượt');   // không chạy lại
    });

    it('.prevent — submit form không reload', async () => {
        const form = container.querySelector('form') as HTMLFormElement;
        ctrl().states.__.setters.query('Mai');
        await frame();

        const ev = new Event('submit', { cancelable: true, bubbles: true });
        form.dispatchEvent(ev);
        await settle();

        expect(ev.defaultPrevented).toBe(true);
        expect(rows().length).toBe(1);                      // đã lọc
    });

    it('.self — bấm trong hộp modal không đóng, bấm nền thì đóng', async () => {
        (vm.getCurrentView() as any).openModal();
        await frame();

        const backdrop = container.querySelector('.stress__backdrop') as HTMLElement;
        const modal = container.querySelector('.stress__modal') as HTMLElement;
        expect(backdrop).not.toBeNull();

        modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        expect(ctrl().states.__.getStateByKey('modalOpen')).toBe(true);   // vẫn mở

        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await frame();
        expect(ctrl().states.__.getStateByKey('modalOpen')).toBe(false);  // đã đóng
    });

    it('@transition — hàng bị xoá NẰM LẠI trong lúc leave rồi mới biến mất', async () => {
        expect(rows().length).toBe(3);
        const doomed = rows()[0] as HTMLElement;

        // Cửa sổ enter quá ngắn để quan sát ổn định trong jsdom (không có
        // getAnimations → hoàn tất ngay). Leave thì quan sát được: node phải
        // CÒN trong DOM ngay sau khi bị xoá, và mang class leave.
        (vm.getCurrentView() as any).removeUser(1);
        await frame();

        expect(doomed.isConnected).toBe(true);
        expect(doomed.className).toMatch(/row-leave-(from|active|to)/);

        await settle();
        expect(doomed.isConnected).toBe(false);
        expect(rows().length).toBe(2);
    });
});
