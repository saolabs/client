import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpService } from '../../src/core/services/HttpService';
import { HelperService } from '../../src/core/services/HelperService';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';

/**
 * Phong bì page-data mới (core 2.12): body chỉ {data, view?, auth?}; revision đi
 * bằng header, trạng thái view context và từ điển client tự tải khi lệch.
 */
type Reply = { status?: number; body: any; headers?: Record<string, string> };

function stubFetch(route: (url: string) => Reply) {
    const fetch = vi.fn(async (url: string) => {
        const reply = route(String(url));
        const status = reply.status ?? 200;
        return { ok: status < 300, status, statusText: '', url: '', headers: new Headers(reply.headers ?? {}), json: async () => reply.body };
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
}

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).APP_CONFIGS;
    vi.restoreAllMocks();
});

describe('HttpService — phong bì theo header', () => {
    it('gửi X-Saola-Client: 2 và tải view context đúng một lần khi revision lệch', async () => {
        (window as any).APP_CONFIGS = { view: { revision: 'old', systemData: { __context__: 'web' } } };
        const state = { context: 'web', revision: 'new', views: 'web', routes: [], sharedData: {}, systemData: { __context__: 'web', __site: { general: { website_name: 'Gehihi' } } } };
        const fetch = stubFetch(url => url.includes('/_saola/context/')
            ? { body: state }
            : { body: { data: { ok: true }, view: 'web.home' }, headers: { 'X-Saola-Envelope': '1', 'X-Saola-View-Revision': 'new' } });
        const events: any[] = [];
        const listener = (event: Event) => events.push((event as CustomEvent).detail);
        window.addEventListener('saola:view-context', listener);

        const http = new HttpService();
        const [first] = await Promise.all([http.get('/a'), http.get('/b', null, { dedupe: 'parallel' } as any)]);
        await HttpService.syncViewContext('web', 'new');
        window.removeEventListener('saola:view-context', listener);

        expect(first.data).toEqual({ data: { ok: true }, view: 'web.home' });
        const pageHeaders = fetch.mock.calls[0][1].headers;
        expect(pageHeaders['X-Saola-Client']).toBe('2');
        expect(pageHeaders['X-Saola-View-Revision']).toBe('old');
        const contextCalls = fetch.mock.calls.filter(([url]) => String(url).includes('/_saola/context/'));
        expect(contextCalls).toHaveLength(1);
        expect(String(contextCalls[0][0])).toBe('/_saola/context/web?r=new');
        expect(events).toHaveLength(1);
        expect(events[0].changed).toBe(true);
        expect(events[0].systemData.__site.general.website_name).toBe('Gehihi');
    });

    it('revision khớp thì không tải gì thêm', async () => {
        (window as any).APP_CONFIGS = { view: { revision: 'same', systemData: { __context__: 'web' } } };
        const fetch = stubFetch(() => ({ body: { data: {} }, headers: { 'X-Saola-Envelope': '1', 'X-Saola-View-Revision': 'same' } }));
        await new HttpService().get('/a');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('catalog cũ thì tải từ điển qua mẫu URL và cài vào Helper', async () => {
        const shared = app() as any;
        const helper = new HelperService(shared);
        app.instance('Helper', helper);
        helper.initTranslations({ locale: 'vi', fallbackLocale: 'vi', scope: 'web:abc', catalogs: { vi: { scope: 'web:abc', revision: 6, messages: { hi: 'Chào cũ' } } } } as any);
        (window as any).APP_CONFIGS = { view: { revision: 'r', systemData: { __context__: 'web' } }, i18n: { dictionary: '/system/languages/web/_locale_' } };
        const fetch = stubFetch(url => url.startsWith('/system/languages/')
            ? { body: { scope: 'web:abc', revision: 7, messages: { hi: 'Chào mới' } } }
            : { body: { data: {} }, headers: { 'X-Saola-Envelope': '1', 'X-Saola-View-Revision': 'r', 'X-Saola-Language-Revision': 'web:abc;vi=7' } });

        await new HttpService().get('/a');
        await HttpService.syncLanguage('web:abc;vi=7');

        expect(fetch.mock.calls.some(([url]) => url === '/system/languages/web/vi')).toBe(true);
        expect(helper.text('hi')).toBe('Chào mới');
    });

    it('không có mẫu URL từ điển thì phát saola:language-stale', async () => {
        (window as any).APP_CONFIGS = {};
        const stale = vi.fn();
        window.addEventListener('saola:language-stale', stale);
        await HttpService.syncLanguage('other:x;en=2');
        window.removeEventListener('saola:language-stale', stale);
        expect(stale).toHaveBeenCalledTimes(1);
        expect((stale.mock.calls[0][0] as CustomEvent).detail).toEqual({ scope: 'other:x', locales: ['en'] });
    });
});

describe('ViewManager — __site', () => {
    it('đổi __site theo view context và không cho data ghi đè', () => {
        const shared = app() as any;
        const vm = new ViewManager(shared);
        vm.init({ systemData: { __layout__: '', __site: { general: { website_name: 'Cũ' } } }, revision: 'a' });
        expect(vm.getSite()).toEqual({ general: { website_name: 'Cũ' } });

        vm.applyViewContext({ revision: 'b', systemData: { __site: { branding: { logo_url: '/l.svg' } } } });
        // Thay cả khối, không trộn sâu: nhóm server bỏ thì phải biến mất.
        expect(vm.getSite()).toEqual({ branding: { logo_url: '/l.svg' } });
        expect((vm as any).withSharedData({ __site: 'hack', a: 1 })).toEqual({ a: 1 });
        vm.destroy();
    });
});
