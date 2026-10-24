import {afterEach, expect, it, vi} from 'vitest';
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
let vm: ViewManager | undefined; let router: Router | undefined;
afterEach(() => {
    vm?.destroy(); router?.destroy(); vm = undefined; router = undefined;
    BlockManager.destroy(); StoreService.instance('ViewManager').clear();
    document.body.innerHTML = ''; window.history.replaceState({}, '', '/'); vi.restoreAllMocks();
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
    const helper = new HelperService(shared); shared.set('Helper', helper); shared.set('AdminUI', new AdminUI()); helper.initTranslations(config.i18n);
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
        'admin.pages.settings': SettingsPage, 'admin.components.settings-form': SettingsRenderer,
        'admin.layouts.shell': Shell, 'admin.pages.resource': Page, 'admin.components.resource': Resource,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm); router.configure(config.router);
    const hostGuard = vi.fn(() => true); router.beforeEach(hostGuard); router.start();
    await vi.waitFor(() => expect(vm!.getCurrentView()).not.toBeNull());
    const input = document.querySelector('#setting-website_name') as HTMLInputElement;
    expect(input.value).toBe('Workbench');
    input.value = 'Tên mới'; input.dispatchEvent(new Event('input', {bubbles: true}));
    await vi.waitFor(() => expect((document.querySelector('#settings-save') as HTMLButtonElement).disabled).toBe(false));
    const switchEn = () => [...document.querySelectorAll('.sa-admin-languages button')].find(button => button.textContent === 'en') as HTMLButtonElement;
    switchEn().click();
    await vi.waitFor(() => expect(document.querySelector('#settings-notice')?.textContent).toContain('lưu hoặc bỏ'));
    expect(helper.getLocale()).toBe('vi');
    const select = document.querySelector('#settings-content-locale') as HTMLSelectElement;
    select.value = 'en'; select.dispatchEvent(new Event('change', {bubbles: true})); expect(select.value).toBe('vi');
    router.navigate('/control');
    await vi.waitFor(() => expect(hostGuard.mock.calls.length).toBeGreaterThan(1));
    expect(window.location.pathname).toBe('/control/settings'); expect(input.value).toBe('Tên mới');
    (document.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(document.querySelector('#settings-notice')?.textContent).toContain('Đã lưu'));
    expect(JSON.parse(requests[0].body)).toEqual({revision: 0, patch: {localized: {vi: {website_name: 'Tên mới'}}}});
    router.navigate('/control');
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Tổng quan'));
    router.navigate('/control/settings?content_locale=vi');
    await vi.waitFor(() => expect(document.querySelector('#setting-website_name')).not.toBeNull());
    switchEn().click();
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Website settings'));
    expect((document.querySelector('#settings-content-locale') as HTMLSelectElement).value).toBe('vi');
    expect((document.querySelector('#setting-website_name') as HTMLInputElement).value).toBe('Tên mới');
    expect(document.querySelectorAll('.saola-admin')).toHaveLength(1);
});
