/**
 * SSR Hydration tests — Phase 6
 *
 * Kiểm tra flow hydration end-to-end:
 *   1. Server render HTML (Blade) → client nhận DOM có sẵn
 *   2. Client gọi hydrateView() với __SSR_VIEW_ID__
 *   3. Html elements CLAIM server DOM nodes (không tạo mới)
 *   4. Output elements CLAIM server markers + text nodes
 *   5. Event handlers và reactive subscriptions gắn vào DOM đã có
 *   6. Sau hydrate, state thay đổi → DOM cập nhật reactive
 *
 * Tham chiếu: RUNTIME_CONTRACT.md §hydration, Html.ts §constructor
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Html } from '../../src/core/elements/Html';
import { View } from '../../src/core/view/View';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';
import { InitModes } from '../../src/core/contracts/common';

// ─── Global singletons ───────────────────────────────────────────────────────

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Tạo server-rendered HTML giống Blade output.
 * Blade emit: @class([$__VIEW_ID__ . '-{id}', 'extra-class'])
 */
function buildSSRHtml(viewId: string): HTMLElement {
    const container = document.createElement('div');
    container.innerHTML = `
        <div class="${viewId}-root-div wrapper-class">
            <h1 class="${viewId}-title-el heading">Hello from SSR</h1>
            <p class="${viewId}-para-el content">SSR paragraph</p>
            <ul class="${viewId}-list-el list">
                <li class="${viewId}-item-0 item">Item 0</li>
                <li class="${viewId}-item-1 item">Item 1</li>
            </ul>
        </div>
    `.trim();
    return container;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Html.constructor — unit tests cho hydration claim
// ═══════════════════════════════════════════════════════════════════════════════

describe('Html constructor — SSR hydration', () => {

    it('claim server DOM node bằng class {viewId}-{id} trong parentElement', () => {
        const viewId = 'v-test01';
        const container = buildSSRHtml(viewId);
        document.body.appendChild(container);

        const mockParent = {
            element: container,
            getElement: () => container,
        } as any;

        const mockCtx = {
            viewId,
            states: { __: { subscribe: () => () => {}, getStateByKey: () => null } },
            addEventListener: () => {},
        } as any;

        const html = new Html({
            ctx: mockCtx,
            id: 'root-div',
            tagName: 'div',
            parentElement: mockParent,
            initMode: InitModes.HYDRATE,
            config: {},
        });

        // Phải claim ĐÚNG element từ SSR — cùng reference, không phải copy
        const expected = container.querySelector(`div.${viewId}-root-div`);
        expect(html.element).toBe(expected);
        expect(html.element.classList.contains('wrapper-class')).toBe(true);

        document.body.removeChild(container);
    });

    it('claim element theo tagName + class (không nhầm sang element khác)', () => {
        const viewId = 'v-test02';
        const container = buildSSRHtml(viewId);
        document.body.appendChild(container);

        const mockParent = { element: container, getElement: () => container } as any;
        const mockCtx = {
            viewId,
            states: { __: { subscribe: () => () => {}, getStateByKey: () => null } },
            addEventListener: () => {},
        } as any;

        const h1 = new Html({
            ctx: mockCtx,
            id: 'title-el',
            tagName: 'h1',
            parentElement: mockParent,
            initMode: InitModes.HYDRATE,
            config: {},
        });

        expect(h1.element.tagName.toLowerCase()).toBe('h1');
        expect(h1.element.textContent?.trim()).toBe('Hello from SSR');

        document.body.removeChild(container);
    });

    it('partial hydration: element không có trong SSR → tạo mới thay vì throw', () => {
        const viewId = 'v-test03';
        const container = buildSSRHtml(viewId);
        document.body.appendChild(container);

        const mockParent = { element: container, getElement: () => container } as any;
        const mockCtx = {
            viewId,
            states: { __: { subscribe: () => () => {}, getStateByKey: () => null } },
            addEventListener: () => {},
        } as any;

        const html = new Html({
            ctx: mockCtx,
            id: 'non-existent-id',
            tagName: 'div',
            parentElement: mockParent,
            initMode: InitModes.HYDRATE,
            config: {},
        });

        // Fallback: element mới được tạo (không crash)
        expect(html.element).toBeDefined();
        expect(html.element).not.toBeNull();
        expect(html.element.classList.contains('non-existent-id')).toBe(true);

        document.body.removeChild(container);
    });

    it('không claim nhầm element của view khác (cross-view isolation)', () => {
        const viewId1 = 'v-view1';
        const viewId2 = 'v-view2';

        const container1 = document.createElement('div');
        container1.innerHTML = `<div class="${viewId1}-card-el card">View 1 Card</div>`;
        const container2 = document.createElement('div');
        container2.innerHTML = `<div class="${viewId2}-card-el card">View 2 Card</div>`;

        document.body.appendChild(container1);
        document.body.appendChild(container2);

        const mockCtx1 = {
            viewId: viewId1,
            states: { __: { subscribe: () => () => {}, getStateByKey: () => null } },
            addEventListener: () => {},
        } as any;

        const html1 = new Html({
            ctx: mockCtx1,
            id: 'card-el',
            tagName: 'div',
            parentElement: { element: container1, getElement: () => container1 } as any,
            initMode: InitModes.HYDRATE,
            config: {},
        });

        // Phải claim view1, không phải view2
        expect(html1.element.textContent).toBe('View 1 Card');

        document.body.removeChild(container1);
        document.body.removeChild(container2);
    });

    it('CSR mode (create): vẫn tạo element mới bình thường', () => {
        const mockCtx = {
            viewId: 'v-csr01',
            states: { __: { subscribe: () => () => {}, getStateByKey: () => null } },
            addEventListener: () => {},
        } as any;

        const html = new Html({
            ctx: mockCtx,
            id: 'fresh-div',
            tagName: 'div',
            parentElement: null,
            initMode: InitModes.CREATE,
            config: {},
        });

        expect(html.element.tagName.toLowerCase()).toBe('div');
        expect(html.element.classList.contains('fresh-div')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ViewManager.hydrateView — integration tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('ViewManager.hydrateView', () => {
    let container: HTMLElement;
    let vm: ViewManager;
    const SSR_VIEW_ID = 'vssr-abc12';

    /**
     * Factory cho view có state reactive — dùng để test rằng
     * sau hydrate, click event vẫn hoạt động và Output vẫn cập nhật.
     */
    function makeHydrateFactory() {
        return () => {
            const view = new View('web.hydrate-test', 'view');
            const ctrl = view.__ctrl__;
            const __STATE__ = ctrl.states;

            const set$count = __STATE__.__.register('count');
            let count: any = null;
            const setCount = (s: any) => { count = s; set$count(s); };
            __STATE__.__.setters.setCount = setCount;

            const lockUpdateRealState = () => __STATE__.__.lockUpdateRealState();
            const update$count = (v: any) => {
                if (__STATE__.__.canUpdateStateByKey) {
                    __STATE__.__.updateStateByKey('count', v);
                    count = v;
                }
            };

            ctrl.setUserDefinedConfig({
                increment() { setCount(count + 1); },
            });

            ctrl.setup({
                superView: null,
                data: {},
                commitConstructorData() {
                    update$count(0);
                    lockUpdateRealState();
                },
                updateVariableData() {},
                prerender() { return null; },
                render(this: any) {
                    return this.wrapper((p: any) => [
                        this.html('page-root', 'div', p,
                            { attrs: { id: { type: 'static', value: 'hydrated-page' } } },
                            (p2: any) => [
                                this.html('title-h1', 'h1', p2, {}, (p3: any) => [
                                    this.text('Count: '),
                                    this.output('count-out', p3, true, ['count'], () => count),
                                ]),
                                this.html('inc-btn', 'button', p2, {
                                    events: { click: [{ handler: 'increment', params: [] }] },
                                }, (p3: any) => [this.text('+')]),
                            ]),
                    ]);
                },
            } as any);
            return view;
        };
    }

    beforeEach(() => {
        container = document.createElement('div');

        // ── Mô phỏng server-rendered HTML (format chuẩn §5.1) ─────────────
        // Blade emit:
        //   - view boundary: <!--s:v:viewId-s--> ... <!--s:v:viewId-e-->
        //   - class="$__VIEW_ID__-{elementId}" trên mỗi element
        //   - Output markers: <!--s:o:viewId-{id}-s--> ... <!--s:o:viewId-{id}-e-->
        container.innerHTML = `
            <!--s:v:${SSR_VIEW_ID}-s-->
            <div class="${SSR_VIEW_ID}-page-root" id="hydrated-page">
                <h1 class="${SSR_VIEW_ID}-title-h1">Count: <!--s:o:${SSR_VIEW_ID}-count-out-s-->0<!--s:o:${SSR_VIEW_ID}-count-out-e--></h1>
                <button class="${SSR_VIEW_ID}-inc-btn">+</button>
            </div>
            <!--s:v:${SSR_VIEW_ID}-e-->
        `;

        document.body.appendChild(container);

        vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({ container, registry: { 'web.hydrate-test': makeHydrateFactory() } });
    });

    afterEach(() => {
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
        document.body.innerHTML = '';
    });

    const frame = () => new Promise<void>(r =>
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );

    const semanticSnapshot = (scope: HTMLElement) =>
        Array.from(scope.querySelectorAll('#hydrated-page, #hydrated-page *')).map((element) => ({
            tag: element.tagName.toLowerCase(),
            id: element.id || null,
            // Blade template indentation may introduce inter-element whitespace;
            // semantic comparison intentionally ignores formatting-only spaces.
            text: (element.textContent ?? '').replace(/\s+/g, ''),
            children: element.children.length,
        }));

    it('hydrateView thành công — trả về kết quả không null', async () => {
        const result = await vm.hydrateView(
            'web.hydrate-test',
            { __SSR_VIEW_ID__: SSR_VIEW_ID },
        );
        expect(result).not.toBeNull();
    });

    it('không có __SSR_VIEW_ID__ → fallback mountView (không crash)', async () => {
        const result = await vm.hydrateView(
            'web.hydrate-test',
            { __SSR_VIEW_ID__: '' } as any,
        );
        expect(result).not.toBeNull();
    });

    it('view không tồn tại → trả về null, không crash', async () => {
        const result = await vm.hydrateView(
            'web.non-existent',
            { __SSR_VIEW_ID__: SSR_VIEW_ID },
        );
        expect(result).toBeNull();
    });

    it('Html claim đúng server DOM node — cùng reference, không tạo mới', async () => {
        // Lưu reference SSR node TRƯỚC hydrate
        const ssrPageRoot = container.querySelector(`.${SSR_VIEW_ID}-page-root`)!;
        const ssrH1 = container.querySelector(`.${SSR_VIEW_ID}-title-h1`)!;
        const ssrBtn = container.querySelector(`.${SSR_VIEW_ID}-inc-btn`)!;

        expect(ssrPageRoot).not.toBeNull();
        expect(ssrH1).not.toBeNull();
        expect(ssrBtn).not.toBeNull();

        await vm.hydrateView('web.hydrate-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });

        // SAU hydrate: SSR nodes phải vẫn là CÙNG element (claimed, không tạo mới)
        const afterPageRoot = container.querySelector('#hydrated-page');
        expect(afterPageRoot).toBe(ssrPageRoot);

        // Không có element mới bị duplicate
        const allH1 = container.querySelectorAll('h1');
        expect(allH1.length).toBe(1);
    });

    it('Blade fixture hydrate và CSR từ cùng view factory có DOM semantic tương đương', async () => {
        await vm.hydrateView('web.hydrate-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });
        const hydratedSnapshot = semanticSnapshot(container);

        const csrContainer = document.createElement('div');
        document.body.appendChild(csrContainer);
        const csrVm = new ViewManager(app() as any);
        csrVm.setApp(app() as any);
        csrVm.init({
            container: csrContainer,
            registry: { 'web.hydrate-test': makeHydrateFactory() },
        });
        await csrVm.mountView('web.hydrate-test', {});

        expect(semanticSnapshot(csrContainer)).toEqual(hydratedSnapshot);
    });

    it('Output claim SSR markers — text node giữa markers được giữ nguyên', async () => {
        // SSR HTML có markers: <!--s:o:...-s-->0<!--s:o:...-e-->
        const ssrH1 = container.querySelector('h1')!;
        const ssrComments = Array.from(ssrH1.childNodes)
            .filter(n => n.nodeType === Node.COMMENT_NODE);

        // Phải có 2 comment markers từ SSR
        expect(ssrComments.length).toBe(2);

        await vm.hydrateView('web.hydrate-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });

        // Sau hydrate, text "0" vẫn hiển thị (commitData set count=0)
        expect(ssrH1.textContent).toContain('0');

        // CLAIM thật sự: vẫn đúng 2 output marker (không fallback tạo marker mới).
        // Nếu shortcut lệch (s:output: vs s:o:) → claim fail → fallback → 4 markers.
        const outOpen = `s:o:${SSR_VIEW_ID}-count-out-s`;
        const outClose = `s:o:${SSR_VIEW_ID}-count-out-e`;
        const outComments = Array.from(ssrH1.childNodes).filter(n =>
            n.nodeType === Node.COMMENT_NODE &&
            (n.nodeValue?.trim() === outOpen || n.nodeValue?.trim() === outClose));
        expect(outComments.length).toBe(2);
    });

    it('Wrapper claim view markers — không tạo view marker mới', async () => {
        // Đếm view markers (<!--s:v:id-s--> / <!--s:v:id-e-->) TRƯỚC hydrate
        const countViewMarkers = () =>
            Array.from(container.childNodes).filter(n =>
                n.nodeType === Node.COMMENT_NODE &&
                (n.nodeValue?.trim() === `s:v:${SSR_VIEW_ID}-s` ||
                 n.nodeValue?.trim() === `s:v:${SSR_VIEW_ID}-e`)
            ).length;

        expect(countViewMarkers()).toBe(2);

        await vm.hydrateView('web.hydrate-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });

        // Sau hydrate: vẫn đúng 2 view markers (claimed, không nhân đôi)
        expect(countViewMarkers()).toBe(2);
    });

    it('event handlers hoạt động sau hydrate — click → state → DOM update', async () => {
        await vm.hydrateView('web.hydrate-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });

        const btn = container.querySelector('button')!;
        expect(btn).not.toBeNull();

        // Click increment → count = 1
        btn.click();
        await frame();

        // Output phải cập nhật từ "0" → "1"
        const h1 = container.querySelector('h1')!;
        expect(h1.textContent).toContain('1');
    });

    it('state commitData đồng bộ — giá trị ban đầu đúng sau hydrate', async () => {
        await vm.hydrateView('web.hydrate-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });

        const ctrl = vm.getCurrentView()!.__ctrl__;
        expect(ctrl.states.__.getStateByKey('count')).toBe(0);
        expect(ctrl.states.__.canUpdateStateByKey).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Reactive hydration — @if/@else claim markers + toggle sau hydrate
// ═══════════════════════════════════════════════════════════════════════════════

describe('Reactive hydration — @if', () => {
    let container: HTMLElement;
    let vm: ViewManager;
    const SSR_VIEW_ID = 'vssr-rif01';
    const REACTIVE_ID = 'r-if-show';

    /**
     * Factory có @if(show):
     *   - show = true → render <p class="msg">Visible</p>
     *   - show = false → render nothing
     * SSR render trạng thái show=true.
     */
    function makeReactiveFactory() {
        return () => {
            const view = new View('web.reactive-test', 'view');
            const ctrl = view.__ctrl__;
            const __STATE__ = ctrl.states;

            const set$show = __STATE__.__.register('show');
            let show: any = null;
            const setShow = (s: any) => { show = s; set$show(s); };
            __STATE__.__.setters.setShow = setShow;

            const lockUpdateRealState = () => __STATE__.__.lockUpdateRealState();
            const update$show = (v: any) => {
                if (__STATE__.__.canUpdateStateByKey) {
                    __STATE__.__.updateStateByKey('show', v);
                    show = v;
                }
            };

            ctrl.setUserDefinedConfig({
                toggle() { setShow(!show); },
            });

            ctrl.setup({
                superView: null,
                data: {},
                commitConstructorData() {
                    update$show(true);
                    lockUpdateRealState();
                },
                updateVariableData() {},
                prerender() { return null; },
                render(this: any) {
                    return this.wrapper((p: any) => [
                        this.html('wrap', 'div', p, {}, (p2: any) => [
                            this.reactive(REACTIVE_ID, 'if', null, p2, ['show'], () => {
                                if (show) {
                                    return [
                                        this.html('msg', 'p', p2, {}, () => [
                                            this.text('Visible'),
                                        ]),
                                    ];
                                }
                                return [];
                            }),
                            this.html('toggle-btn', 'button', p2, {
                                events: { click: [{ handler: 'toggle', params: [] }] },
                            }, () => [this.text('Toggle')]),
                        ]),
                    ]);
                },
            } as any);
            return view;
        };
    }

    beforeEach(() => {
        container = document.createElement('div');
        // SSR HTML: @if(show) active → <p> rendered, wrapped in reactive markers
        // Format chuẩn §5.1: <!--s:r:{viewId}-{id}-s--> ... <!--s:r:{viewId}-{id}-e-->
        // Server prefix viewId cho mọi marker non-view → id = ${SSR_VIEW_ID}-${REACTIVE_ID}
        container.innerHTML = `
            <div class="${SSR_VIEW_ID}-wrap">
                <!--s:r:${SSR_VIEW_ID}-${REACTIVE_ID}-s-->
                <p class="${SSR_VIEW_ID}-msg">Visible</p>
                <!--s:r:${SSR_VIEW_ID}-${REACTIVE_ID}-e-->
                <button class="${SSR_VIEW_ID}-toggle-btn">Toggle</button>
            </div>
        `;
        document.body.appendChild(container);

        vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({ container, registry: { 'web.reactive-test': makeReactiveFactory() } });
    });

    afterEach(() => {
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
        document.body.innerHTML = '';
    });

    const frame = () => new Promise<void>(r =>
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );

    it('hydrateView thành công với Reactive @if', async () => {
        const result = await vm.hydrateView(
            'web.reactive-test',
            { __SSR_VIEW_ID__: SSR_VIEW_ID },
        );
        expect(result).not.toBeNull();
    });

    it('Reactive claim SSR markers — không tạo markers mới', async () => {
        // Đếm comment nodes TRƯỚC hydrate
        const commentsBefore = Array.from(container.querySelectorAll('div')[0].childNodes)
            .filter(n => n.nodeType === Node.COMMENT_NODE);
        expect(commentsBefore.length).toBe(2);

        await vm.hydrateView('web.reactive-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });

        // SAU hydrate: vẫn chỉ 2 comment markers (claimed, không thêm mới)
        const commentsAfter = Array.from(container.querySelectorAll('div')[0].childNodes)
            .filter(n => n.nodeType === Node.COMMENT_NODE);
        expect(commentsAfter.length).toBe(2);
    });

    it('Html trong Reactive claim đúng server DOM — cùng reference', async () => {
        const ssrP = container.querySelector('p')!;
        expect(ssrP).not.toBeNull();
        expect(ssrP.textContent).toBe('Visible');

        await vm.hydrateView('web.reactive-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });

        // <p> vẫn là cùng element (claimed, không tạo mới)
        const afterP = container.querySelector('p')!;
        expect(afterP).toBe(ssrP);
    });

    it('toggle show→false: Reactive clear nội dung giữa markers', async () => {
        await vm.hydrateView('web.reactive-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });

        // Click toggle → show = false
        const btn = container.querySelector('button')!;
        btn.click();
        await frame();

        // <p> phải bị xoá
        expect(container.querySelector('p')).toBeNull();
        // Button vẫn còn
        expect(container.querySelector('button')).not.toBeNull();
    });

    it('toggle false→true: Reactive render lại nội dung', async () => {
        await vm.hydrateView('web.reactive-test', { __SSR_VIEW_ID__: SSR_VIEW_ID });

        const btn = container.querySelector('button')!;

        // Toggle off
        btn.click();
        await frame();
        expect(container.querySelector('p')).toBeNull();

        // Toggle on
        btn.click();
        await frame();
        const p = container.querySelector('p')!;
        expect(p).not.toBeNull();
        expect(p.textContent).toBe('Visible');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Layout chain hydration — @extends + @block/@useBlock (Phase 6.2.5)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Layout chain hydration — @extends + BlockOutlet', () => {
    let container: HTMLElement;
    let vm: ViewManager;
    const LAYOUT_ID = 'vssr-lay01';   // viewId của layout (cố định trong test)
    const PAGE_ID = 'vssr-pag01';     // viewId của page (= __SSR_VIEW_ID__)

    /**
     * Layout: <div class="container"> @useBlock('content') </div>
     * BlockOutlet là slot rỗng — nội dung do page cấp qua BlockManager.
     */
    function makeLayoutFactory() {
        return () => {
            const view = new View('web.layout', 'view');
            const ctrl = view.__ctrl__;
            ctrl.setUserDefinedConfig({});
            // KHÔNG set viewId — mô phỏng server tự sinh: client phải DISCOVER
            // LAYOUT_ID từ DOM view marker (extendView không truyền viewId layout).
            ctrl.setup({
                superView: null,
                data: {},
                commitConstructorData() {},
                updateVariableData() {},
                prerender() { return null; },
                render(this: any) {
                    return this.wrapper((p: any) => [
                        this.html('container', 'div', p, {}, (p2: any) => [
                            this.blockOutlet('content-bo', 'content', p2),
                        ]),
                    ]);
                },
            } as any);
            return view;
        };
    }

    /**
     * Page: @extends('web.layout'), @block('content') chứa state count + button.
     * render() KHÔNG có wrapper — đăng ký block rồi return extendView(layout).
     */
    function makePageFactory() {
        return () => {
            const view = new View('web.page', 'view');
            const ctrl = view.__ctrl__;
            const __STATE__ = ctrl.states;

            const set$count = __STATE__.__.register('count');
            let count: any = null;
            const setCount = (s: any) => { count = s; set$count(s); };
            __STATE__.__.setters.setCount = setCount;
            const update$count = (v: any) => {
                if (__STATE__.__.canUpdateStateByKey) {
                    __STATE__.__.updateStateByKey('count', v);
                    count = v;
                }
            };

            ctrl.setUserDefinedConfig({
                increment() { setCount(count + 1); },
            });

            ctrl.setup({
                superView: 'web.layout',
                data: {},
                commitConstructorData() {
                    update$count(0);
                    __STATE__.__.lockUpdateRealState();
                },
                updateVariableData() {},
                prerender() { return null; },
                render(this: any) {
                    this.block('blk-content', 'content', (parentElement: any) => [
                        this.html('block-root', 'div', parentElement,
                            { attrs: { id: { type: 'static', value: 'page-block' } } },
                            (p: any) => [
                                this.html('h2', 'h2', p, {}, (p2: any) => [
                                    this.text('Count: '),
                                    this.output('cnt-out', p2, true, ['count'], () => count),
                                ]),
                                this.html('btn', 'button', p, {
                                    events: { click: [{ handler: 'increment', params: [] }] },
                                }, () => [this.text('+')]),
                            ]),
                    ]);
                    this.superViewPath = 'web.layout';
                    return this.extendView(this.superViewPath, {});
                },
            } as any);
            return view;
        };
    }

    beforeEach(() => {
        container = document.createElement('div');
        // SSR: layout view markers + container + outlet markers + block content (page-rendered)
        container.innerHTML = `
            <!--s:v:${LAYOUT_ID}-s-->
            <div class="${LAYOUT_ID}-container">
                <!--s:bo:${LAYOUT_ID}-content-bo-s-->
                <div class="${PAGE_ID}-block-root" id="page-block">
                    <h2 class="${PAGE_ID}-h2">Count: <!--s:o:${PAGE_ID}-cnt-out-s-->0<!--s:o:${PAGE_ID}-cnt-out-e--></h2>
                    <button class="${PAGE_ID}-btn">+</button>
                </div>
                <!--s:bo:${LAYOUT_ID}-content-bo-e-->
            </div>
            <!--s:v:${LAYOUT_ID}-e-->
        `;
        document.body.appendChild(container);

        vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({
            container,
            registry: {
                'web.layout': makeLayoutFactory(),
                'web.page': makePageFactory(),
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

    it('hydrateView layout chain — trả về kết quả không null, có superView', async () => {
        const result = await vm.hydrateView('web.page', { __SSR_VIEW_ID__: PAGE_ID });
        expect(result).not.toBeNull();
        expect(result.superView).not.toBeNull();
    });

    it('BlockOutlet claim marker — không nhân đôi', async () => {
        const countBo = () =>
            Array.from(container.querySelectorAll('div')[0]?.childNodes ?? [])
                .filter(n => n.nodeType === Node.COMMENT_NODE &&
                    (n.nodeValue?.trim() === `s:bo:${LAYOUT_ID}-content-bo-s` ||
                     n.nodeValue?.trim() === `s:bo:${LAYOUT_ID}-content-bo-e`)).length;
        expect(countBo()).toBe(2);

        await vm.hydrateView('web.page', { __SSR_VIEW_ID__: PAGE_ID });

        expect(countBo()).toBe(2);
    });

    it('block content claim đúng server DOM — cùng reference, không tạo mới', async () => {
        const ssrBlockRoot = container.querySelector('#page-block')!;
        const ssrButton = container.querySelector('button')!;
        expect(ssrBlockRoot).not.toBeNull();

        await vm.hydrateView('web.page', { __SSR_VIEW_ID__: PAGE_ID });

        // Cùng reference (claimed), không duplicate
        expect(container.querySelector('#page-block')).toBe(ssrBlockRoot);
        expect(container.querySelector('button')).toBe(ssrButton);
        expect(container.querySelectorAll('button').length).toBe(1);
        expect(container.querySelectorAll('h2').length).toBe(1);
    });

    it('Output trong block hiển thị "0" sau hydrate', async () => {
        await vm.hydrateView('web.page', { __SSR_VIEW_ID__: PAGE_ID });
        const h2 = container.querySelector('h2')!;
        expect(h2.textContent).toContain('0');
    });

    it('event trong block hoạt động sau hydrate — click → state → Output update', async () => {
        await vm.hydrateView('web.page', { __SSR_VIEW_ID__: PAGE_ID });

        const btn = container.querySelector('button')!;
        btn.click();
        await frame();

        const h2 = container.querySelector('h2')!;
        expect(h2.textContent).toContain('1');
    });

    it('page state commitData đồng bộ — count = 0 sau hydrate', async () => {
        await vm.hydrateView('web.page', { __SSR_VIEW_ID__: PAGE_ID });
        const ctrl = vm.getCurrentView()!.__ctrl__;
        expect(ctrl.states.__.getStateByKey('count')).toBe(0);
    });
});
