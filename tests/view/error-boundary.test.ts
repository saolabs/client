/**
 * Error boundary (GAP-03) — `onError` cô lập lỗi theo cây view thay vì để
 * exception xoá trắng container qua ViewManager.showError().
 *
 * Bất biến kiểm ở đây:
 *   1. @include con throw → chỉ subtree đó thành fallback, phần còn lại sống
 *   2. reactive re-render throw (sau tương tác) → chỉ vùng đó fallback
 *   3. boundary lồng nhau → boundary GẦN NHẤT thắng
 *   4. onError trả undefined → coi như không xử lý, bubble lên boundary cha
 *   5. onError tự throw → bỏ qua boundary đó, bubble tiếp (không lặp vô hạn)
 *   6. không boundary nào → giữ nguyên hành vi cũ (bubble → showError)
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
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Child view luôn throw trong render(). */
function makeExplodingChildFactory() {
    return () => {
        const view = new View('partials.boom', 'view');
        view.__ctrl__.setup({
            superView: null,
            data: {},
            render: function () { throw new Error('child render failed'); },
        } as any);
        return view;
    };
}

/** Page có @include('partials.boom') + nội dung tĩnh cạnh đó. */
function makeHostFactory(onError?: any) {
    return () => {
        const view = new View('web.host', 'view');
        view.__ctrl__.setup({
            superView: null,
            data: {},
            onError,
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('host', 'div', parent, {}, (p: any) => [
                        this.html('sibling', 'p', p, {}, () => [this.text('SIBLING OK')]),
                        this.include('cpn-1', 'partials.boom', p, [], () => ({})),
                    ]),
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

describe('Error boundary — @include con throw', () => {
    it('chỉ subtree lỗi thành fallback; sibling và phần còn lại vẫn sống', async () => {
        const onError = vi.fn(function (this: any) {
            return [this.__ctrl__.text('FALLBACK')];
        });
        const { vm, container } = createManager({
            'web.host': makeHostFactory(onError),
            'partials.boom': makeExplodingChildFactory(),
        });

        await vm.mountView('web.host', {}, route('/host'));

        expect(onError).toHaveBeenCalledTimes(1);
        expect(container.textContent).toContain('FALLBACK');
        expect(container.textContent).toContain('SIBLING OK');
        // Không rơi vào showError (nó sẽ ghi đè cả container bằng khối "Error")
        expect(container.querySelector('h2')).toBeNull();
        expect(vm.getCurrentView()?.__ctrl__.lifecycleState).toBe('active');
    });

    it('info mang phase="render" và path của view NƠI lỗi xảy ra', async () => {
        let captured: any = null;
        const onError = vi.fn(function (this: any, _err: unknown, info: any) {
            captured = info;
            return [this.__ctrl__.text('FALLBACK')];
        });
        const { vm } = createManager({
            'web.host': makeHostFactory(onError),
            'partials.boom': makeExplodingChildFactory(),
        });

        await vm.mountView('web.host', {}, route('/host'));

        expect(captured).toEqual({ phase: 'render', path: 'partials.boom' });
    });

    it('onError trả undefined → coi như KHÔNG xử lý, lỗi bubble tiếp', async () => {
        const onError = vi.fn(() => undefined);
        const { vm, container } = createManager({
            'web.host': makeHostFactory(onError),
            'partials.boom': makeExplodingChildFactory(),
        });

        await vm.mountView('web.host', {}, route('/host'));

        expect(onError).toHaveBeenCalled();
        // Bubble tới renderPageView → showError ghi đè container
        expect(container.querySelector('h2')?.textContent).toBe('Error');
    });

    it('onError tự throw → bỏ qua boundary đó, không lặp vô hạn', async () => {
        const onError = vi.fn(() => { throw new Error('boundary itself failed'); });
        const { vm, container } = createManager({
            'web.host': makeHostFactory(onError),
            'partials.boom': makeExplodingChildFactory(),
        });

        await vm.mountView('web.host', {}, route('/host'));

        expect(onError).toHaveBeenCalledTimes(1); // KHÔNG gọi lại chính nó
        expect(container.querySelector('h2')?.textContent).toBe('Error');
    });

    it('không có boundary nào → giữ nguyên hành vi cũ (showError)', async () => {
        const { vm, container } = createManager({
            'web.host': makeHostFactory(undefined),
            'partials.boom': makeExplodingChildFactory(),
        });

        await vm.mountView('web.host', {}, route('/host'));

        expect(container.querySelector('h2')?.textContent).toBe('Error');
    });
});

describe('Error boundary — reactive re-render throw (sau khi trang đã sống)', () => {
    it('chỉ vùng reactive lỗi thành fallback, state/DOM còn lại vẫn hoạt động', async () => {
        const onError = vi.fn(function (this: any) {
            return [this.__ctrl__.text('REACTIVE FALLBACK')];
        });
        const factory = () => {
            const view = new View('web.reactive-boom', 'view');
            const ctrl = view.__ctrl__;
            const manager: any = ctrl.states.__;
            manager.useState(false, 'boom');

            ctrl.setup({
                superView: null,
                data: {},
                onError,
                render: function (this: any) {
                    return this.wrapper((parent: any) => [
                        this.html('root', 'div', parent, {}, (p: any) => [
                            this.html('static', 'p', p, {}, () => [this.text('STILL HERE')]),
                            this.reactive('rc-1', 'if', null, p, ['boom'], () => {
                                if (manager.states['boom'].value) throw new Error('reactive failed');
                                return [this.html('ok', 'span', p, {}, () => [this.text('OK')])];
                            }),
                        ]),
                    ]);
                },
            } as any);
            return view;
        };

        const { vm, container } = createManager({ 'web.reactive-boom': factory });
        await vm.mountView('web.reactive-boom', {}, route('/rb'));
        expect(container.textContent).toContain('OK');

        // Mô phỏng tương tác của user làm state đổi → re-render vùng reactive throw
        const ctrl = vm.getCurrentView()!.__ctrl__;
        ctrl.states.__.updateStateByKey('boom', true);
        await frame();

        expect(onError).toHaveBeenCalled();
        expect(onError.mock.calls[0][1]).toMatchObject({ phase: 'update' });
        expect(container.textContent).toContain('REACTIVE FALLBACK');
        expect(container.textContent).toContain('STILL HERE'); // phần còn lại nguyên vẹn
        expect(container.querySelector('h2')).toBeNull(); // không rơi vào showError
    });
});

describe('Error boundary — lỗi trong state-subscription callback', () => {
    /**
     * Mọi factory người dùng chạy trong callback subscribe (Output `{{ }}`,
     * TextElement, Html attr/class/style binding, computed mirror) đều nằm
     * trong vòng notify của StateManager.flushChanges — nơi có sẵn try/catch.
     * Nếu chỗ đó chỉ console.error thì lỗi bị NUỐT: DOM giữ giá trị cũ, boundary
     * không hề biết. Im lặng sai còn tệ hơn nổ.
     */
    it('Output factory throw khi state đổi → boundary ĐƯỢC báo (không nuốt im lặng)', async () => {
        const onError = vi.fn();
        const factory = () => {
            const view = new View('web.output-boom', 'view');
            const ctrl = view.__ctrl__;
            const manager: any = ctrl.states.__;
            manager.useState({ name: 'ok' }, 'user');

            ctrl.setup({
                superView: null,
                data: {},
                onError,
                render: function (this: any) {
                    return this.wrapper((parent: any) => [
                        this.html('root', 'div', parent, {}, (p: any) => [
                            // user.name — ném khi user thành null
                            this.output('o-name', p, true, ['user'],
                                () => manager.states['user'].value.name),
                        ]),
                    ]);
                },
            } as any);
            return view;
        };

        const { vm } = createManager({ 'web.output-boom': factory });
        await vm.mountView('web.output-boom', {}, route('/ob'));

        const ctrl = vm.getCurrentView()!.__ctrl__;
        ctrl.states.__.updateStateByKey('user', null); // → factory ném TypeError
        await frame();

        expect(onError).toHaveBeenCalled();
        expect(onError.mock.calls[0][1]).toMatchObject({ phase: 'update' });
    });

    it('không có boundary → vẫn log, không làm chết app', async () => {
        const factory = () => {
            const view = new View('web.output-boom2', 'view');
            const ctrl = view.__ctrl__;
            const manager: any = ctrl.states.__;
            manager.useState({ name: 'ok' }, 'user');
            ctrl.setup({
                superView: null,
                data: {},
                render: function (this: any) {
                    return this.wrapper((parent: any) => [
                        this.html('root', 'div', parent, {}, (p: any) => [
                            this.output('o-name', p, true, ['user'],
                                () => manager.states['user'].value.name),
                        ]),
                    ]);
                },
            } as any);
            return view;
        };

        const { vm, container } = createManager({ 'web.output-boom2': factory });
        await vm.mountView('web.output-boom2', {}, route('/ob2'));

        const ctrl = vm.getCurrentView()!.__ctrl__;
        ctrl.states.__.updateStateByKey('user', null);
        await frame();

        // App vẫn sống, state mới vẫn được ghi nhận
        expect(ctrl.lifecycleState).toBe('active');
        expect(container.querySelector('h2')).toBeNull();
    });
});

describe('Error boundary — lồng nhau', () => {
    it('boundary GẦN NHẤT thắng; boundary ngoài không bị gọi', async () => {
        const outerOnError = vi.fn(function (this: any) {
            return [this.__ctrl__.text('OUTER')];
        });
        const innerOnError = vi.fn(function (this: any) {
            return [this.__ctrl__.text('INNER')];
        });

        // middle chứa @include('partials.boom') và CÓ onError riêng
        const makeMiddleFactory = () => () => {
            const view = new View('partials.middle', 'view');
            view.__ctrl__.setup({
                superView: null,
                data: {},
                onError: innerOnError,
                render: function (this: any) {
                    return this.wrapper((parent: any) => [
                        this.html('mid', 'div', parent, {}, (p: any) => [
                            this.include('cpn-inner', 'partials.boom', p, [], () => ({})),
                        ]),
                    ]);
                },
            } as any);
            return view;
        };
        // outer chứa @include('partials.middle') và cũng có onError
        const makeOuterFactory = () => () => {
            const view = new View('web.outer', 'view');
            view.__ctrl__.setup({
                superView: null,
                data: {},
                onError: outerOnError,
                render: function (this: any) {
                    return this.wrapper((parent: any) => [
                        this.html('outer', 'div', parent, {}, (p: any) => [
                            this.include('cpn-mid', 'partials.middle', p, [], () => ({})),
                        ]),
                    ]);
                },
            } as any);
            return view;
        };

        const { vm, container } = createManager({
            'web.outer': makeOuterFactory(),
            'partials.middle': makeMiddleFactory(),
            'partials.boom': makeExplodingChildFactory(),
        });

        await vm.mountView('web.outer', {}, route('/outer'));

        expect(innerOnError).toHaveBeenCalledTimes(1);
        expect(outerOnError).not.toHaveBeenCalled();
        expect(container.textContent).toContain('INNER');
        expect(container.textContent).not.toContain('OUTER');
    });
});
