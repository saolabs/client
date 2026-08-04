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

/** Mirrors the shape real compiled output produces for @extends + @await + @block (see compiler/examples/sao/await.sao). */
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
