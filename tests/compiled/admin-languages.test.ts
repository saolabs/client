import {afterEach, expect, it, vi} from 'vitest';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {LanguageForm, type LanguageEditor} from '../../../admin/resources/saola/admin/app/language-form';
import {AdminUI} from '../../../admin/resources/saola/admin/app/bundle';
import {app} from '../../src/core/helpers/app';
import {HelperService} from '../../src/core/services/HelperService';
import {ViewManager} from '../../src/core/view/ViewManager';
import {Router} from '../../src/core/routers/Router';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import {StoreService} from '../../src/core/services/StoreService';
import LanguagesPage from '../fixtures/compiled/.generated/js/admin-languages-page';
import LanguagesRenderer from '../fixtures/compiled/.generated/js/admin-languages-form';
import Page from '../fixtures/compiled/.generated/js/admin-page';
import Resource from '../fixtures/compiled/.generated/js/admin-renderer';
import Shell from '../fixtures/compiled/.generated/js/admin-shell';

const root = path.join(__dirname, '../fixtures/compiled/.generated/admin-ssr');
const fixture = (name: string) => JSON.parse(readFileSync(path.join(root, name), 'utf8'));
const editor = (): LanguageEditor => fixture('languages-page-en.json').data.languageEditor;
const response = (data: any, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json'}});
const file = (json: string, name = 'ja.11111111-1111-4111-8111-111111111111.json') => ({name, size: new TextEncoder().encode(json).length, text: async () => json}) as File;
const preview = {batch: '22222222-2222-4222-8222-222222222222', locale: 'en', status: 'preview', changes: {'admin.users.title': ''}, untranslated: []};
async function selectHeaderLanguage(code: string): Promise<void> {
    (document.querySelector('#admin-language-toggle') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector(`.sa-admin-languages button[data-locale="${code}"]`)).not.toBeNull());
    (document.querySelector(`.sa-admin-languages button[data-locale="${code}"]`) as HTMLButtonElement).click();
}
let vm: ViewManager | undefined; let router: Router | undefined;
afterEach(() => {
    vm?.destroy(); router?.destroy(); vm = undefined; router = undefined;
    BlockManager.destroy(); StoreService.instance('ViewManager').clear();
    document.body.innerHTML = ''; window.history.replaceState({}, '', '/'); vi.restoreAllMocks();
});

it('adds locale metadata and sends a revision with strict flags, CSRF and no dictionary revisions', async () => {
    const initial = editor(); const form = new LanguageForm(initial);
    expect(form.add('EN', 'Duplicate')).toBe(false);
    expect(form.add('ja', '日本語')).toBe(true); form.changeDefault('contentDefault', 'ja');
    const next = {...initial, document: {...form.document, revision: 1}};
    const send = vi.fn().mockResolvedValue(response({editor: next}));
    await form.save(send);
    const [endpoint, options] = send.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(endpoint).toBe('/control/_api/languages');
    expect(body.revision).toBe(0); expect(body.contentDefault).toBe('ja');
    expect(body.locales.at(-1)).toEqual({code: 'ja', name: '日本語', uiEnabled: true, contentEnabled: true});
    expect(body.locales[0]).not.toHaveProperty('revision');
    expect(options.headers['X-CSRF-TOKEN']).toBe(initial.csrfToken); expect(options.credentials).toBe('same-origin');
    expect(form.dirty).toBe(false); expect(form.document.revision).toBe(1); expect(initial.document.revision).toBe(0);
});

it('preserves metadata on validation/network/malformed responses and requires reload after a conflict', async () => {
    const form = new LanguageForm(editor()); form.changeRow('en', 'name', 'Draft');
    for (const send of [vi.fn().mockResolvedValue(response({errors: {uiDefault: ['Invalid default']}}, 422)),
        vi.fn().mockRejectedValue(new Error('Offline')), vi.fn().mockResolvedValue(response({editor: editor()}))]) {
        await form.save(send); expect(form.document.locales[0].name).toBe('Draft'); expect(form.dirty).toBe(true);
    }
    await form.save(vi.fn().mockResolvedValue(response({}, 409)));
    expect(form.canSave).toBe(false); expect(form.document.revision).toBe(0);
    const retry = vi.fn(); await form.save(retry); expect(retry).not.toHaveBeenCalled();
    form.discard(); expect(form.canLeave()).toBe(true);
    await form.reload(vi.fn().mockResolvedValue(response({editor: {...editor(), document: {...editor().document, revision: 2}}})));
    expect(form.document.revision).toBe(2); form.changeRow('en', 'name', 'Next'); expect(form.canSave).toBe(true);
});

it('blocks duplicate writes and ignores late responses after the view suspends', async () => {
    const form = new LanguageForm(editor()); form.changeRow('en', 'name', 'Draft');
    let finish!: (value: Response) => void;
    const send = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    const pending = form.save(send); await form.save(send);
    expect(send).toHaveBeenCalledTimes(1); expect(form.canLeave()).toBe(false);
    form.suspend(); finish(response({editor: {...editor(), document: {...editor().document, revision: 1}}})); await pending;
    expect(send.mock.calls[0][1].signal.aborted).toBe(true);
    expect(form.document.locales[0].name).toBe('Draft'); expect(form.document.revision).toBe(0); expect(form.canSave).toBe(false);
});

