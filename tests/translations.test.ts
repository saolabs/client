import { afterEach, expect, it, vi } from 'vitest';
import { HelperService } from '../src/core/services/HelperService';
import { readBootConfig } from '../src/core/bootstrap/ssr';
import { Router } from '../src/core/routers/Router';
import { ViewManager } from '../src/core/view/ViewManager';
import { app } from '../src/core/helpers/app';
import MarkerRegistry from '../src/core/services/MarkerRegistry';
import BlockManager from '../src/core/services/BlockManager';
import { StoreService } from '../src/core/services/StoreService';
import I18nPage from './fixtures/compiled/.generated/js/i18n-page';
import I18nLayout from './fixtures/compiled/.generated/js/i18n-layout';

const i18n = { locale: 'en', fallbackLocale: 'en', messages: {
    en: { json: { 'Hello world': 'Hello world' }, groups: { messages: { title: 'Guide', welcome: 'Hello :name', fallback: 'Fallback', apples: 'One apple|:count apples' }, 'pkg::labels': { title: 'Package' } } },
    vi: { json: { 'Hello world': 'Xin chào' }, groups: { messages: { title: 'Hướng dẫn', welcome: 'Chào :name', apples: '{0} Không có táo|{1} Một quả táo|[2,*] :count quả táo' } } },
} };
let vm: ViewManager | undefined;
let router: Router | undefined;
afterEach(() => {
    router?.destroy(); vm?.destroy(); router = undefined; vm = undefined;
    BlockManager.destroy(); StoreService.instance('ViewManager').clear();
    document.body.innerHTML = ''; delete (window as any).APP_CONFIGS;
    window.history.replaceState({}, '', '/'); vi.restoreAllMocks();
});

it('looks up PHP groups, JSON sentences, package keys, fallback and replacement without requests', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const helper = new HelperService(); helper.initTranslations(i18n);
    expect(helper.__('messages.welcome', { name: 'Lan' })).toBe('Hello Lan');
    helper.setLocale('vi');
    expect(helper.lang('Hello world')).toBe('Xin chào');
    expect(helper.trans('messages.fallback')).toBe('Fallback');
    expect(helper.trans('pkg::labels.title')).toBe('Package');
    expect(helper.__('missing.key')).toBe('missing.key');
    expect(helper.choice('messages.apples', 2)).toBe('2 quả táo');
    expect(helper.choice('messages.apples', 0)).toBe('Không có táo');
    expect(helper.choice('messages.apples', 1)).toBe('Một quả táo');
    expect(helper.trans_choice('messages.apples', 2, {}, 'en')).toBe('2 apples');
    expect(() => helper.setLocale('fr')).toThrow('not bundled');
    expect(helper.getLocale()).toBe('vi');
    expect(fetch).not.toHaveBeenCalled();
});

it('maps bundled i18n boot configuration', () => {
    (window as any).APP_CONFIGS = { i18n };
    expect(readBootConfig()?.i18n).toEqual(i18n);
});

it('renders real compiled translations and remounts page plus layout when switching locale', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const fetch = vi.spyOn(globalThis, 'fetch');
    const shared = app() as any;
    shared.set('Registry', MarkerRegistry);
    const helper = new HelperService(shared); shared.set('Helper', helper);
    const httpHeader = vi.fn();
    shared.set('Http', { setHeader: httpHeader });
    const apiHeader = vi.fn();
    shared.set('API', { getHttpService: () => ({ setHeader: apiHeader }) });
    document.body.innerHTML = '<div id="app-root"></div>';
    vm = new ViewManager(shared); shared.set('View', vm);
    vm.init({ systemData: { __layout__: '' }, container: document.getElementById('app-root')!, registry: { 'fixtures.i18n-page': I18nPage, 'fixtures.i18n-layout': I18nLayout } });
    router = new Router(shared); shared.set('Router', router);
    router.setViewManager(vm); router.configure({ routes: [{ path: '/', component: 'fixtures.i18n-page' }] });
    helper.initTranslations(i18n); router.start();
    await vi.waitFor(() => expect(document.querySelector('#translated-page')?.textContent?.trim()).toBe('Hello Lan'));
    expect(document.querySelector('#translated-header')?.textContent?.trim()).toBe('Guide');
    helper.setLocale('vi');
    await vi.waitFor(() => expect(document.querySelector('#translated-page')?.textContent?.trim()).toBe('Chào Lan'));
    expect(document.querySelector('#translated-header')?.textContent?.trim()).toBe('Hướng dẫn');
    expect(document.querySelector('#translated-count')?.textContent?.trim()).toBe('2 quả táo');
    expect(document.documentElement.lang).toBe('vi');
    expect(httpHeader).toHaveBeenLastCalledWith('Accept-Language', 'vi');
    expect(apiHeader).toHaveBeenLastCalledWith('Accept-Language', 'vi');
    expect(fetch).not.toHaveBeenCalled();
});
