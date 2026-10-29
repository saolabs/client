import {beforeEach, afterEach, expect, it, vi} from 'vitest';
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
import Manager from '../fixtures/compiled/.generated/js/admin-manager';
import Shell from '../fixtures/compiled/.generated/js/admin-shell';
import Renderer from '../fixtures/compiled/.generated/js/admin-renderer';
import {AdminUI} from '../../../admin/resources/saola/admin/app/bundle';

const root = path.join(__dirname, '../fixtures/compiled/.generated');
const en = JSON.parse(readFileSync(path.join(root, 'admin-en.json'), 'utf8'));
const viLang = JSON.parse(readFileSync(path.join(root, 'admin-vi.json'), 'utf8'));
async function selectHeaderLanguage(code: string): Promise<void> {
    (document.querySelector('#admin-language-toggle') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector(`.sa-admin-languages button[data-locale="${code}"]`)).not.toBeNull());
    (document.querySelector(`.sa-admin-languages button[data-locale="${code}"]`) as HTMLButtonElement).click();
}
beforeEach(() => {
    const saved = new Map<string, string>();
    vi.stubGlobal('localStorage', {getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value), clear: () => saved.clear()});
});
let vm: ViewManager | undefined;
let router: Router | undefined;
afterEach(() => {
    router?.destroy(); vm?.destroy(); router = undefined; vm = undefined;
    BlockManager.destroy(); StoreService.instance('ViewManager').clear();
    document.body.innerHTML = ''; window.history.replaceState({}, '', '/'); vi.restoreAllMocks();
    window.localStorage.clear(); vi.unstubAllGlobals();
});

