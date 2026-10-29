import {beforeEach, afterEach, expect, it, vi} from 'vitest';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {SettingsForm, type Editor} from '../../../admin/resources/saola/admin/app/settings-form';
import {AdminUI} from '../../../admin/resources/saola/admin/app/bundle';
import {app} from '../../src/core/helpers/app';
import {HelperService} from '../../src/core/services/HelperService';
import {ViewManager} from '../../src/core/view/ViewManager';
import {Router} from '../../src/core/routers/Router';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import {StoreService} from '../../src/core/services/StoreService';
import SettingsPage from '../fixtures/compiled/.generated/js/admin-settings-page';
import SettingsRenderer from '../fixtures/compiled/.generated/js/admin-settings-form';
import Page from '../fixtures/compiled/.generated/js/admin-page';
import Manager from '../fixtures/compiled/.generated/js/admin-manager';
import Resource from '../fixtures/compiled/.generated/js/admin-renderer';
import Shell from '../fixtures/compiled/.generated/js/admin-shell';

const root = path.join(__dirname, '../fixtures/compiled/.generated/admin-ssr');
const fixture = (name: string) => JSON.parse(readFileSync(path.join(root, name), 'utf8'));
const response = (data: any, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json'}});
const editor = (): Editor => ({group: 'general', contentLocale: 'vi', endpoint: '/control/settings/general', csrfToken: 'session-token', canUpdate: true,
    document: {group: 'general', schemaVersion: 1, revision: 0, values: {}, localized: {}, contentLocales: ['en', 'vi'], defaultLocale: 'en'},
    fields: [
        {key: 'name', labelKey: 'admin.settings.website_name', type: 'text', localized: true, value: 'Inherited name', present: false, maxLength: 200, min: '', max: ''},
        {key: 'enabled', labelKey: 'admin.settings.title', type: 'boolean', localized: false, value: true, present: true, maxLength: 2048, min: '', max: ''},
        {key: 'count', labelKey: 'admin.settings.title', type: 'integer', localized: false, value: 10, present: true, maxLength: 2048, min: 0, max: 100},
    ]});
const saved = (initial: Editor, values: any = {}, localized: any = {}) => ({data: {...initial.document, revision: 1, values, localized},
    canUpdate: true, schema: {fields: Object.fromEntries(initial.fields.map(field => [field.key, {...field, default: field.value}]))}});
async function selectHeaderLanguage(code: string): Promise<void> {
    (document.querySelector('#admin-language-toggle') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector(`.sa-admin-languages button[data-locale="${code}"]`)).not.toBeNull());
    (document.querySelector(`.sa-admin-languages button[data-locale="${code}"]`) as HTMLButtonElement).click();
}
beforeEach(() => {
    const saved = new Map<string, string>();
    vi.stubGlobal('localStorage', {getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value), clear: () => saved.clear()});
});
let vm: ViewManager | undefined; let router: Router | undefined;
afterEach(() => {
    vm?.destroy(); router?.destroy(); vm = undefined; router = undefined;
    BlockManager.destroy(); StoreService.instance('ViewManager').clear();
    document.body.innerHTML = ''; window.history.replaceState({}, '', '/'); vi.restoreAllMocks();
    window.localStorage.clear(); vi.unstubAllGlobals();
});

it('sends only edited fields with explicit empty/false/zero, original revision, CSRF and content locale', async () => {
    const initial = editor(); const form = new SettingsForm(initial);
    expect(form.dirty).toBe(false);
    form.change('name', ''); form.change('enabled', false); form.change('count', 0);
    const send = vi.fn().mockResolvedValue(response(saved(initial, {enabled: false, count: 0}, {vi: {name: ''}})));
    await form.save(send);
    const options = send.mock.calls[0][1];
    expect(JSON.parse(options.body)).toEqual({revision: 0, patch: {values: {enabled: false, count: 0}, localized: {vi: {name: ''}}}});
    expect(options.headers['X-CSRF-TOKEN']).toBe('session-token'); expect(options.credentials).toBe('same-origin');
    expect(form.revision).toBe(1); expect(form.dirty).toBe(false); expect(form.notice).toBe('admin.settings.saved');
    expect(initial.document.revision).toBe(0);
});

