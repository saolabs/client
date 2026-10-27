import {afterEach, expect, it, vi} from 'vitest';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {MediaLibraryForm, type MediaEditor, type MediaItem} from '../../../admin/resources/saola/admin/app/media-library';
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
import MediaRenderer from '../fixtures/compiled/.generated/js/admin-media-library';
import Shell from '../fixtures/compiled/.generated/js/admin-shell';

const root = path.join(__dirname, '../fixtures/compiled/.generated/admin-ssr');
const fixture = (name: string) => JSON.parse(readFileSync(path.join(root, name), 'utf8'));
const response = (data: any, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json'}});
const item = (): MediaItem => ({id: '11111111-1111-4111-8111-111111111111', title: 'Logo', filename: 'logo.png', alt: '', caption: '',
    url: '/saola/media/11111111-1111-4111-8111-111111111111', mime: 'image/png', kind: 'image', size: 100, width: 10, height: 10, revision: 1, trashed: false, createdAt: '2026-10-25'});
const editor = (): MediaEditor => ({endpoint: '/control/_api/media', csrfToken: 'token', maxBytes: 1000, accept: 'image/png',
    permissions: {view: true, upload: true, update: true, delete: true}});
const list = (items: MediaItem[]) => ({data: {items, total: items.length, page: 1, perPage: 24}});
let vm: ViewManager | undefined; let router: Router | undefined;
afterEach(() => {
    vm?.destroy(); router?.destroy(); vm = undefined; router = undefined;
    BlockManager.destroy(); StoreService.instance('ViewManager').clear(); document.body.innerHTML = '';
    window.history.replaceState({}, '', '/'); vi.restoreAllMocks();
});

it('uploads multipart files with CSRF, then reloads and selects the server identity', async () => {
    const form = new MediaLibraryForm(editor(), true);
    const send = vi.fn().mockResolvedValueOnce(response({item: item()}, 201)).mockResolvedValueOnce(response(list([item()])));
    await form.upload([new File(['png'], 'logo.png', {type: 'image/png'})], send);
    const options = send.mock.calls[0][1];
    expect(options.body).toBeInstanceOf(FormData); expect(options.body.get('file').name).toBe('logo.png');
    expect(options.headers['X-CSRF-TOKEN']).toBe('token'); expect(options.headers['Content-Type']).toBeUndefined();
    expect(send.mock.calls[1][0]).toContain('kind=image');
    expect(form.selected?.id).toBe(item().id); expect(form.notice).toBe('admin.media.uploaded');
});

it('preserves a metadata draft after stale revision, blocks navigation and discards before reload', async () => {
    const form = new MediaLibraryForm(editor()); form.select(item()); form.edit('alt', 'Draft alt');
    expect(form.canLeave()).toBe(false);
    const load = vi.fn(); await form.load({}, load); expect(load).not.toHaveBeenCalled();
    const save = vi.fn().mockResolvedValue(response({}, 409)); await form.save(save);
    expect(JSON.parse(save.mock.calls[0][1].body)).toEqual({revision: 1, changes: {title: 'Logo', alt: 'Draft alt', caption: ''}});
    expect(form.alt).toBe('Draft alt'); expect(form.canSave).toBe(false);
    form.discard(); await form.load({}, vi.fn().mockResolvedValue(response(list([item()]))));
    form.select(item()); form.edit('alt', ''); expect(form.canLeave()).toBe(true);
});

it('revalidates selected files and refuses trashed or mismatched items in an image picker', async () => {
    const form = new MediaLibraryForm(editor(), true); form.select(item());
    expect(await form.choose(vi.fn().mockResolvedValue(response({item: {...item(), trashed: true}})))).toBeNull();
    expect(await form.choose(vi.fn().mockResolvedValue(response({item: {...item(), kind: 'document'}})))).toBeNull();
    expect(await form.choose(vi.fn().mockResolvedValue(response({item: item()})))).toEqual(item());
});

it('never applies responses from a suspended picker and does not upload oversized files', async () => {
    const form = new MediaLibraryForm(editor());
    let finish!: (value: Response) => void;
    const pending = form.load({}, vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    form.suspend(); finish(response(list([item()]))); await pending; expect(form.items).toEqual([]);
    await form.load({}, vi.fn().mockResolvedValue(response(list([]))));
    const send = vi.fn(); await form.upload([new File(['x'.repeat(1001)], 'large.png')], send);
    expect(send).not.toHaveBeenCalled(); expect(form.notice).toBe('admin.media.invalid_file');
});

it('moves to trash using the current revision and keeps read-only viewers from writing', async () => {
    const form = new MediaLibraryForm(editor()); form.select(item());
    const send = vi.fn().mockResolvedValueOnce(response({item: {...item(), trashed: true, revision: 2}})).mockResolvedValueOnce(response(list([])));
    await form.move(false, send);
    expect(send.mock.calls[0][0]).toBe(editor().endpoint + '/' + item().id + '/trash');
    expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({revision: 1}); expect(form.items).toEqual([]);
    const readonly = new MediaLibraryForm({...editor(), permissions: {view: true, upload: false, update: false, delete: false}});
    readonly.select(item()); readonly.edit('title', 'No permission'); expect(readonly.title).toBe('Logo');
    const blocked = vi.fn(); await readonly.upload([new File(['x'], 'logo.png')], blocked); await readonly.move(false, blocked); expect(blocked).not.toHaveBeenCalled();
});

it('hydrates real branding SSR, opens the shared picker and saves its selected URL through settings CAS', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const doc = new DOMParser().parseFromString(readFileSync(path.join(root, 'public/branding-vi.html'), 'utf8'), 'text/html');
    const script = [...doc.querySelectorAll('script')].find(script => script.textContent?.startsWith('window.APP_CONFIGS='))!.textContent!;
    const config = JSON.parse(script.replace('window.APP_CONFIGS=', '').replace(/;$/, ''));
    const ssr = JSON.parse(doc.querySelector('script[data-ref="saola-ssr"]')!.textContent!);
    document.body.innerHTML = doc.body.innerHTML; window.history.replaceState({}, '', '/control/settings?group=branding');
    const shared = app() as any; shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper); const ui = new AdminUI(shared); shared.set('AdminUI', ui); shared.set('Admin', ui); helper.initTranslations(config.i18n);
    shared.set('Http', {setHeader: vi.fn(), get: vi.fn(async () => ({data: fixture('branding-page-vi.json')}))});
    const media = fixture('media-api.json'); const picked = media.data.items[0]; const writes: any[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
        if (String(url).includes('/_api/media/')) return response({item: picked});
        if (String(url).includes('/_api/media')) return response(media);
        writes.push(options);
        const result = fixture('branding-api.json'); result.data.revision = 1; result.data.values = {logo_url: picked.url}; return response(result);
    });
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: config.view.systemData, ssrData: config.view.ssrData, ssr, registry: {
        'admin.classic.pages.settings': SettingsPage, 'admin.classic.components.settings-form': SettingsRenderer, 'admin.classic.components.media-library': MediaRenderer, 'admin.classic.layouts.shell': Shell,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm); router.configure(config.router); router.start();
    await vi.waitFor(() => expect(vm!.getCurrentView()).not.toBeNull());
    const choose = [...document.querySelectorAll('button')].find(button => button.textContent === 'Chọn từ thư viện')!; choose.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.sa-admin-media-tile')).toHaveLength(1));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    (document.querySelector('.sa-admin-media-tile') as HTMLButtonElement).click();
    await vi.waitFor(() => expect((document.querySelector('#media-select') as HTMLButtonElement).disabled).toBe(false));
    (document.querySelector('#media-select') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    expect((document.querySelector('#setting-logo_url') as HTMLInputElement).value).toBe(picked.url);
    expect(ui.canChangeLanguage()).toBe(false); expect(writes).toHaveLength(0);
    (document.querySelector('form[data-settings-group]') as HTMLFormElement).dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(document.querySelector('#settings-notice')?.textContent).toContain('Đã lưu'));
    expect(JSON.parse(writes[0].body)).toEqual({revision: 0, patch: {values: {logo_url: picked.url}}});
    expect(ui.canChangeLanguage()).toBe(true); expect(document.querySelectorAll('.saola-admin')).toHaveLength(1);
});

