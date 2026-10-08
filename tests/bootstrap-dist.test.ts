import { afterEach, describe, expect, it, vi } from 'vitest';
import { readBootConfig } from '../src/core/bootstrap/ssr';
import { ApiClient } from '../src/core/helpers/ApiClient';
import { resolveViewDataUrl } from '../src/core/view/ViewManager';

afterEach(() => { delete (window as any).APP_CONFIGS; vi.restoreAllMocks(); });

describe('standalone SPA boot', () => {
    it('carries separate API and page-data configuration without SSR', () => {
        (window as any).APP_CONFIGS = {
            container: '#mobile-root',
            router: { mode: 'hash', defaultRoute: '/start', routes: [{ path: '/', component: 'mobile.home' }] },
            view: { systemData: { __context__: 'mobile' }, dataEndpoint: 'https://backend.example', fetchOptions: { credentials: 'include' } },
            api: { baseUrl: 'https://backend.example/api', endpoints: { system: { data: '/system' } } },
        };
        const cfg = readBootConfig()!;
        expect(cfg.view.container).toBe('#mobile-root');
        expect(cfg.view.dataEndpoint).toBe('https://backend.example');
        expect(cfg.view.fetchOptions).toEqual({ credentials: 'include' });
        expect(cfg.api.baseUrl).toBe('https://backend.example/api');
        expect(cfg.router.mode).toBe('hash');
        expect(cfg.router.defaultRoute).toBe('/start');
        expect(cfg.view.ssrData).toBeUndefined();
    });
    it('remaps page data with its query, discards fragments, and retains same-origin defaults', () => {
        expect(resolveViewDataUrl('https://frontend.example/users/8?page=2#details', 'https://backend.example/frontend/')).toBe('https://backend.example/frontend/users/8?page=2');
        expect(resolveViewDataUrl('/users/8?page=2', null)).toBe('/users/8?page=2');
    });
    it('API init applies endpoint, base URL and headers to actual requests', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ answer: 42 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        const api = new ApiClient();
        api.init({ baseUrl: 'https://backend.example/api/', headers: { 'X-Client': 'mobile' }, endpoints: { system: { data: '/system' } } });
        expect(await api.getSystemData()).toEqual({ answer: 42 });
        expect(fetch).toHaveBeenCalledWith('https://backend.example/api/system', expect.objectContaining({ headers: expect.objectContaining({ 'X-Client': 'mobile' }) }));
    });
});
