import { afterEach, expect, it, vi } from 'vitest';
import { HttpService } from '../../src/core/services/HttpService';

let http: HttpService;
afterEach(() => { http?.destroy(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function pendingFetch() {
    http = new HttpService().setBaseUrl('/api');
    const requests: { url: string; signal: AbortSignal; resolve: (response: any) => void }[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, config: RequestInit) => new Promise(resolve => {
        requests.push({ url, signal: config.signal!, resolve });
    })));
    return requests;
}
const ok = () => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ value: 1 }) });

it('different final query URLs remain independent', async () => {
    const requests = pendingFetch();
    const first = http.get('/items', { page: 1 });
    const second = http.get('/items', { page: 2 });
    expect(requests[0].signal.aborted).toBe(false);
    expect(requests[1].url).toContain('page=2');
    for (const req of requests) req.resolve(ok());
    await Promise.all([first, second]);
});

it('a cancelled older request cannot remove the newer owner; caller and internal cancellation compose', async () => {
    const requests = pendingFetch();
    const caller = new AbortController();
    const first = http.get('/items', { page: 1 }, { signal: caller.signal }).catch(error => error);
    const second = http.get('/items', { page: 1 }).catch(error => error);
    expect(requests[0].signal.aborted).toBe(true);
    requests[0].resolve(ok());
    expect((await first).name).toBe('AbortError');
    http.cancel('/items?page=1');
    expect(requests[1].signal.aborted).toBe(true);
    expect(caller.signal.aborted).toBe(false);
    requests[1].resolve(ok());
    expect((await second).message).toBe('Request cancelled');
});

it('parallel mode keeps duplicate requests live and cancelAll reaches each one', async () => {
    const requests = pendingFetch();
    const first = http.get('/items', null, { dedupe: 'parallel' }).catch(error => error);
    const second = http.get('/items', null, { dedupe: 'parallel' }).catch(error => error);
    expect(requests.every(req => !req.signal.aborted)).toBe(true);
    http.cancelAll();
    expect(requests.every(req => req.signal.aborted)).toBe(true);
    for (const req of requests) req.resolve(ok());
    await Promise.all([first, second]);
});

it('explicit identity cancels a previous search across different queries', async () => {
    const requests = pendingFetch();
    const first = http.get('/search', { q: 'a' }, { requestKey: 'search' }).catch(error => error);
    const second = http.get('/search', { q: 'ab' }, { requestKey: 'search' }).catch(error => error);
    expect(requests[0].signal.aborted).toBe(true);
    http.cancelKey('search');
    expect(requests[1].signal.aborted).toBe(true);
    for (const req of requests) req.resolve(ok());
    await Promise.all([first, second]);
});

it('timeout works with a caller signal and listeners/timers are released after failures', async () => {
    vi.useFakeTimers();
    const requests = pendingFetch();
    const caller = new AbortController();
    const remove = vi.spyOn(caller.signal, 'removeEventListener');
    const result = http.get('/items', null, { signal: caller.signal, timeout: 10 }).catch(error => error);
    await vi.advanceTimersByTimeAsync(10);
    expect(requests[0].signal.aborted).toBe(true);
    requests[0].resolve(ok());
    expect((await result).name).toBe('AbortError');
    expect(remove).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});

it('cancelAll also aborts a request waiting in an asynchronous interceptor', async () => {
    pendingFetch();
    let resolve!: (config: any) => void;
    http.addInterceptor({ request: config => new Promise(r => { resolve = () => r(config); }) });
    const result = http.get('/items').catch(error => error);
    http.cancelAll(); resolve({});
    expect((await result).name).toBe('AbortError');
    expect(fetch).not.toHaveBeenCalled();
});
