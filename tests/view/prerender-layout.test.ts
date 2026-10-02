/**
 * Reproduces: does the prerender→fetch→swap mechanism (ViewManager.renderPageView
 * Case 2) work for an @extends/@block page, the same as it does for a standalone
 * (this.wrapper(...)) page? ctrl.mainElement/preloadElement — what the swap logic
 * in ViewManager.ts acts on — are only ever set by ViewController.wrapper(), which
 * an @extends page never calls (it calls this.block(...) then returns
 * this.extendView(...)). This test proves whether that gap is real.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';

if (!app.has('Registry')) {
    app.instance('Registry', MarkerRegistry);
}

function makeLayoutFactory() {
    return () => {
        const view = new View('layouts.app', 'layout');
        view.__ctrl__.setup({
            superView: null,
            data: {},
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('l-main', 'main', parent, {}, (p: any) => [
                        this.blockOutlet('ob-content', 'content', p),
                        this.blockOutlet('ob-footer', 'footer', p),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

/** contentRenderFactory identities, so tests can tell which one ended up registered without needing to render/claim DOM. */
export const factoryRefs: { skeleton?: Function; realContent?: Function; footer?: Function } = {};

/**
 * Mirrors the shape real compiled output produces for @extends + @await + @block
 * (see compiler/examples/sao/await.sao).
 *
 * Fixture này VIẾT TAY nên nó mù với khâu sinh code: nó từng xanh suốt trong khi
 * compiler emit `this.section('footer', ..., () => '')` — block tĩnh biến mất khỏi
 * JS, SSR hiện footer còn CSR mất. Cổng giữ cho fixture khớp compiler thật là
 * compiler/tests/Unit/AwaitStaticBlockTest.php — sửa hình dạng ở đây thì sửa cả ở đó.
 */
function makeAwaitExtendsPageFactory() {
    return () => {
        const view = new View('web.slow', 'view');
        view.__ctrl__.setup({
            superView: 'layouts.app',
            data: {},
            hasAwaitData: true,
            hasPrerender: true,
            fetch: { url: '/slow' },
            prerender: function (this: any) {
                factoryRefs.skeleton = (parentElement: any) => [
                    this.html('skeleton', 'div', parentElement, {}, () => [this.text('LOADING')]),
                ];
                this.block('b-content', 'content', factoryRefs.skeleton);
                // Compiler puts blocks that DON'T depend on the awaited data
                // ONLY in prerender() — render() never re-declares them (see
                // examples/sao/await.sao's compiled block-footer).
                factoryRefs.footer = (parentElement: any) => [
                    this.html('footer-el', 'footer', parentElement, {}, () => [this.text('Copyright 2026')]),
                ];
                this.block('b-footer', 'footer', factoryRefs.footer);
                return this.extendView('layouts.app');
            },
            render: function (this: any) {
                factoryRefs.realContent = (parentElement: any) => [
                    this.html('real', 'div', parentElement, {}, () => [this.text('REAL CONTENT')]),
                ];
                this.block('b-content', 'content', factoryRefs.realContent);
                return this.extendView('layouts.app');
            },
        } as any);
        return view;
    };
}

function createManager() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm); // extendView resolves via App.View
    vm.init({
        container,
        registry: {
            'layouts.app': makeLayoutFactory(),
            'web.slow': makeAwaitExtendsPageFactory(),
        },
    });
    return { vm, container };
}

const route = (url: string) => ({ $urlPath: url } as any);

function frame(): Promise<void> {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

describe('prerender → fetch → swap for an @extends/@block page', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('replaces the placeholder block content with the real block content once the fetch resolves', async () => {
        const application = app() as any;
        const previousHttp = application.get('Http');
        let resolveFetch!: (value: any) => void;
        const pending = new Promise((resolve) => { resolveFetch = resolve; });
        application.set('Http', { get: () => pending });

        try {
            const { vm, container } = createManager();
            await vm.mountView('web.slow', {}, route('/slow'));
            expect(container.textContent).toContain('LOADING');

            resolveFetch({ data: { ready: true } });
            await pending;
            await frame();
            await frame();

            expect(container.textContent).toContain('REAL CONTENT');
            expect(container.textContent).not.toContain('LOADING');
        } finally {
            application.set('Http', previousHttp);
        }
    });
});

