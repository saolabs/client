/**
 * HttpService — Fetch-based HTTP client.
 *
 * Features:
 *   - Base URL, default headers, timeout
 *   - Request/response/error interceptors (chainable)
 *   - Auto-cancel duplicate in-flight requests (same method + URL)
 *   - Convenience: get, post, put, patch, delete
 *
 * Register via DI:
 *   app.singleton('http', () => {
 *       const http = new HttpService();
 *       http.setBaseUrl('/api');
 *       return http;
 *   });
 */
import { app } from '../helpers/app.js';
import { AuthService } from './AuthService.js';
// ─── HttpService ────────────────────────────────────────────────
export class HttpService {
    constructor() {
        this.baseUrl = '';
        this.timeout = 10000;
        this.defaultHeaders = {};
        this.interceptors = [];
        this.pending = new Map();
        this.activeRequests = new Set();
    }
    static getInstance(key = 'default') {
        if (!HttpService.instances.has(key)) {
            HttpService.instances.set(key, new HttpService());
        }
        return HttpService.instances.get(key);
    }
    static instance(key = 'default') {
        return HttpService.getInstance(key);
    }
    static removeInstance(key = 'default') {
        HttpService.instances.delete(key);
    }
    // ─── Config ─────────────────────────────────────────────────
    setBaseUrl(url) {
        this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        return this;
    }
    setTimeout(ms) {
        this.timeout = ms;
        return this;
    }
    setDefaultHeaders(headers) {
        Object.assign(this.defaultHeaders, headers);
        return this;
    }
    setHeader(name, value) {
        this.defaultHeaders[name] = value;
        return this;
    }
    removeHeader(name) {
        delete this.defaultHeaders[name];
        return this;
    }
    /** Add interceptor. Returns unregister function. */
    addInterceptor(interceptor) {
        this.interceptors.push(interceptor);
        return () => {
            const idx = this.interceptors.indexOf(interceptor);
            if (idx !== -1)
                this.interceptors.splice(idx, 1);
        };
    }
    // ─── Core Request ───────────────────────────────────────────
    async request(method, url, data = null, options = {}) {
        const controller = new AbortController();
        this.activeRequests.add(controller);
        const detach = [];
        const linked = new Set();
        const linkSignal = (signal) => {
            if (!signal || signal === controller.signal || linked.has(signal))
                return;
            linked.add(signal);
            const abort = () => controller.abort(signal.reason);
            if (signal.aborted)
                abort();
            else {
                signal.addEventListener('abort', abort, { once: true });
                detach.push(() => signal.removeEventListener('abort', abort));
            }
        };
        linkSignal(options.signal);
        let requestKey;
        const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? this.timeout);
        try {
            let config = {
                ...options,
                method: (options.method ?? method).toUpperCase(),
                headers: { ...this.defaultHeaders, ...options.headers },
                signal: controller.signal,
            };
            if (typeof window !== 'undefined') {
                const revision = window.APP_CONFIGS?.view?.revision;
                const headers = config.headers;
                if (typeof revision === 'string' && !headers['X-Saola-View-Revision']) {
                    headers['X-Saola-View-Revision'] = revision;
                    headers['X-Sao-Response'] ?? (headers['X-Sao-Response'] = 'json');
                    // Phong bì mới: body chỉ {data, view?, auth?}, revision đi bằng header.
                    headers['X-Saola-Client'] ?? (headers['X-Saola-Client'] = '2');
                }
            }
            controller.signal.throwIfAborted();
            for (const i of this.interceptors) {
                if (i.request)
                    config = await i.request(config);
                linkSignal(config.signal);
                config.signal = controller.signal;
                controller.signal.throwIfAborted();
            }
            config.method = (config.method ?? method).toUpperCase();
            if (data !== null && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
                const ct = config.headers?.['Content-Type'];
                if (data instanceof FormData) {
                    config.body = data;
                    if (config.headers)
                        delete config.headers['Content-Type'];
                }
                else if (ct === 'application/json' || !ct) {
                    config.headers ?? (config.headers = {});
                    config.headers['Content-Type'] = 'application/json';
                    config.body = JSON.stringify(data);
                }
                else
                    config.body = data;
            }
            const urlObj = this.resolveUrl(url);
            if (data && config.method === 'GET' && typeof data === 'object') {
                for (const [key, value] of Object.entries(data))
                    urlObj.searchParams.append(key, String(value));
            }
            const fullUrl = urlObj.toString();
            requestKey = `${config.method}:${config.requestKey ?? fullUrl}`;
            let group = this.pending.get(requestKey);
            if (config.dedupe !== 'parallel') {
                for (const previous of group ?? [])
                    previous.abort();
            }
            if (!group)
                this.pending.set(requestKey, group = new Set());
            group.add(controller);
            const auth = app.has('Auth') ? app('Auth') : null;
            const authRevision = auth?.revision;
            // Read at send time: session login/logout rotates Laravel's CSRF token.
            if (typeof window !== 'undefined' && urlObj.origin === window.location.origin
                && !['GET', 'HEAD', 'OPTIONS'].includes(config.method)) {
                const headers = config.headers ?? (config.headers = {});
                const explicit = Object.keys(headers).some(key => ['x-csrf-token', 'x-xsrf-token'].includes(key.toLowerCase()));
                const token = auth?.client.csrfToken ?? document.querySelector('meta[name="csrf-token"]')?.content;
                if (!explicit && token)
                    headers['X-CSRF-TOKEN'] = token;
            }
            const raw = await fetch(fullUrl, config);
            const responseData = await raw.json().catch(() => ({}));
            controller.signal.throwIfAborted();
            // Only our own server may synchronize auth; an older request cannot undo a newer login/logout.
            if (auth && !auth.isTransitioning && auth.revision === authRevision && typeof window !== 'undefined'
                && urlObj.origin === window.location.origin
                && (!raw.url || new URL(raw.url).origin === window.location.origin)
                && AuthService.isSnapshot(responseData?.auth)) {
                auth.sync(responseData.auth);
            }
            const viewContext = responseData?.viewContext;
            const currentContext = typeof window !== 'undefined'
                ? window.APP_CONFIGS?.view?.systemData?.__context__
                : null;
            if (viewContext?.changed === true
                && (!currentContext || viewContext.context === currentContext)
                && typeof window !== 'undefined') {
                // Server cũ: trạng thái nằm ngay trong body.
                window.dispatchEvent(new CustomEvent('saola:view-context', {
                    detail: viewContext,
                }));
            }
            else if (typeof window !== 'undefined' && urlObj.origin === window.location.origin
                && raw.headers?.get?.('X-Saola-Envelope') === '1') {
                const serverRevision = raw.headers.get('X-Saola-View-Revision');
                const heldRevision = window.APP_CONFIGS?.view?.revision;
                if (serverRevision && typeof heldRevision === 'string' && serverRevision !== heldRevision && currentContext) {
                    void HttpService.syncViewContext(currentContext, serverRevision);
                }
                const language = raw.headers.get('X-Saola-Language-Revision');
                if (language)
                    void HttpService.syncLanguage(language);
            }
            let response = {
                status: raw.ok,
                statusCode: raw.status,
                data: responseData,
                headers: raw.headers,
            };
            // Apply response interceptors
            for (const i of this.interceptors) {
                if (i.response)
                    response = await i.response(response);
            }
            controller.signal.throwIfAborted();
            if (!raw.ok) {
                // Ưu tiên message của server (Laravel 422 trả "The email field is
                // required."): caller nào cũng in `err.message`, mà "HTTP 422
                // Unprocessable Content" thì người dùng không biết sai ở đâu.
                // Body đầy đủ (kèm `errors` từng field) vẫn nằm ở `err.response`.
                const serverMessage = typeof responseData?.message === 'string'
                    ? responseData.message.trim()
                    : '';
                const message = serverMessage !== ''
                    ? serverMessage
                    : `HTTP ${raw.status} ${raw.statusText}`;
                throw Object.assign(new Error(message), { response });
            }
            return response;
        }
        catch (err) {
            let error = err;
            for (const i of this.interceptors) {
                if (i.error)
                    error = await i.error(error);
            }
            if (controller.signal.aborted || error.name === 'AbortError') {
                throw Object.assign(new Error('Request cancelled'), { name: 'AbortError', cause: error });
            }
            throw error;
        }
        finally {
            clearTimeout(timeoutId);
            for (const off of detach)
                off();
            this.activeRequests.delete(controller);
            if (requestKey !== undefined) {
                const group = this.pending.get(requestKey);
                group?.delete(controller);
                if (group?.size === 0)
                    this.pending.delete(requestKey);
            }
        }
    }
    /**
     * Revision ở header lệch bản đang giữ ⇒ tải trạng thái view context (routes,
     * systemData có `__site`, sharedData) MỘT lần cho mỗi revision, rồi phát
     * `saola:view-context` như trước — Router lo phần áp dụng/reload.
     */
    static syncViewContext(context, revision) {
        const key = context + '@' + revision;
        let pending = HttpService.contextSyncs.get(key);
        if (pending)
            return pending;
        pending = (async () => {
            const base = window.APP_CONFIGS?.view?.contextEndpoint ?? '/_saola/context/';
            const response = await fetch(base + encodeURIComponent(context) + '?r=' + encodeURIComponent(revision), {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            if (!response.ok)
                throw new Error(`View context ${context}: HTTP ${response.status}`);
            const state = await response.json();
            if (state?.context !== context || window.APP_CONFIGS?.view?.revision === state.revision)
                return;
            window.dispatchEvent(new CustomEvent('saola:view-context', { detail: { ...state, changed: true } }));
        })().catch(error => {
            // Lần sau gặp lại revision này thì thử lại.
            HttpService.contextSyncs.delete(key);
            console.warn('[Http] Không đồng bộ được view context:', error);
        });
        HttpService.contextSyncs.set(key, pending);
        return pending;
    }
    /**
     * `X-Saola-Language-Revision: scope;vi=7` — catalog đang giữ đã cũ. Tải bản mới
     * qua mẫu URL từ điển (`APP_CONFIGS.i18n.dictionary`); không có mẫu thì chỉ
     * phát `saola:language-stale` để ứng dụng tự xử lý.
     */
    static syncLanguage(header) {
        let pending = HttpService.languageSyncs.get(header);
        if (pending)
            return pending;
        pending = (async () => {
            const [scope, ...parts] = header.split(';');
            const locales = parts.map(part => part.split('=')[0]).filter(Boolean);
            const helper = app.has('Helper') ? app('Helper') : null;
            const pattern = window.APP_CONFIGS?.i18n?.dictionary;
            if (!helper || helper.getLanguageScope?.() !== scope || typeof pattern !== 'string' || !pattern.includes('_locale_')) {
                window.dispatchEvent(new CustomEvent('saola:language-stale', { detail: { scope, locales } }));
                return;
            }
            for (const locale of locales) {
                await helper.loadLanguage(locale, async (code) => {
                    const url = new URL(pattern.replace('_locale_', encodeURIComponent(code)), window.location.origin);
                    if (url.origin !== window.location.origin)
                        throw new Error('Language dictionary must use the current origin.');
                    const response = await fetch(url.pathname + url.search, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
                    if (!response.ok)
                        throw new Error(`Language ${code}: HTTP ${response.status}`);
                    return response.json();
                });
            }
        })().catch(error => {
            HttpService.languageSyncs.delete(header);
            console.warn('[Http] Không tải được từ điển:', error);
        });
        HttpService.languageSyncs.set(header, pending);
        return pending;
    }
    // ─── Convenience ────────────────────────────────────────────
    get(url, params, options) {
        return this.request('GET', url, params, options);
    }
    post(url, data, options) {
        return this.request('POST', url, data, options);
    }
    put(url, data, options) {
        return this.request('PUT', url, data, options);
    }
    patch(url, data, options) {
        return this.request('PATCH', url, data, options);
    }
    delete(url, options) {
        return this.request('DELETE', url, null, options);
    }
    // ─── Cancellation ───────────────────────────────────────────
    /** Cancel all pending requests */
    cancelAll() {
        for (const controller of this.activeRequests)
            controller.abort();
        this.pending.clear();
    }
    /** Cancel a specific pending request */
    cancel(url, method = 'GET') {
        this.cancelKey(this.resolveUrl(url).toString(), method);
    }
    /** Cancel a logical requestKey (all parallel requests in the group). */
    cancelKey(identity, method = 'GET') {
        const key = `${method.toUpperCase()}:${identity}`;
        for (const controller of this.pending.get(key) ?? [])
            controller.abort();
        this.pending.delete(key);
    }
    resolveUrl(url) {
        const full = /^(https?:)?\/\//i.test(url) ? url : `${this.baseUrl}${url}`;
        const resolved = new URL(full, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        resolved.hash = ''; // fragments are never sent to the server
        return resolved;
    }
    /** Destroy — cancel all + clear interceptors */
    destroy() {
        this.cancelAll();
        this.interceptors = [];
    }
}
HttpService.instances = new Map();
// ─── View context & language sync ───────────────────────────
HttpService.contextSyncs = new Map();
HttpService.languageSyncs = new Map();
//# sourceMappingURL=HttpService.js.map