it('keeps the complete JSON tree pure and carries the actor-bound baseline in the download filename', async () => {
    const form = new LanguageForm(editor());
    const tree = {admin: {users: {title: 'Users'}}, root_key: ''};
    const batch = '11111111-1111-4111-8111-111111111111';
    await form.exportJson(vi.fn().mockResolvedValue(response({editor: editor(), export: {batch, tree}})));
    expect(form.download?.filename).toBe(`en.${batch}.json`);
    expect(JSON.parse(form.download!.json)).toEqual(tree); expect(form.baseline).toBe(batch);
    expect(form.dirty).toBe(false);
});

it('keeps duplicate keys and empty strings intact until server validation and publishes only explicitly', async () => {
    const form = new LanguageForm(editor());
    const json = '{"admin":{"users":{"title":"A","title":""}}}';
    await form.loadFile(file(json)); expect(form.fileJson).toBe(json); expect(form.dirty).toBe(true);
    expect(form.selectLocale('vi')).toBe(false);
    const rejected = vi.fn().mockResolvedValue(response({errors: {json: ['Duplicate key']}}, 422));
    await form.previewJson(rejected); expect(form.fileJson).toBe(json); expect(form.details).toBe('Duplicate key');
    form.changeRow('en', 'name', 'Metadata draft'); expect(form.canSave).toBe(false); form.discard();
    await form.loadFile(file('{"admin":{"users":{"title":""}}}'));
    const send = vi.fn().mockResolvedValue(response({editor: editor(), preview}));
    await form.previewJson(send);
    expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({json: form.fileJson, exportBatch: form.baseline});
    expect(form.dirty).toBe(false); expect(form.changes).toEqual([{key: 'admin.users.title', value: ''}]);
    await form.apply(false, vi.fn().mockResolvedValue(response({editor: editor(), preview: {...preview, status: 'draft'}})));
    expect(form.preview?.status).toBe('draft'); expect(form.canPublish).toBe(true);
    const publish = vi.fn().mockResolvedValue(response({editor: editor(), preview: {...preview, status: 'published'}}));
    await form.apply(true, publish);
    expect(JSON.parse(publish.mock.calls[0][1].body)).toEqual({publish: true}); expect(form.canPublish).toBe(false);
});

it('guards pending file reads and ignores a late read after suspension', async () => {
    const form = new LanguageForm(editor()); let finish!: (value: string) => void;
    const pending = form.loadFile({size: 10, name: 'ja.json', text: () => new Promise<string>(resolve => { finish = resolve; })} as File);
    expect(form.canLeave()).toBe(false); form.suspend(); finish('{"save":"Late"}'); await pending;
    expect(form.fileJson).toBe(''); expect(form.busy).toBe(false);
    const huge = file('x'.repeat(editor().maxBytes + 1)); await form.loadFile(huge);
    expect(form.notice).toBe('admin.languages.file_large'); expect(form.fileJson).toBe('');
});

it('enforces read-only/import/publish permissions independently and keeps drafts after permission revocation', async () => {
    const initial = editor(); initial.permissions = {view: true, manage: false, export: false, import: false, publish: false};
    const form = new LanguageForm(initial); const send = vi.fn();
    expect(form.add('ja', 'Japanese')).toBe(false); form.changeDefault('uiDefault', 'vi');
    await form.loadFile(file('{}')); await form.save(send); await form.exportJson(send); await form.apply(true, send);
    expect(send).not.toHaveBeenCalled(); expect(form.dirty).toBe(false);
    const writer = new LanguageForm(editor()); writer.changeRow('en', 'name', 'Draft');
    await writer.save(vi.fn().mockResolvedValue(response({}, 403)));
    expect(writer.document.locales[0].name).toBe('Draft'); expect(writer.canSave).toBe(false);
});