it('does not materialize untouched fallbacks and rejects an incomplete number before any write', async () => {
    const initial = editor(); const form = new SettingsForm(initial);
    form.change('count', ''); const send = vi.fn(); await form.save(send);
    expect(send).not.toHaveBeenCalled(); expect(form.errors.count).toBe('admin.settings.invalid_value');
    form.change('count', 11); send.mockResolvedValue(response(saved(initial, {count: 11})));
    await form.save(send);
    expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({revision: 0, patch: {values: {count: 11}}});
});

it('saves a global group without a content locale or localized patch and accepts global responses', async () => {
    const initial = editor();
    initial.group = 'system'; initial.endpoint = '/control/settings/system'; initial.contentLocale = '';
    initial.document = {...initial.document, group: 'system', contentLocales: [], defaultLocale: ''};
    initial.fields = initial.fields.filter(field => !field.localized);
    const form = new SettingsForm(initial); form.change('enabled', false);
    const send = vi.fn().mockResolvedValue(response(saved(initial, {enabled: false})));
    await form.save(send);
    expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({revision: 0, patch: {values: {enabled: false}}});
    expect(form.notice).toBe('admin.settings.saved'); expect(form.dirty).toBe(false); expect(form.revision).toBe(1);
});

it('loads updated select options from the schema when a shared group is reloaded', async () => {
    const initial = editor(); initial.contentLocale = '';
    initial.document = {...initial.document, contentLocales: [], defaultLocale: ''};
    initial.fields = [{key: 'zone', labelKey: 'zone', type: 'select', localized: false, present: true,
        value: 'UTC', options: [{value: 'UTC', label: 'UTC'}], maxLength: 200, min: '', max: ''}];
    const form = new SettingsForm(initial);
    await form.reload(vi.fn().mockResolvedValue(response({data: {...initial.document, values: {zone: 'Asia/Ho_Chi_Minh'}}, canUpdate: true,
        schema: {fields: {zone: {type: 'select', default: 'UTC', options: {UTC: 'UTC', 'Asia/Ho_Chi_Minh': 'Asia/Ho_Chi_Minh'}}}}})));
    expect(form.fields[0].value).toBe('Asia/Ho_Chi_Minh'); expect(form.fields[0].options).toHaveLength(2);
});

it('preserves input after field errors, conflict and network failure; never silently overwrites a newer revision', async () => {
    const initial = editor(); const form = new SettingsForm(initial); form.change('name', 'Draft');
    await form.save(vi.fn().mockResolvedValue(response({errors: {'localized.vi.name': ['Invalid']}}, 422)));
    expect(form.fields[0].value).toBe('Draft'); expect(form.dirty).toBe(true); expect(form.errors.name).toBeTruthy();
    form.change('name', 'Another draft');
    await form.save(vi.fn().mockRejectedValue(new Error('Offline')));
    expect(form.fields[0].value).toBe('Another draft'); expect(form.notice).toBe('admin.settings.failed');
    await form.save(vi.fn().mockResolvedValue(response({}, 409)));
    expect(form.canSave).toBe(false); expect(form.dirty).toBe(true); expect(form.revision).toBe(0);
    const retry = vi.fn(); await form.save(retry); expect(retry).not.toHaveBeenCalled();
    form.discard(); expect(form.canLeave()).toBe(true);
    await form.reload(vi.fn().mockResolvedValue(response({...saved(initial, {}, {vi: {name: 'Server'}}), data: {...saved(initial).data, revision: 2, localized: {vi: {name: 'Server'}}}})));
    expect(form.fields[0].value).toBe('Server'); expect(form.revision).toBe(2); expect(form.dirty).toBe(false);
});

it('ignores a stale response after suspension and blocks duplicate saves while a request is pending', async () => {
    const initial = editor(); const form = new SettingsForm(initial); form.change('name', 'Draft');
    let finish!: (value: Response) => void;
    const send = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    const pending = form.save(send); await form.save(send);
    expect(send).toHaveBeenCalledTimes(1); expect(form.canLeave()).toBe(false);
    form.suspend(); finish(response(saved(initial, {}, {vi: {name: 'Stale response'}}))); await pending;
    expect(form.fields[0].value).toBe('Draft'); expect(form.dirty).toBe(true); expect(form.revision).toBe(0); expect(form.canSave).toBe(false);
});