it.each(['classic', 'material'])('%s media page has a compact search group and omits empty/single-page navigation', async theme => {
    const [MediaPage, ThemeShell, Library] = theme === 'classic'
        ? [(await import('../fixtures/compiled/.generated/js/admin-media-page')).default, Shell, MediaRenderer]
        : [(await import('../fixtures/compiled/.generated/js/material-admin-media-page')).default,
            (await import('../fixtures/compiled/.generated/js/material-admin-shell')).default,
            (await import('../fixtures/compiled/.generated/js/material-admin-media-library')).default];
    const shared = app() as any; shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper); shared.set('AdminUI', new AdminUI(shared)); shared.set('Admin', shared.make('AdminUI'));
    const scope = 'admin:media-layout'; const messages = JSON.parse(readFileSync(path.join(root, '../admin-en.json'), 'utf8'));
    const i18n = {scope, locale: 'en', fallbackLocale: 'en', catalogs: {en: {scope, revision: 1, messages}}}; helper.initTranslations(i18n);
    const base = `admin.${theme}.`; let count = 0;
    shared.set('Http', {setHeader: vi.fn(), get: vi.fn(async () => ({data: {view: base + 'pages.media', i18n,
        data: {mediaEditor: {...editor(), initial: {items: [], total: 0, page: 1, perPage: 24}}, navigation: [], currentPage: 'media',
            brand: 'Admin', locales: [], dictionaryPattern: '', uiLocale: 'en', account: {}}}}))});
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response({data: {items: count ? [item()] : [], total: count, page: 1, perPage: 24}}));
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    document.body.innerHTML = '<div id="app-root"></div>'; window.history.replaceState({}, '', '/control/media');
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: {__base__: base}, registry: {
        [base + 'pages.media']: MediaPage, [base + 'layouts.shell']: ThemeShell, [base + 'components.media-library']: Library,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm);
    router.configure({routes: [{path: '/control/media', component: base + 'pages.media'}]}); router.start();
    await vi.waitFor(() => expect(document.querySelector('.sa-admin-media-empty strong')?.textContent).toBe('No files yet'));
    expect(document.querySelector('.sa-admin-media-pagination')).toBeNull();
    expect(document.querySelectorAll('.sa-admin-media-query input[type=search]')).toHaveLength(1);
    expect(document.querySelectorAll('.sa-admin-media-query button[type=submit]')).toHaveLength(1);
    const search = document.querySelector('.sa-admin-media-search') as HTMLFormElement;
    const input = search.querySelector('input[type=search]') as HTMLInputElement;
    input.value = 'Logo'; input.dispatchEvent(new Event('input', {bubbles: true})); count = 1;
    search.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(document.querySelectorAll('.sa-admin-media-tile')).toHaveLength(1));
    expect(fetcher.mock.calls.at(-1)?.[0]).toContain('q=Logo');
    expect(document.querySelectorAll('.sa-admin-media-pagination button')).toHaveLength(0);
    count = 48; search.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(document.querySelectorAll('.sa-admin-media-pagination button')).toHaveLength(2));
    expect((document.querySelectorAll('.sa-admin-media-pagination button')[0] as HTMLButtonElement).disabled).toBe(true);
    expect((document.querySelectorAll('.sa-admin-media-pagination button')[1] as HTMLButtonElement).disabled).toBe(false);
});