describe('hydrateView — @extends/@block page with @await', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('registers the static footer block (prerender-only) AND uses real content for the awaited block, without fetching', async () => {
        const application = app() as any;
        const previousHttp = application.get('Http');
        let fetchCalled = false;
        application.set('Http', { get: () => { fetchCalled = true; return Promise.resolve({ data: {} }); } });

        try {
            const { vm } = createManager();
            const viewId = 'vssr-slow';
            await vm.hydrateView('web.slow', { __SSR_VIEW_ID__: viewId }, route('/slow'));

            expect(fetchCalled).toBe(false);

            // Footer is declared ONLY inside prerender() — must still be registered,
            // proving prerender() ran (for its static blocks) even though hydrate
            // never shows its skeleton and never fetches.
            const footerBlock = (BlockManager as any).blocks.get('footer' + viewId);
            expect(footerBlock).toBeTruthy();
            expect(footerBlock.contentRenderFactory).toBe(factoryRefs.footer);

            // Content block must carry render()'s REAL factory (called right after
            // prerender(), overwriting the placeholder in place), not the skeleton.
            const contentBlock = (BlockManager as any).blocks.get('content' + viewId);
            expect(contentBlock).toBeTruthy();
            expect(contentBlock.contentRenderFactory).toBe(factoryRefs.realContent);
            expect(contentBlock.contentRenderFactory).not.toBe(factoryRefs.skeleton);
        } finally {
            application.set('Http', previousHttp);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// @section khai báo trong prerender() của trang @await
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hình dạng compiler thật sinh cho `@await` + `@extends` + `@section` tĩnh
 * (xem saola/resources/saola/web/views/modules/demo/await.sao đã compile):
 * section không đụng biến await bị loại khỏi render() và chỉ khai báo trong
 * prerender(), còn `@yield` nhận nó thì nằm trong LAYOUT.
 */
function makeYieldLayoutFactory() {
    return () => {
        const view = new View('layouts.yielding', 'layout');
        view.__ctrl__.setup({
            superView: null,
            data: {},
            render: function (this: any) {
                return this.wrapper((parent: any) => [
                    this.html('yl-main', 'main', parent, {}, (p: any) => [
                        this.blockOutlet('yl-ob', 'content', p),
                        this.yield('yl-y1', 'note', null, p),
                    ]),
                ]);
            },
        } as any);
        return view;
    };
}

function makeAwaitSectionPageFactory() {
    return () => {
        const view = new View('web.noted', 'view');
        view.__ctrl__.setup({
            superView: 'layouts.yielding',
            data: {},
            hasAwaitData: true,
            hasPrerender: true,
            fetch: { url: '/noted' },
            prerender: function (this: any) {
                this.section('note', { type: 'static', contentType: 'text', stateKeys: [] }, () => 'GHI CHÚ TĨNH');
                this.block('n-content', 'content', (p: any) => [
                    this.html('n-skel', 'div', p, {}, () => [this.text('LOADING')]),
                ]);
                return this.extendView('layouts.yielding');
            },
            render: function (this: any) {
                this.block('n-content', 'content', (p: any) => [
                    this.html('n-real', 'div', p, {}, () => [this.text('REAL CONTENT')]),
                ]);
                return this.extendView('layouts.yielding');
            },
        } as any);
        return view;
    };
}

describe('prerender → fetch → swap: @section chỉ khai báo trong prerender()', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('vẫn mount section vào yield của layout sau khi fetch xong', async () => {
        const application = app() as any;
        const previousHttp = application.get('Http');
        let resolveFetch!: (value: any) => void;
        const pending = new Promise((resolve) => { resolveFetch = resolve; });
        application.set('Http', { get: () => pending });

        try {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const vm = new ViewManager(app() as any);
            vm.setApp(app() as any);
            (app() as any).set('View', vm);
            vm.init({
                container,
                registry: {
                    'layouts.yielding': makeYieldLayoutFactory(),
                    'web.noted': makeAwaitSectionPageFactory(),
                },
            });

            await vm.mountView('web.noted', {}, { $urlPath: '/noted' } as any);
            expect(container.textContent).toContain('LOADING');

            resolveFetch({ data: { ready: true } });
            await pending;
            await frame();
            await frame();

            expect(container.textContent).toContain('REAL CONTENT');
            // Yield thuộc layout, không thuộc page — mount theo viewId của page
            // là trượt, và nội dung tĩnh của trang @await biến mất khỏi CSR.
            expect(container.textContent).toContain('GHI CHÚ TĨNH');
        } finally {
            application.set('Http', previousHttp);
        }
    });
});