it('malformed or unconfirmed success responses cannot erase a draft', async () => {
    const initial = editor(); const form = new SettingsForm(initial); form.change('name', 'Draft');
    await form.save(vi.fn().mockResolvedValue(response({...saved(initial), data: {...initial.document}})));
    expect(form.dirty).toBe(true); expect(form.fields[0].value).toBe('Draft'); expect(form.revision).toBe(0);
    await form.save(vi.fn().mockResolvedValue(response({...saved(initial), data: {...saved(initial).data, values: 'invalid'}})));
    expect(form.dirty).toBe(true); expect(form.notice).toBe('admin.settings.failed');
});

it('revoked permissions keep drafts but disable further writes', async () => {
    const form = new SettingsForm(editor()); form.change('name', 'Draft');
    await form.save(vi.fn().mockResolvedValue(response({}, 403)));
    expect(form.fields[0].value).toBe('Draft'); expect(form.canUpdate).toBe(false); expect(form.canSave).toBe(false);
});

it('hydrates the actual settings SSR form, guards route/UI/content locale changes and saves through metadata', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const doc = new DOMParser().parseFromString(readFileSync(path.join(root, 'public/settings-vi.html'), 'utf8'), 'text/html');
    const script = [...doc.querySelectorAll('script')].find(script => script.textContent?.startsWith('window.APP_CONFIGS='))!.textContent!;
    const config = JSON.parse(script.replace('window.APP_CONFIGS=', '').replace(/;$/, ''));
    const ssr = JSON.parse(doc.querySelector('script[data-ref="saola-ssr"]')!.textContent!);
    document.body.innerHTML = doc.body.innerHTML;
    window.history.replaceState({}, '', '/control/settings?content_locale=vi');
    const shared = app() as any; shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper); shared.set('AdminUI', new AdminUI(shared)); shared.set('Admin', shared.make('AdminUI')); helper.initTranslations(config.i18n);
    const httpGet = vi.fn(async (url: string) => {
        const page = fixture(url.includes('/settings') ? `settings-page-${helper.getLocale()}.json` : `page-${helper.getLocale()}.json`);
        if (url.includes('/settings') && requests.length) {
            page.data.editor.document.revision = 1;
            page.data.editor.document.localized = {vi: {website_name: 'Tên mới'}};
            page.data.editor.fields[0].value = 'Tên mới'; page.data.editor.fields[0].present = true;
        }
        return {data: page};
    });
    shared.set('Http', {setHeader: vi.fn(), get: httpGet});
    const requests: any[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
        if (String(url).includes('/languages/')) return response(fixture('dictionary-en.json'));
        requests.push(options);
        const body = JSON.parse(options!.body as string); const result = fixture('settings-api.json');
        result.data.revision = 1; result.data.localized = {vi: {website_name: body.patch.localized.vi.website_name}};
        return response(result);
    });
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: config.view.systemData, ssrData: config.view.ssrData, ssr, registry: {
        'admin.themes.classic.pages.settings': SettingsPage, 'admin.themes.classic.components.settings-form': SettingsRenderer,
        'admin.themes.classic.layouts.shell': Shell, 'admin.themes.classic.pages.resource': Page, 'admin.themes.classic.components.manager': Manager, 'admin.themes.classic.components.resource': Resource,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm); router.configure(config.router);
    const hostGuard = vi.fn(() => true); router.beforeEach(hostGuard); router.start();
    await vi.waitFor(() => expect(vm!.getCurrentView()).not.toBeNull());
    const input = document.querySelector('#setting-website_name') as HTMLInputElement;
    expect(input.value).toBe('Workbench');
    expect(document.querySelector('#settings-group-navigation')?.classList.contains('sa-admin-settings-tabs')).toBe(true);
    expect(document.querySelectorAll('#settings-group-navigation a')).toHaveLength(4);
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings a[aria-current="page"]')?.textContent).toBe('Website'));
    input.value = 'Tên mới'; input.dispatchEvent(new Event('input', {bubbles: true}));
    await vi.waitFor(() => expect((document.querySelector('#settings-save') as HTMLButtonElement).disabled).toBe(false));
    const tab = new URL((document.querySelector('#settings-group-navigation a[href*="group=branding"]') as HTMLAnchorElement).href);
    await router.navigate(tab.pathname + tab.search);
    await vi.waitFor(() => expect(document.querySelector('#settings-notice')?.textContent).toContain('lưu hoặc bỏ'));
    expect((document.querySelector('#setting-website_name') as HTMLInputElement).value).toBe('Tên mới');
    expect(window.location.search).not.toContain('branding');
    await selectHeaderLanguage('en');
    await vi.waitFor(() => expect(document.querySelector('#settings-notice')?.textContent).toContain('lưu hoặc bỏ'));
    expect(helper.getLocale()).toBe('vi');
    const select = document.querySelector('#settings-content-locale') as HTMLSelectElement;
    select.value = 'en'; select.dispatchEvent(new Event('change', {bubbles: true})); expect(select.value).toBe('vi');
    router.navigate('/control/members');
    await vi.waitFor(() => expect(hostGuard.mock.calls.length).toBeGreaterThan(1));
    expect(window.location.pathname).toBe('/control/settings'); expect(input.value).toBe('Tên mới');
    (document.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(document.querySelector('#settings-notice')?.textContent).toContain('Đã lưu'));
    expect(document.querySelector('#settings-notice')?.getAttribute('data-kind')).toBe('success');
    expect(JSON.parse(requests[0].body)).toEqual({revision: 0, patch: {localized: {vi: {website_name: 'Tên mới'}}}});
    router.navigate('/control/members');
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Người dùng'));
    router.navigate('/control/settings?content_locale=vi');
    await vi.waitFor(() => expect(document.querySelector('#setting-website_name')).not.toBeNull());
    await selectHeaderLanguage('en');
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Website information'));
    expect((document.querySelector('#settings-content-locale') as HTMLSelectElement).value).toBe('vi');
    expect((document.querySelector('#setting-website_name') as HTMLInputElement).value).toBe('Tên mới');
    expect(document.querySelectorAll('.saola-admin')).toHaveLength(1);
});

