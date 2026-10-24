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
import Page from '../fixtures/compiled/.generated/js/admin-page';
import Shell from '../fixtures/compiled/.generated/js/admin-shell';
import Renderer from '../fixtures/compiled/.generated/js/admin-renderer';
import {AdminUI} from '../../../admin/resources/saola/admin/app/bundle';

const root = path.join(__dirname, '../fixtures/compiled/.generated');
const en = JSON.parse(readFileSync(path.join(root, 'admin-en.json'), 'utf8'));
const viLang = JSON.parse(readFileSync(path.join(root, 'admin-vi.json'), 'utf8'));
let vm: ViewManager | undefined;
let router: Router | undefined;
afterEach(() => {
    router?.destroy(); vm?.destroy(); router = undefined; vm = undefined;
    BlockManager.destroy(); StoreService.instance('ViewManager').clear();
    document.body.innerHTML = ''; window.history.replaceState({}, '', '/'); vi.restoreAllMocks();
});

it('actual admin source renders a page definition, escapes cells, navigates and guards language changes', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const shared = app() as any;
    shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper);
    const ui = new AdminUI(); shared.set('AdminUI', ui);
    const scope = 'admin:fixture';
    const i18n = {scope, locale: 'en', fallbackLocale: 'en', catalogs: {en: {scope, revision: 1, messages: en}}};
    shared.set('Http', {setHeader: vi.fn(), get: vi.fn(async (url: string) => ({data: {
        view: 'admin.pages.resource', i18n, data: {
            page: {schema: 1, titleKey: 'admin.workspace.title', descriptionKey: 'admin.workspace.description',
                fields: [{key: 'site', labelKey: 'admin.workspace.website', value: url.includes('second') ? 'Second page' : 'Workbench'}],
                columns: [{key: 'name', labelKey: 'admin.workspace.locale', renderer: 'badge'}], rows: [{name: '<b>plain text</b>'}]},
            brand: 'Saola Admin', currentPage: url.includes('second') ? 'second' : 'workspace',
            navigation: [{key: 'workspace', titleKey: 'admin.workspace.title', url: '/'}, {key: 'second', titleKey: 'admin.resource.records', url: '/second'}],
            locales: [{code: 'en'}, {code: 'vi'}], dictionaryPattern: '/saola/languages/admin/_locale_',
        },
    }}))});
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ok: true, json: async () => ({scope, revision: 1, messages: viLang})} as Response);
    document.body.innerHTML = '<div id="app-root"></div>';
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: {__base__: 'admin.'}, registry: {
        'admin.pages.resource': Page, 'admin.layouts.shell': Shell, 'admin.components.resource': Renderer,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm);
    router.configure({routes: [{path: '/', component: 'admin.pages.resource'}, {path: '/second', component: 'admin.pages.resource'}]});
    router.start();
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Overview'));
    expect(document.querySelector('dd')?.textContent).toBe('Workbench');
    expect(document.querySelector('td')?.textContent?.trim()).toBe('<b>plain text</b>');
    expect(document.querySelector('td b')).toBeNull();
    (document.querySelector('#admin-menu-toggle') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#sa-admin-navigation')?.classList.contains('is-open')).toBe(true));
    const dispose = ui.registerLanguageGuard(() => false);
    const switchVi = () => [...document.querySelectorAll('.sa-admin-languages button')].find(button => button.textContent === 'vi') as HTMLButtonElement;
    switchVi().click();
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Save or discard'));
    expect(fetch).not.toHaveBeenCalled(); dispose();
    switchVi().click();
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Tổng quan'));
    await router.navigate('/second');
    await vi.waitFor(() => expect(document.querySelector('dd')?.textContent).toBe('Second page'));
    expect(document.querySelectorAll('.saola-admin')).toHaveLength(1);
    expect(helper.getLocale()).toBe('vi');
});