it('hydrates real Laravel language markup, guards navigation and UI language changes, then saves metadata', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const doc = new DOMParser().parseFromString(readFileSync(path.join(root, 'public/languages-vi.html'), 'utf8'), 'text/html');
    const script = [...doc.querySelectorAll('script')].find(script => script.textContent?.startsWith('window.APP_CONFIGS='))!.textContent!;
    const config = JSON.parse(script.replace('window.APP_CONFIGS=', '').replace(/;$/, ''));
    const ssr = JSON.parse(doc.querySelector('script[data-ref="saola-ssr"]')!.textContent!);
    document.body.innerHTML = doc.body.innerHTML; window.history.replaceState({}, '', '/control/languages?locale=vi');
    const shared = app() as any; shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper); shared.set('AdminUI', new AdminUI(shared)); shared.set('Admin', shared.make('AdminUI')); helper.initTranslations(config.i18n);
    shared.set('Http', {setHeader: vi.fn(), get: vi.fn(async (url: string) => ({data: fixture(url.includes('/languages') ? `languages-page-${helper.getLocale()}.json` : `page-${helper.getLocale()}.json`)}))});
    const writes: any[] = []; let server = editor();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
        if (String(url).includes('/saola/languages/')) return response(fixture('dictionary-en.json'));
        writes.push(options); const body = JSON.parse(options!.body as string);
        if (String(url).endsWith('/ja/preview')) return response({editor: server, preview: {...preview, locale: 'ja', changes: {'admin.users.title': '<img src=x onerror=alert(1)>'}}});
        if (String(url).includes('/batches/')) {
            if (body.publish) server.document.locales.find(row => row.code === 'ja')!.revision = 1;
            return response({editor: server, preview: {...preview, locale: 'ja', status: body.publish ? 'published' : 'draft'}});
        }
        server = {...editor(), document: {...body, revision: body.revision + 1, locales: body.locales.map((row: any) => ({...row, revision: row.code === 'ja' ? 0 : 1}))}};
        return response({editor: server});
    });
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({container: '#app-root', systemData: config.view.systemData, ssrData: config.view.ssrData, ssr, registry: {
        'admin.classic.pages.languages': LanguagesPage, 'admin.classic.components.languages': LanguagesRenderer,
        'admin.classic.layouts.shell': Shell, 'admin.classic.pages.resource': Page, 'admin.classic.components.resource': Resource,
    }});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm); router.configure(config.router); router.start();
    await vi.waitFor(() => expect(vm!.getCurrentView()).not.toBeNull());
    expect(document.querySelector('#admin-page-title')?.textContent).toBe('Ngôn ngữ');
    const code = document.querySelector('#language-new-code') as HTMLInputElement; code.value = 'ja';
    (document.querySelector('#language-new-name') as HTMLInputElement).value = '日本語';
    code.closest('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect((document.querySelector('#language-save') as HTMLButtonElement).disabled).toBe(false));
    await selectHeaderLanguage('en');
    await vi.waitFor(() => expect(document.querySelector('#language-notice')?.textContent).toContain('lưu hoặc bỏ'));
    expect(helper.getLocale()).toBe('vi');
    expect(document.querySelector('#language-notice')?.getAttribute('data-kind')).toBe('warning');
    await router.navigate('/control'); expect(window.location.pathname).toBe('/control/languages');
    const select = document.querySelector('#language-content-default') as HTMLSelectElement;
    select.value = 'ja'; select.dispatchEvent(new Event('change', {bubbles: true}));
    document.querySelector('#language-save')!.closest('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await vi.waitFor(() => expect(document.querySelector('#language-notice')?.textContent).toBe(helper.text('admin.languages.saved')));
    expect(document.querySelector('#language-notice')?.getAttribute('data-kind')).toBe('success');
    expect(JSON.parse(writes[0].body).contentDefault).toBe('ja');
    expect((document.querySelector('#language-target') as HTMLSelectElement).options).toHaveLength(3);
    expect((document.querySelector('#language-ui-default') as HTMLSelectElement).options).toHaveLength(2);
    const target = document.querySelector('#language-target') as HTMLSelectElement;
    target.value = 'ja'; target.dispatchEvent(new Event('change', {bubbles: true}));
    const upload = document.querySelector('#language-file') as HTMLInputElement;
    Object.defineProperty(upload, 'files', {configurable: true, value: [file('{"admin":{"users":{"title":"<img src=x onerror=alert(1)>"}}}') ]});
    upload.dispatchEvent(new Event('change', {bubbles: true}));
    await vi.waitFor(() => expect((document.querySelector('#language-preview') as HTMLButtonElement).disabled).toBe(false));
    (document.querySelector('#language-preview') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('.sa-admin-language-preview dd')?.textContent).toBe('<img src=x onerror=alert(1)>'));
    expect(document.querySelector('.sa-admin-language-preview img')).toBeNull();
    (document.querySelector('#language-draft') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#language-notice')?.textContent).toBe(helper.text('admin.languages.draft_saved')));
    (document.querySelector('#language-publish') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#language-notice')?.textContent).toBe(helper.text('admin.languages.published')));
    expect((document.querySelector('#language-publish') as HTMLButtonElement).disabled).toBe(true);
    expect((document.querySelector('#language-ui-default') as HTMLSelectElement).options).toHaveLength(3);
    expect(JSON.parse(writes[1].body).json).toBe('{"admin":{"users":{"title":"<img src=x onerror=alert(1)>"}}}');
    expect(JSON.parse(writes[2].body)).toEqual({publish: false}); expect(JSON.parse(writes[3].body)).toEqual({publish: true});
    await router.navigate('/control');
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Tổng quan'));
    expect([...document.querySelectorAll('.sa-admin-nav-item[aria-current="page"]')].map(link => link.textContent?.trim())).toEqual(['Tổng quan']);
    await router.navigate('/control/languages');
    await vi.waitFor(() => expect(document.querySelector('#admin-page-title')?.textContent).toBe('Ngôn ngữ'));
    expect([...document.querySelectorAll('.sa-admin-nav-item[aria-current="page"]')].map(link => link.textContent?.trim())).toEqual(['Ngôn ngữ']);
    expect(document.querySelectorAll('.saola-admin')).toHaveLength(1);
});
