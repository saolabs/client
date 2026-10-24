import {afterEach, expect, it, vi} from 'vitest';
import path from 'node:path';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {app} from '../../src/core/helpers/app';
import {HelperService} from '../../src/core/services/HelperService';
import {ViewManager} from '../../src/core/view/ViewManager';
import {Router} from '../../src/core/routers/Router';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import {StoreService} from '../../src/core/services/StoreService';
import Demo from '../fixtures/compiled/.generated/js/language-demo';
import Layout from '../fixtures/compiled/.generated/js/language-demo-layout';

let vm: ViewManager | undefined;
let router: Router | undefined;
afterEach(() => {
    router?.destroy(); vm?.destroy(); router = undefined; vm = undefined;
    BlockManager.destroy(); StoreService.instance('ViewManager').clear();
    document.body.innerHTML = ''; window.history.replaceState({}, '', '/'); vi.restoreAllMocks();
});

it('the actual starter demo initializes CSR dictionaries before rendering and guards unsaved form data', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const shared = app() as any;
    shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper);
    const scope = 'language-demo:fixture';
    const config = {scope, locale: 'en', fallbackLocale: 'en', catalogs: {
        en: {scope, revision: 1, messages: {save: 'Save', language_demo: {title: 'Languages', blocked: 'Unsaved note'}}},
    }};
    shared.set('Http', {setHeader: vi.fn(), get: vi.fn(async () => ({data: {
        data: {dictionaryBase: '/saola/languages/language-demo/'}, view: 'web.modules.home.language-demo', i18n: config,
    }}))});
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ok: true, json: async () => ({scope, revision: 1, messages: {save: 'Lưu', language_demo: {title: 'Ngôn ngữ'}}})} as Response);
    document.body.innerHTML = '<div id="app-root"></div>';
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: {__layout__: 'fixtures.'}, registry: {
        'web.modules.home.language-demo': Demo, 'fixtures.lab': Layout,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm);
    router.configure({routes: [{path: '/', component: 'web.modules.home.language-demo'}]});
    router.start();
    await vi.waitFor(() => expect(document.querySelector('#language-save')?.textContent).toBe('Save'));
    const draft = document.querySelector('#language-draft') as HTMLInputElement;
    draft.value = 'keep my note'; draft.dispatchEvent(new Event('input', {bubbles: true}));
    (document.querySelector('#language-vi') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Unsaved note'));
    expect(fetch).not.toHaveBeenCalled(); expect(draft.value).toBe('keep my note');
    (document.querySelector('#language-clear') as HTMLButtonElement).click();
    (document.querySelector('#language-vi') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#language-save')?.textContent).toBe('Lưu'));
    expect(fetch).toHaveBeenCalledWith('/saola/languages/language-demo/vi', expect.any(Object));
    expect(helper.getLocale()).toBe('vi');
});

it('the demo emits strict TypeScript and PHP uses text() for the same literal keys', () => {
    const generated = path.join(__dirname, '../fixtures/compiled/.generated/js/language-demo.ts');
    const program = ts.createProgram([generated], {noEmit: true, strict: true, skipLibCheck: true,
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: path.join(__dirname, '../..'), paths: {'@saolabs/client': ['index.ts']}});
    expect(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    const blade = readFileSync(path.join(__dirname, '../fixtures/compiled/.generated/blade/language-demo.blade.php'), 'utf8');
    expect(blade).toContain("text('save')"); expect(blade).toContain("text('auth.keep_login')");
    expect(blade).not.toContain("__('save')");
});