it('package renderer and shell compile to strict TypeScript', () => {
    const files = ['admin-page', 'admin-shell', 'admin-renderer', 'admin-settings-page', 'admin-settings-form'].map(name => path.join(root, `js/${name}.ts`));
    files.push(path.resolve(__dirname, '../../../admin/resources/saola/admin/app/settings-form.ts'));
    files.push(path.resolve(__dirname, '../../../admin/resources/saola/admin/app/bundle.ts'));
    const program = ts.createProgram(files, {noEmit: true, strict: true, skipLibCheck: true,
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: path.join(__dirname, '../..'), paths: {'@saolabs/client': ['index.ts']}});
    expect(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
});

it('hydrates actual Laravel-rendered admin markup and switches locale without duplicate or stale labels', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const html = readFileSync(path.join(root, 'admin-ssr/public/index-vi.html'), 'utf8');
    const parser = new DOMParser(); const doc = parser.parseFromString(html, 'text/html');
    const configScript = [...doc.querySelectorAll('script')].find(script => script.textContent?.startsWith('window.APP_CONFIGS='))!.textContent!;
    const config = JSON.parse(configScript.replace('window.APP_CONFIGS=', '').replace(/;$/, ''));
    const ssr = JSON.parse(doc.querySelector('script[data-ref="saola-ssr"]')!.textContent!);
    document.body.innerHTML = doc.body.innerHTML;
    window.history.replaceState({}, '', '/control');
    const shared = app() as any; shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper); shared.set('AdminUI', new AdminUI());
    helper.initTranslations(config.i18n);
    shared.set('Http', {setHeader: vi.fn(), get: vi.fn(async () => ({data: JSON.parse(readFileSync(path.join(root, 'admin-ssr/page-en.json'), 'utf8'))}))});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ok: true, json: async () => JSON.parse(readFileSync(path.join(root, 'admin-ssr/dictionary-en.json'), 'utf8'))} as Response);
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: config.view.systemData, ssrData: config.view.ssrData, ssr, registry: {
        'admin.pages.resource': Page, 'admin.layouts.shell': Shell, 'admin.components.resource': Renderer,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm); router.configure(config.router);
    router.start();
    await vi.waitFor(() => expect(vm!.getCurrentView()).not.toBeNull());
    const button = [...document.querySelectorAll('.sa-admin-languages button')].find(el => el.textContent === 'en') as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Overview'));
    expect(document.querySelectorAll('.saola-admin')).toHaveLength(1);
    expect(document.querySelector('#app-root')?.textContent).not.toMatch(/Tổng quan/);
    const outsideText = [...document.body.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim();
    expect(outsideText).toBe('');
});

it('hydrates the host user directory, paginates, changes UI language and submits filters through the router', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const fixture = (file: string) => JSON.parse(readFileSync(path.join(root, 'admin-ssr', file), 'utf8'));
    const doc = new DOMParser().parseFromString(readFileSync(path.join(root, 'admin-ssr/public/users-vi.html'), 'utf8'), 'text/html');
    const configScript = [...doc.querySelectorAll('script')].find(script => script.textContent?.startsWith('window.APP_CONFIGS='))!.textContent!;
    const config = JSON.parse(configScript.replace('window.APP_CONFIGS=', '').replace(/;$/, ''));
    const ssr = JSON.parse(doc.querySelector('script[data-ref="saola-ssr"]')!.textContent!);
    document.body.innerHTML = doc.body.innerHTML;
    window.history.replaceState({}, '', '/control/users?locale=vi&per_page=10');
    const shared = app() as any; shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper); shared.set('AdminUI', new AdminUI());
    helper.initTranslations(config.i18n);
    const get = vi.fn(async (url: string) => {
        const params = new URL(url, window.location.origin).searchParams;
        const file = params.get('q') === 'Member 02' ? 'users-filtered-en.json' : params.get('page') === '2' ? 'users-page2-en.json' : 'users-page-en.json';
        return {data: fixture(file)};
    });
    shared.set('Http', {setHeader: vi.fn(), get});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ok: true, json: async () => fixture('dictionary-en.json')} as Response);
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: config.view.systemData, ssrData: config.view.ssrData, ssr, registry: {
        'admin.pages.resource': Page, 'admin.layouts.shell': Shell, 'admin.components.resource': Renderer,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm); router.configure(config.router); router.start();
    await vi.waitFor(() => expect(vm!.getCurrentView()).not.toBeNull());
    expect(document.querySelector('#admin-page-title')?.textContent).toBe('Người dùng');
    expect(document.querySelectorAll('tbody tr')).toHaveLength(10);
    expect((document.querySelector('#resource-size') as HTMLSelectElement).value).toBe('10');
    expect(document.querySelector('dl')).toBeNull();
    ([...document.querySelectorAll('.sa-admin-languages button')].find(el => el.textContent === 'en') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Users'));
    (document.querySelector('a[rel="next"]') as HTMLAnchorElement).click();
    await vi.waitFor(() => expect(document.querySelector('tbody tr')?.textContent).toContain('Member 11'));
    expect(new URL(window.location.href).searchParams.get('page')).toBe('2');
    const search = document.querySelector('#resource-search') as HTMLInputElement;
    search.value = 'Member 02';
    document.querySelector('.sa-admin-list-filters')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(document.querySelectorAll('tbody tr')).toHaveLength(1));
    expect(document.querySelector('tbody tr')?.textContent).toContain('Member 02');
    expect(document.querySelector('a[rel="next"]')).toBeNull();
    const params = new URL(window.location.href).searchParams;
    expect(params.get('q')).toBe('Member 02'); expect(params.get('locale')).toBe('en');
    expect(params.has('page')).toBe(false);
    expect(document.querySelectorAll('.saola-admin')).toHaveLength(1);
    expect(get).toHaveBeenCalledTimes(3);
});