it('hydrates submenu disclosure, switches settings categories and restores the active child on cached navigation', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const doc = new DOMParser().parseFromString(readFileSync(path.join(root, 'public/settings-vi.html'), 'utf8'), 'text/html');
    const script = [...doc.querySelectorAll('script')].find(script => script.textContent?.startsWith('window.APP_CONFIGS='))!.textContent!;
    const config = JSON.parse(script.replace('window.APP_CONFIGS=', '').replace(/;$/, ''));
    const ssr = JSON.parse(doc.querySelector('script[data-ref="saola-ssr"]')!.textContent!);
    document.body.innerHTML = doc.body.innerHTML; window.history.replaceState({}, '', '/control/settings?content_locale=vi');
    const shared = app() as any; shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper); shared.set('AdminUI', new AdminUI(shared)); shared.set('Admin', shared.make('AdminUI')); helper.initTranslations(config.i18n);
    shared.set('Http', {setHeader: vi.fn(), get: vi.fn(async (url: string) => ({data: fixture(url.includes('group=system') ? 'system-page-vi.json' : 'settings-page-vi.json')}))});
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: config.view.systemData, ssrData: config.view.ssrData, ssr, registry: {
        'admin.themes.classic.pages.settings': SettingsPage, 'admin.themes.classic.components.settings-form': SettingsRenderer, 'admin.themes.classic.layouts.shell': Shell,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm); router.configure(config.router); router.start();
    await vi.waitFor(() => expect(vm!.getCurrentView()).not.toBeNull());
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings a[aria-current="page"]')?.textContent).toBe('Website'));
    const toggle = () => document.querySelector('button[aria-controls="admin-submenu-settings"]') as HTMLButtonElement;
    toggle().click(); await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings')).toBeNull());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    // Desktop hover also works on hybrid devices whose primary input reports no hover.
    vi.stubGlobal('matchMedia', () => ({matches: false}));
    toggle().closest('.sa-admin-nav-group')!.dispatchEvent(new MouseEvent('mouseenter'));
    await vi.waitFor(() => expect(document.querySelectorAll('#admin-submenu-settings a')).toHaveLength(2));
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.sa-admin-flyout-title')).toBeNull();
    toggle().closest('.sa-admin-nav-group')!.dispatchEvent(new MouseEvent('mouseleave'));
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings')).toBeNull());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    toggle().click(); await vi.waitFor(() => expect(document.querySelectorAll('#admin-submenu-settings a')).toHaveLength(2));
    toggle().closest('.sa-admin-nav-group')!.dispatchEvent(new MouseEvent('mouseleave'));
    await vi.waitFor(() => expect(document.querySelectorAll('#admin-submenu-settings a')).toHaveLength(2));
    const system = new URL((document.querySelector('#admin-submenu-settings a[href*="group=system"]') as HTMLAnchorElement).href);
    await router.navigate(system.pathname + system.search);
    await vi.waitFor(() => expect(document.querySelector('[data-settings-group]')?.getAttribute('data-settings-group')).toBe('system'));
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings a[aria-current="page"]')?.textContent).toBe('Hệ thống'));
    expect(document.querySelectorAll('#settings-group-navigation a')).toHaveLength(2);
    expect(document.querySelector('#settings-group-navigation a[aria-current="page"]')?.textContent).toBe('Vận hành');
    expect(document.querySelector('#settings-content-locale')).toBeNull();
    await router.navigate('/control/settings?content_locale=vi');
    await vi.waitFor(() => expect(document.querySelector('[data-settings-group]')?.getAttribute('data-settings-group')).toBe('general'));
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings a[aria-current="page"]')?.textContent).toBe('Website'));
    expect(document.querySelectorAll('#settings-group-navigation a')).toHaveLength(4);
    expect(document.querySelectorAll('.saola-admin')).toHaveLength(1);
    expect(toggle().classList.contains('is-active')).toBe(true);
    expect(toggle().closest('.sa-admin-nav-group')?.classList.contains('is-side-flyout')).toBe(false);
    expect(document.querySelectorAll('.sa-admin-nav-icon').length).toBeGreaterThan(3);
    // On a different page the same group must float sideways, even if it was open before.
    shared.make('AdminUI').setCurrentPage('workspace');
    await vi.waitFor(() => expect(toggle().classList.contains('is-active')).toBe(false));
    expect(document.querySelector('#admin-submenu-settings')).toBeNull();
    toggle().closest('.sa-admin-nav-group')!.dispatchEvent(new MouseEvent('mouseenter'));
    await vi.waitFor(() => expect(toggle().closest('.sa-admin-nav-group')?.classList.contains('is-side-flyout')).toBe(true));
    expect(document.querySelectorAll('#admin-submenu-settings a')).toHaveLength(2);
    expect(document.querySelector('.sa-admin-flyout-title')).toBeNull();
    toggle().closest('.sa-admin-nav-group')!.dispatchEvent(new MouseEvent('mouseleave'));
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings')).toBeNull());
    toggle().click();
    await vi.waitFor(() => expect(toggle().closest('.sa-admin-nav-group')?.classList.contains('is-side-flyout')).toBe(true));
    (document.querySelector('#admin-submenu-settings a') as HTMLAnchorElement).focus();
    expect(document.querySelector('#admin-submenu-settings')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings')).toBeNull());
    shared.make('AdminUI').setCurrentPage('settings.website');
    await vi.waitFor(() => expect(toggle().classList.contains('is-active')).toBe(true));
    expect(toggle().closest('.sa-admin-nav-group')?.classList.contains('is-side-flyout')).toBe(false);
    (document.querySelector('#admin-menu-toggle') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('.saola-admin')?.classList.contains('is-sidebar-compact')).toBe(true));
    expect(document.querySelector('#admin-submenu-settings')).toBeNull();
    const group = toggle().closest('.sa-admin-nav-group') as HTMLElement;
    group.dispatchEvent(new FocusEvent('focusin', {bubbles: true}));
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings')).not.toBeNull());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().classList.contains('is-active')).toBe(true);
    expect(document.querySelector('#admin-submenu-settings a[aria-current="page"]')?.textContent).toBe('Website');
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings')).toBeNull());
    expect(document.activeElement).toBe(toggle());
    group.dispatchEvent(new MouseEvent('mouseenter'));
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings')).not.toBeNull());
    expect(document.querySelector('.sa-admin-flyout-title')?.textContent).toBe('Thiết lập');
    expect(document.activeElement).toBe(toggle());
    group.dispatchEvent(new MouseEvent('mouseleave'));
    await vi.waitFor(() => expect(document.querySelector('#admin-submenu-settings')).toBeNull());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    const leaf = document.querySelector('.sa-admin-nav-item[href]') as HTMLAnchorElement;
    leaf.closest('.sa-admin-nav-group')!.dispatchEvent(new MouseEvent('mouseenter'));
    await vi.waitFor(() => expect(document.querySelector('.sa-admin-flyout-label')?.textContent).toBe(leaf.getAttribute('aria-label')));
    expect(window.location.pathname).toBe('/control/settings');
    leaf.closest('.sa-admin-nav-group')!.dispatchEvent(new MouseEvent('mouseleave'));
    await vi.waitFor(() => expect(document.querySelector('.sa-admin-flyout-label')).toBeNull());
    vi.stubGlobal('innerWidth', 390);
    window.dispatchEvent(new Event('resize'));
    group.dispatchEvent(new MouseEvent('mouseenter'));
    await vi.waitFor(() => expect(document.querySelector('.saola-admin')?.classList.contains('is-sidebar-compact')).toBe(false));
    expect(document.querySelector('.sa-admin-flyout-title')).toBeNull();
});

