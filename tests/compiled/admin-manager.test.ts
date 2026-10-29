import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {ResourceManager, type Management} from '../../../admin/resources/saola/admin/app/resource-manager';
import {AdminUI} from '../../../admin/resources/saola/admin/app/bundle';
import {app} from '../../src/core/helpers/app';
import {HelperService} from '../../src/core/services/HelperService';
import {ViewManager} from '../../src/core/view/ViewManager';
import {Router} from '../../src/core/routers/Router';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import {StoreService} from '../../src/core/services/StoreService';
import Page from '../fixtures/compiled/.generated/js/admin-page';
import Shell from '../fixtures/compiled/.generated/js/admin-shell';
import Manager from '../fixtures/compiled/.generated/js/admin-manager';
import MaterialPage from '../fixtures/compiled/.generated/js/material-admin-page';
import MaterialShell from '../fixtures/compiled/.generated/js/material-admin-shell';
import Input from '../fixtures/compiled/.generated/js/admin-input';
import MaterialInput from '../fixtures/compiled/.generated/js/material-admin-input';
import MaterialManager from '../fixtures/compiled/.generated/js/material-admin-manager';
import {adminInputs} from '../fixtures/compiled/admin-input-registry';

const response = (body: any, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const metadata = (mode: Management['mode'] = 'list'): Management => ({schema: 1, key: 'categories', titleKey: 'admin.resource.records', mode,
    endpoint: '/control/_api/resources/categories' + (mode === 'edit' ? '/1' : ''), returnUrl: '/control/categories', csrfToken: 'csrf-token',
    canSave: mode !== 'list', revision: 'a'.repeat(64), fields: mode === 'list' ? [] : [
        {key: 'name', labelKey: 'admin.users.name', type: 'text', value: mode === 'edit' ? 'Original' : '', readOnly: false, required: true, writeOnly: false, maxLength: 100, options: []},
        {key: 'password', labelKey: 'admin.resource.password', type: 'password', value: '', readOnly: false, required: false, writeOnly: true, maxLength: 200, options: []},
    ],
    rows: mode === 'list' ? [{id: '1', revision: 'a'.repeat(64), values: {name: '<b>Plain text</b>'}, selectable: true, actions: [
        {operation: 'edit', labelKey: 'admin.resource.edit', url: '/control/categories/1/edit'}, {operation: 'trash', labelKey: 'admin.resource.trash', url: ''},
    ]}] : [], columns: [{key: 'name', labelKey: 'admin.users.name'}], status: 'active', counts: {active: 1, trash: 0},
    createUrl: '/control/categories/create', activeUrl: '/control/categories', trashUrl: '/control/categories?status=trash',
    listing: {action: '/control/categories', locale: 'en', q: '', sort: 'name', direction: 'asc', perPage: 25, page: 1, total: 1, lastPage: 1,
        sortOptions: [{key: 'name', labelKey: 'admin.users.name'}], previous: '', next: ''},
});
let vm: ViewManager | undefined; let router: Router | undefined;
beforeEach(() => {
    const saved = new Map<string, string>();
    vi.stubGlobal('localStorage', {getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value), clear: () => saved.clear()});
});
afterEach(() => {
    router?.destroy(); vm?.destroy(); router = undefined; vm = undefined;
    BlockManager.destroy(); StoreService.instance('ViewManager').clear(); document.body.innerHTML = ''; window.history.replaceState({}, '', '/');
    vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it('sends only edited fields with revision, CSRF and no empty password; keeps a stable create receipt after lost acknowledgement', async () => {
    const edit = new ResourceManager(metadata('edit')); edit.change('name', 'Changed');
    const write = vi.fn().mockResolvedValue(response({schema: 1, id: '1', redirect: '/control/categories'}));
    await edit.save(write);
    expect(JSON.parse(write.mock.calls[0][1].body)).toEqual({revision: 'a'.repeat(64), values: {name: 'Changed'}});
    expect(write.mock.calls[0][1].headers['X-CSRF-TOKEN']).toBe('csrf-token'); expect(edit.dirty).toBe(false);
    const create = new ResourceManager(metadata('create')); create.change('name', 'New');
    const retry = vi.fn().mockRejectedValueOnce(new Error('Lost response')).mockResolvedValue(response({schema: 1, id: '2', redirect: '/control/categories'}));
    await create.save(retry); expect(create.dirty).toBe(true); await create.save(retry);
    expect(JSON.parse(retry.mock.calls[0][1].body).requestId).toBe(JSON.parse(retry.mock.calls[1][1].body).requestId);
    expect(create.redirect).toBe('/control/categories');
});

it('retains drafts on validation/conflict, blocks stale retries and ignores a response after suspension', async () => {
    const form = new ResourceManager(metadata('edit')); form.change('name', 'Draft'); form.change('password', 'Sensitive draft');
    await form.save(vi.fn().mockResolvedValue(response({errors: {name: ['Invalid name']}}, 422)));
    expect(form.errors.name).toBe('Invalid name'); expect(form.fields[1].value).toBe('Sensitive draft');
    await form.save(vi.fn().mockResolvedValue(response({}, 409)));
    expect(form.canSave).toBe(false); expect(form.notice).toBe('admin.resource.conflict');
    const denied = vi.fn(); await form.save(denied); expect(denied).not.toHaveBeenCalled();
    form.discard(); await form.reload(vi.fn().mockResolvedValue(response({schema: 1, resource: metadata('edit')})));
    form.change('name', 'Later'); let finish!: (value: Response) => void;
    const waiting = form.save(vi.fn(() => new Promise(resolve => { finish = resolve; })) as any);
    form.suspend(); finish(response({schema: 1, id: '1', redirect: '/control/categories'})); await waiting;
    expect(form.dirty).toBe(true); expect(form.redirect).toBe('');
});

it('keeps the filtered list destination after save and prevents a second acknowledged create', async () => {
    const data = metadata('create'); data.listUrl = '/control/categories?q=New&per_page=10&page=2';
    const form = new ResourceManager(data); form.change('name', 'New');
    const write = vi.fn().mockResolvedValue(response({schema: 1, id: '2', redirect: '/control/categories'}));
    await form.save(write); await form.save(write);
    expect(write).toHaveBeenCalledTimes(1); expect(form.redirect).toBe(data.listUrl); expect(form.canSave).toBe(false);
    const editData = metadata('edit'); editData.listUrl = data.listUrl;
    const edit = new ResourceManager(editData); const reload = vi.fn().mockResolvedValue(response({schema: 1, resource: editData}));
    await edit.reload(reload); expect(reload.mock.calls[0][0]).toBe(editData.listUrl);
});

it('normalizes integer DOM input without false dirty state and sends null for a cleared nullable value', async () => {
    const data = metadata('edit'); data.fields[0] = {...data.fields[0], type: 'integer', value: 10, nullable: true};
    const form = new ResourceManager(data); form.change('name', '10'); expect(form.dirty).toBe(false);
    form.change('name', ''); expect(form.dirty).toBe(true);
    const write = vi.fn().mockResolvedValue(response({schema: 1, id: '1', redirect: data.returnUrl}));
    await form.save(write); expect(JSON.parse(write.mock.calls[0][1].body).values).toEqual({name: null});
});

it('recognizes an HTML session-expired response and freezes further writes while preserving the draft', async () => {
    const form = new ResourceManager(metadata('edit')); form.change('name', 'Draft');
    const write = vi.fn().mockResolvedValue(new Response('<html>Page expired</html>', {status: 419}));
    await form.save(write); await form.save(write);
    expect(write).toHaveBeenCalledTimes(1); expect(form.notice).toBe('admin.resource.session_expired');
    expect(form.locked).toBe(true); expect(form.fields[0].value).toBe('Draft'); expect(form.dirty).toBe(true);
});

it('uses all selected revisions, refreshes counts with the same filter and does not report a failed refresh as an uncommitted action', async () => {
    window.history.replaceState({}, '', '/control/categories?status=active&q=Plain');
    const form = new ResourceManager(metadata()); form.selectAll(true);
    const after = metadata(); after.rows = []; after.counts = {active: 0, trash: 1}; after.listing.total = 0;
    const fetcher = vi.fn().mockResolvedValueOnce(response({schema: 1, affected: 1})).mockResolvedValueOnce(response({schema: 1, resource: after}));
    await form.transition('trash', undefined, fetcher);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({operation: 'trash', items: [{id: '1', revision: 'a'.repeat(64)}]});
    expect(fetcher.mock.calls[1][0]).toContain('?status=active&q=Plain'); expect(form.rows).toHaveLength(0); expect(form.selectedCount).toBe(0);
    const uncertain = new ResourceManager(metadata());
    await uncertain.transition('trash', '1', vi.fn().mockResolvedValueOnce(response({schema: 1, affected: 1})).mockRejectedValueOnce(new Error('Offline')));
    expect(uncertain.notice).toBe('admin.resource.changed_reload');
    const retry = vi.fn(); await uncertain.transition('trash', '1', retry); expect(retry).not.toHaveBeenCalled();
});

it.each(['classic', 'material'])('renders %s list/form, guards drafts, escapes values and refreshes the cached list after save', async (theme) => {
    const prefix = 'admin.themes.' + theme + '.';
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const shared = app() as any; shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper); const ui = new AdminUI(shared); shared.set('AdminUI', ui); shared.set('Admin', ui);
    const messages = JSON.parse(readFileSync(path.join(__dirname, '../fixtures/compiled/.generated/admin-en.json'), 'utf8'));
    const i18n = {scope: 'admin:manager', locale: 'en', fallbackLocale: 'en', catalogs: {en: {scope: 'admin:manager', revision: 1, messages}}};
    helper.initTranslations(i18n);
    let saved = false; let rejectFirstSave = true;
    shared.set('Http', {setHeader: vi.fn(), get: vi.fn(async (url: string) => ({data: {view: prefix + 'pages.resource', i18n,
        data: {page: {schema: 1, titleKey: 'admin.resource.records', fields: [], columns: [], rows: []},
            management: metadata(url.includes('/create') ? 'create' : url.includes('/edit') ? 'edit' : 'list'),
            brand: 'Admin', currentPage: 'categories', navigation: [{key: 'categories', titleKey: 'admin.resource.records', url: '/control/categories'}],
            locales: [{code: 'en', name: 'English'}], dictionaryPattern: '/dictionary/_locale_', uiLocale: 'en', account: {}},
    }}))});
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
        if (options?.method === 'POST' && rejectFirstSave) { rejectFirstSave = false; return response({errors: {name: ['Choose another name.']}}, 422); }
        if (options?.method === 'POST') { saved = true; return response({schema: 1, id: '2', redirect: '/control/categories'}); }
        const list = metadata(); if (saved) list.rows[0].values.name = 'Saved <b>name</b>';
        return response({schema: 1, resource: list});
    });
    document.body.innerHTML = '<div id="app-root"></div>'; window.history.replaceState({}, '', '/control/categories');
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: {__base__: prefix}, registry: {...adminInputs(theme), [prefix + 'pages.resource']: theme === 'classic' ? Page : MaterialPage, [prefix + 'layouts.shell']: theme === 'classic' ? Shell : MaterialShell, [prefix + 'components.input']: theme === 'classic' ? Input : MaterialInput, [prefix + 'components.manager']: theme === 'classic' ? Manager : MaterialManager}});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm);
    router.configure({routes: [{path: '/control/categories', component: prefix + 'pages.resource'}, {path: '/control/categories/create', component: prefix + 'pages.resource'}]}); router.start();
    await vi.waitFor(() => expect(document.querySelector('tbody')?.textContent).toContain('<b>Plain text</b>'));
    expect(document.querySelector('tbody b')).toBeNull();
    const filters = document.querySelector('.sa-admin-filter-toggle') as HTMLButtonElement;
    expect(filters.getAttribute('aria-expanded')).toBe('false'); filters.click();
    await vi.waitFor(() => expect(filters.getAttribute('aria-expanded')).toBe('true'));
    expect(document.querySelector('#managed-filter-options')?.classList.contains('is-open')).toBe(true);
    await router.navigate('/control/categories/create');
    await vi.waitFor(() => expect(document.querySelector('#resource-field-name')).not.toBeNull());
    const input = document.querySelector('#resource-field-name') as HTMLInputElement; input.value = 'New'; input.dispatchEvent(new Event('input', {bubbles: true}));
    expect(ui.canChangeLanguage()).toBe(false);
    await router.navigate('/control/categories');
    expect(window.location.pathname).toBe('/control/categories/create');
    (input.form as HTMLFormElement).dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(document.querySelector('#resource-error-name')?.textContent).toBe('Choose another name.'));
    expect(input.getAttribute('aria-invalid')).toBe('true');
    // The controller focuses after two animation frames, after reactive DOM updates.
    await vi.waitFor(() => expect(document.activeElement).toBe(input));
    expect((document.querySelector('#resource-notice') as HTMLElement).textContent).toContain('Choose another name.');
    input.value = 'Another name'; input.dispatchEvent(new Event('input', {bubbles: true}));
    (input.form as HTMLFormElement).dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(window.location.pathname).toBe('/control/categories'));
    await vi.waitFor(() => expect(document.querySelector('tbody')?.textContent).toContain('Saved <b>name</b>'));
    expect(document.querySelector('tbody b')).toBeNull(); expect(document.querySelectorAll('.sa-admin-resource-manager')).toHaveLength(1);
    await router.navigate('/control/categories/create');
    await vi.waitFor(() => expect((document.querySelector('#resource-field-name') as HTMLInputElement)?.value).toBe(''));
    expect((document.querySelector('#resource-field-password') as HTMLInputElement).value).toBe('');
    const cancelled = document.querySelector('#resource-field-name') as HTMLInputElement;
    cancelled.value = 'Cancelled draft'; cancelled.dispatchEvent(new Event('input', {bubbles: true}));
    (Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Back to list') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(window.location.pathname).toBe('/control/categories'));
    await router.navigate('/control/categories/create');
    await vi.waitFor(() => expect((document.querySelector('#resource-field-name') as HTMLInputElement)?.value).toBe(''));
});