it.each(['classic', 'material'])('%s uses the shared shell actions, guards language changes and releases presentation effects', async (theme) => {
    const [ThemePage, ThemeShell, ThemeRenderer] = theme === 'material'
        ? await Promise.all([import('../fixtures/compiled/.generated/js/material-admin-page'), import('../fixtures/compiled/.generated/js/material-admin-shell'), import('../fixtures/compiled/.generated/js/material-admin-renderer')]).then(modules => modules.map(module => module.default))
        : [Page, Shell, Renderer];
    const base = `admin.themes.${theme}.`;
    const attributes = ['data-layout', 'data-topbar', 'data-sidebar', 'data-bs-theme', 'data-sidebar-size'];
    const previous = attributes.map(key => document.documentElement.getAttribute(key));
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const shared = app() as any;
    shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper);
    const ui = new AdminUI(shared); shared.set('AdminUI', ui); shared.set('Admin', ui);
    const scope = 'admin:fixture';
    const i18n = {scope, locale: 'en', fallbackLocale: 'en', catalogs: {en: {scope, revision: 1, messages: en}}};
    shared.set('Http', {setHeader: vi.fn(), get: vi.fn(async (url: string) => ({data: {
        view: base + 'pages.resource', i18n, data: {
            page: {schema: 1, titleKey: 'admin.workspace.title', descriptionKey: 'admin.workspace.description',
                fields: [{key: 'site', labelKey: 'admin.workspace.website', value: url.includes('second') ? 'Second page' : 'Workbench'}],
                columns: [{key: 'name', labelKey: 'admin.workspace.locale', renderer: 'badge'}], rows: [{name: '<b>plain text</b>'}]},
            brand: 'Saola Admin', currentPage: url.includes('second') ? 'second' : 'workspace',
            branding: {logoUrl: '/images/host-brand.png', compactLogoUrl: '/images/host-icon.png', initials: 'H'},
            navigation: [{key: 'workspace', titleKey: 'admin.workspace.title', url: '/'}, {key: 'second', titleKey: 'admin.resource.records', url: '/second'},
                {key: 'settings', titleKey: 'admin.settings.title', children: [{key: 'settings.website', titleKey: 'admin.workspace.website', url: '/settings'}]}],
            locales: [{code: 'en', name: 'English'}, {code: 'vi', name: 'Tiếng Việt'}], dictionaryPattern: '/saola/languages/admin/_locale_',
            uiLocale: 'en', account: {name: '<b>Operator</b>', email: 'operator@example.test', subtitle: 'Editor', avatar: '', initials: 'OP',
                links: [{key: 'profile', titleKey: 'admin.shell.profile', url: '/my-profile'}], logoutUrl: '/session/logout', logoutMethod: 'POST', csrfToken: 'session-token'},
        },
    }}))});
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ok: true, json: async () => ({scope, revision: 1, messages: viLang})} as Response);
    document.body.innerHTML = '<div id="app-root"></div>';
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: {__base__: base}, registry: {
        [base + 'pages.resource']: ThemePage, [base + 'layouts.shell']: ThemeShell, [base + 'components.resource']: ThemeRenderer,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm);
    router.configure({routes: [{path: '/', component: base + 'pages.resource'}, {path: '/second', component: base + 'pages.resource'}]});
    router.start();
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Overview'));
    expect(document.querySelector('dd')?.textContent).toBe('Workbench');
    expect(document.querySelector('.sa-admin-brand-full')?.getAttribute('src')).toBe('/images/host-brand.png');
    expect(document.querySelector('.sa-admin-brand-small')?.getAttribute('src')).toBe('/images/host-icon.png');
    expect(document.querySelector('.sa-admin-brand-full')?.getAttribute('alt')).toBe('Saola Admin');
    expect(document.querySelector('.sa-admin-mark')).toBeNull();
    expect(document.querySelector('td')?.textContent?.trim()).toBe('<b>plain text</b>');
    expect(document.querySelector('td b')).toBeNull();
    expect(document.querySelectorAll('.sa-admin-header-actions > div')).toHaveLength(2);
    expect(document.querySelector('#admin-account-toggle > .sa-admin-dropdown-chevron')).not.toBeNull();
    expect(document.querySelector('#admin-account-toggle > .sa-admin-chevron')).toBeNull();
    expect(document.querySelector('.sa-admin-header-actions')?.textContent).not.toContain('Signed in');
    (document.querySelector('#admin-account-toggle') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#admin-account-menu')).not.toBeNull());
    expect(document.querySelector('.sa-admin-account-summary strong')?.textContent).toBe('<b>Operator</b>');
    expect(document.querySelector('.sa-admin-account-summary strong b')).toBeNull();
    expect(document.querySelector('.sa-admin-account-summary small')?.textContent).toBe('operator@example.test');
    expect(document.querySelector('.sa-admin-account-summary > span')).toBeNull();
    expect(document.querySelector('#admin-account-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.sa-admin-account-link')?.getAttribute('href')).toBe('/my-profile');
    (document.querySelector('#admin-language-toggle') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#admin-language-menu')).not.toBeNull());
    expect(document.querySelector('#admin-account-menu')).toBeNull();
    expect(document.querySelector('#admin-account-toggle')?.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[data-locale="en"]')?.getAttribute('aria-pressed')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
    expect(document.activeElement).toBe(document.querySelector('[data-locale="en"]'));
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await vi.waitFor(() => expect(document.querySelector('#admin-language-menu')).toBeNull());
    expect(document.activeElement).toBe(document.querySelector('#admin-language-toggle'));
    const settingsToggle = () => document.querySelector<HTMLButtonElement>('[aria-controls="admin-submenu-settings"]')!;
    const settingsGroup = () => settingsToggle().closest('.sa-admin-nav-group')!;
    if (theme === 'material') {
        // Expanded Material follows the template's inline disclosure, including inactive groups.
        expect(document.querySelectorAll('#admin-menu-toggle .hamburger-icon > span')).toHaveLength(3);
        expect(document.querySelector('#admin-menu-toggle .hamburger-icon.open')).toBeNull();
        expect(settingsToggle().querySelector('.sa-admin-chevron')).not.toBeNull();
        settingsGroup().dispatchEvent(new MouseEvent('mouseenter'));
        settingsToggle().focus();
        expect(document.querySelector('#admin-submenu-settings')).toBeNull();
        settingsToggle().click();
        await vi.waitFor(() => expect(settingsToggle().getAttribute('aria-expanded')).toBe('true'));
        expect(document.querySelectorAll('#admin-submenu-settings a')).toHaveLength(1);
        expect(settingsGroup().classList.contains('is-side-flyout')).toBe(false);
        expect(document.querySelector('.sa-admin-flyout-title')).toBeNull();
        settingsGroup().dispatchEvent(new MouseEvent('mouseleave'));
        expect(document.querySelector('#admin-submenu-settings')).not.toBeNull();
        settingsToggle().click();
        await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings')).toBeNull());
    }
    (document.querySelector('#admin-menu-toggle') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('.saola-admin')?.classList.contains('is-sidebar-compact')).toBe(true));
    expect(window.localStorage.getItem('saola.admin.sidebar')).toBe('compact');
    if (theme === 'material') {
        expect(document.documentElement.getAttribute('data-sidebar-size')).toBe('sm');
        expect(document.querySelector('#admin-menu-toggle .hamburger-icon.open')).not.toBeNull();
        (document.querySelector('#admin-menu-toggle') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(document.querySelector('#admin-menu-toggle .hamburger-icon.open')).toBeNull());
        expect(settingsToggle().querySelector('.sa-admin-chevron')).not.toBeNull();
        (document.querySelector('#admin-menu-toggle') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(document.querySelector('#admin-menu-toggle .hamburger-icon.open')).not.toBeNull());
    }
    settingsGroup().dispatchEvent(new MouseEvent('mouseenter'));
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings .sa-admin-flyout-title')).not.toBeNull());
    expect(settingsToggle().getAttribute('aria-expanded')).toBe('true');
    if (theme === 'material') {
        // Upstream hover rules must never reveal an arrow beside the compact rail icon.
        expect(settingsToggle().querySelector('.sa-admin-chevron')).toBeNull();
        expect(document.querySelector('#admin-submenu-settings .sa-admin-flyout-title .sa-admin-chevron')).not.toBeNull();
    }
    (document.querySelector('#admin-submenu-settings a') as HTMLAnchorElement).focus();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings')).toBeNull());
    expect(document.activeElement).toBe(settingsToggle());
    vi.stubGlobal('innerWidth', 390); window.dispatchEvent(new Event('resize'));
    (document.querySelector('#admin-menu-toggle') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#sa-admin-navigation')?.classList.contains('is-open')).toBe(true));
    if (theme === 'material') expect(document.querySelector('#admin-menu-toggle .hamburger-icon.open')).toBeNull();
    settingsToggle().click();
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings a')).not.toBeNull());
    expect(document.querySelector('.sa-admin-flyout-title')).toBeNull();
    const dispose = ui.registerLanguageGuard(() => false);
    (document.querySelector('#admin-account-toggle') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#admin-account-menu form')).not.toBeNull());
    const logout = document.querySelector('#admin-account-menu form') as HTMLFormElement;
    expect(logout.method).toBe('post'); expect(logout.getAttribute('action')).toBe('/session/logout');
    expect((logout.querySelector('input[name="_token"]') as HTMLInputElement).value).toBe('session-token');
    const logoutEvent = new Event('submit', {bubbles: true, cancelable: true}); logout.dispatchEvent(logoutEvent);
    expect(logoutEvent.defaultPrevented).toBe(true);
    await selectHeaderLanguage('vi');
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Save or discard'));
    expect(fetch).not.toHaveBeenCalled(); dispose();
    await selectHeaderLanguage('vi');
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Tổng quan'));
    await router.navigate('/second');
    await vi.waitFor(() => expect(document.querySelector('dd')?.textContent).toBe('Second page'));
    expect(document.querySelectorAll('.saola-admin')).toHaveLength(1);
    expect(helper.getLocale()).toBe('vi');
    vm.destroy(); vm = undefined;
    expect(attributes.map(key => document.documentElement.getAttribute(key))).toEqual(previous);
    expect(ui.canChangeLanguage()).toBe(true);
});

it('package renderer and shell compile to strict TypeScript', () => {
    const names = ['admin-page', 'admin-shell', 'admin-renderer', 'admin-manager', 'admin-input', 'admin-settings-page', 'admin-settings-form', 'admin-languages-page', 'admin-languages-form', 'admin-media-page', 'admin-media-library'];
    const files = ['', 'material-'].flatMap(prefix => names.map(name => path.join(root, `js/${prefix}${name}.ts`)));
    files.push(path.resolve(__dirname, '../../../admin/resources/saola/admin/app/settings-form.ts'));
    files.push(path.resolve(__dirname, '../../../admin/resources/saola/admin/app/language-form.ts'));
    files.push(path.resolve(__dirname, '../../../admin/resources/saola/admin/app/bundle.ts'));
    const program = ts.createProgram(files, {noEmit: true, strict: true, skipLibCheck: true,
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: path.join(__dirname, '../..'), paths: {
            '@saolabs/client': ['index.ts'],
            '@sao/admin/*': ['../admin/resources/saola/admin/*'],
        }});
    expect(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
});

it('hydrates actual Laravel-rendered admin markup and switches locale without duplicate or stale labels', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const html = readFileSync(path.join(root, 'admin-ssr/public/index-vi.html'), 'utf8');
    const parser = new DOMParser(); const doc = parser.parseFromString(html, 'text/html');
    const configScript = [...doc.querySelectorAll('script')].find(script => script.textContent?.startsWith('window.APP_CONFIGS='))!.textContent!;
    const config = JSON.parse(configScript.replace('window.APP_CONFIGS=', '').replace(/;$/, ''));
    const ssr = JSON.parse(doc.querySelector('script[data-ref="saola-ssr"]')!.textContent!);
    document.body.innerHTML = doc.body.innerHTML;
    window.history.replaceState({}, '', '/control/members');
    const shared = app() as any; shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper); shared.set('AdminUI', new AdminUI(shared)); shared.set('Admin', shared.make('AdminUI'));
    helper.initTranslations(config.i18n);
    shared.set('Http', {setHeader: vi.fn(), get: vi.fn(async () => ({data: JSON.parse(readFileSync(path.join(root, 'admin-ssr/page-en.json'), 'utf8'))}))});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ok: true, json: async () => JSON.parse(readFileSync(path.join(root, 'admin-ssr/dictionary-en.json'), 'utf8'))} as Response);
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: config.view.systemData, ssrData: config.view.ssrData, ssr, registry: {
        'admin.themes.classic.pages.resource': Page, 'admin.themes.classic.components.manager': Manager, 'admin.themes.classic.layouts.shell': Shell, 'admin.themes.classic.components.resource': Renderer,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm); router.configure(config.router);
    router.start();
    await vi.waitFor(() => expect(vm!.getCurrentView()).not.toBeNull());
    await selectHeaderLanguage('en');
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Users'));
    expect(document.querySelectorAll('.saola-admin')).toHaveLength(1);
    expect(document.querySelector('#app-root')?.textContent).not.toMatch(/Tổng quan/);
    const outsideText = [...document.body.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim();
    expect(outsideText).toBe('');
    expect(document.querySelector('.sa-admin-language-code')?.textContent).toBe('en');
    expect(document.querySelector('.sa-admin-account-caption strong')?.textContent).toBe('Workbench Operator');
    vm!.destroy(); vm = undefined;
    expect(errors.mock.calls).toEqual([]);
});