it.each(['classic', 'material'])('%s settings exposes field errors, restores native inputs on discard and distinguishes successful feedback', async theme => {
    const base = `admin.themes.${theme}.`;
    const [ThemePage, ThemeForm, ThemeShell] = theme === 'classic' ? [SettingsPage, SettingsRenderer, Shell]
        : [(await import('../fixtures/compiled/.generated/js/material-admin-settings-page')).default,
            (await import('../fixtures/compiled/.generated/js/material-admin-settings-form')).default,
            (await import('../fixtures/compiled/.generated/js/material-admin-shell')).default];
    const envelope = fixture('settings-page-vi.json'); envelope.view = base + 'pages.settings';
    const shared = app() as any; shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper); const ui = new AdminUI(shared); shared.set('AdminUI', ui); shared.set('Admin', ui); helper.initTranslations(envelope.i18n);
    shared.set('Http', {setHeader: vi.fn(), get: vi.fn(async () => ({data: envelope}))});
    let reject = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
        if (reject) return response({errors: {'patch.localized.vi.website_name': ['Invalid name.']}}, 422);
        const result = fixture('settings-api.json'); result.data.revision = 1;
        result.data.localized = {vi: {website_name: JSON.parse(String(options?.body)).patch.localized.vi.website_name}};
        return response(result);
    });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    document.body.innerHTML = '<div id="app-root"></div>'; window.history.replaceState({}, '', '/control/settings?content_locale=vi');
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: {__base__: base}, registry: {
        [base + 'pages.settings']: ThemePage, [base + 'components.settings-form']: ThemeForm, [base + 'layouts.shell']: ThemeShell,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm);
    router.configure({routes: [{path: '/control/settings', component: base + 'pages.settings'}]}); router.start();
    await vi.waitFor(() => expect(document.getElementById('setting-website_name')).not.toBeNull());
    const field = document.getElementById('setting-website_name') as HTMLInputElement;
    const initial = field.value; field.value = 'Bad draft'; field.dispatchEvent(new Event('input', {bubbles: true}));
    document.querySelector('form[data-settings-group]')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'));
    await vi.waitFor(() => expect(document.activeElement).toBe(field));
    expect(document.getElementById('settings-notice')?.getAttribute('data-kind')).toBe('error');
    expect(field.value).toBe('Bad draft');
    (document.getElementById('settings-discard') as HTMLButtonElement).click();
    await vi.waitFor(() => expect((document.getElementById('setting-website_name') as HTMLInputElement).value).toBe(initial));
    expect(document.getElementById('setting-website_name')).not.toBe(field);
    expect(ui.canChangeLanguage()).toBe(true);
    const next = document.getElementById('setting-website_name') as HTMLInputElement;
    next.value = 'Good name'; next.dispatchEvent(new Event('input', {bubbles: true})); reject = false;
    document.querySelector('form[data-settings-group]')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(document.getElementById('settings-notice')?.getAttribute('data-kind')).toBe('success'));
    expect(next.getAttribute('aria-invalid')).toBe('false'); expect(ui.canChangeLanguage()).toBe(true);
});