it('hydrates the host user directory, paginates, changes UI language and submits filters through the router', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const fixture = (file: string) => JSON.parse(readFileSync(path.join(root, 'admin-ssr', file), 'utf8'));
    const doc = new DOMParser().parseFromString(readFileSync(path.join(root, 'admin-ssr/public/users-vi.html'), 'utf8'), 'text/html');
    const configScript = [...doc.querySelectorAll('script')].find(script => script.textContent?.startsWith('window.APP_CONFIGS='))!.textContent!;
    const config = JSON.parse(configScript.replace('window.APP_CONFIGS=', '').replace(/;$/, ''));
    const ssr = JSON.parse(doc.querySelector('script[data-ref="saola-ssr"]')!.textContent!);
    document.body.innerHTML = doc.body.innerHTML;
    window.history.replaceState({}, '', '/control/members?locale=vi&per_page=10');
    const shared = app() as any; shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper); shared.set('AdminUI', new AdminUI(shared)); shared.set('Admin', shared.make('AdminUI'));
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
        'admin.themes.classic.pages.resource': Page, 'admin.themes.classic.components.manager': Manager, 'admin.themes.classic.layouts.shell': Shell, 'admin.themes.classic.components.resource': Renderer,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm); router.configure(config.router); router.start();
    await vi.waitFor(() => expect(vm!.getCurrentView()).not.toBeNull());
    expect(document.querySelector('#admin-page-title')?.textContent).toBe('Người dùng');
    expect(document.querySelectorAll('tbody tr')).toHaveLength(10);
    await vi.waitFor(() => expect((document.querySelector('#managed-size') as HTMLSelectElement).value).toBe('10'));
    expect(document.querySelector('dl')).toBeNull();
    await selectHeaderLanguage('en');
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Users'));
    (document.querySelector('a[rel="next"]') as HTMLAnchorElement).click();
    await vi.waitFor(() => expect(document.querySelector('tbody tr')?.textContent).toContain('Member 11'));
    expect(new URL(window.location.href).searchParams.get('page')).toBe('2');
    const search = document.querySelector('#managed-search') as HTMLInputElement;
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
