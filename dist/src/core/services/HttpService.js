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
// ─── HttpService ────────────────────────────────────────────────
export class HttpService {
    constructor() {
        this.baseUrl = '';
        this.timeout = 10000;
        this.defaultHeaders = {};
        this.interceptors = [];
        this.pending = new Map();
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
        // Build full URL
        let fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
        // Cancel duplicate in-flight request
        const requestKey = `${method.toUpperCase()}:${fullUrl}`;
        this.pending.get(requestKey)?.abort();
        const controller = new AbortController();
        this.pending.set(requestKey, controller);
        // Build config
        let config = {
            method: method.toUpperCase(),
            headers: { ...this.defaultHeaders, ...options.headers },
            signal: options.signal ?? controller.signal,
            ...options,
        };
        // Apply request interceptors
        for (const i of this.interceptors) {
            if (i.request)
                config = await i.request(config);
        }
        // Body for POST/PUT/PATCH
        if (data && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
            const ct = config.headers?.['Content-Type'];
            if (data instanceof FormData) {
                config.body = data;
                delete config.headers['Content-Type'];
            }
            else if (ct === 'application/json' || !ct) {
                config.headers['Content-Type'] = 'application/json';
                config.body = JSON.stringify(data);
            }
            else {
                config.body = data;
            }
        }
        // Query params for GET
        if (data && config.method === 'GET' && typeof data === 'object') {
            const urlObj = new URL(fullUrl, window.location.origin);
            for (const [key, value] of Object.entries(data)) {
                urlObj.searchParams.append(key, String(value));
            }
            fullUrl = urlObj.toString();
        }
        try {
            const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? this.timeout);
            const raw = await fetch(fullUrl, config);
            clearTimeout(timeoutId);
            const responseData = await raw.json().catch(() => ({}));
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
            this.pending.delete(requestKey);
            if (!raw.ok) {
                throw Object.assign(new Error(`HTTP ${raw.status} ${raw.statusText}`), { response });
            }
            return response;
        }
        catch (err) {
            this.pending.delete(requestKey);
            let error = err;
            for (const i of this.interceptors) {
                if (i.error)
                    error = await i.error(error);
            }
            if (error.name === 'AbortError') {
                throw new Error('Request cancelled');
            }
            throw error;
        }
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
        this.pending.forEach((c) => c.abort());
        this.pending.clear();
    }
    /** Cancel a specific pending request */
    cancel(url, method = 'GET') {
        const key = `${method.toUpperCase()}:${url}`;
        this.pending.get(key)?.abort();
        this.pending.delete(key);
    }
    /** Destroy — cancel all + clear interceptors */
    destroy() {
        this.cancelAll();
        this.interceptors = [];
    }
}
HttpService.instances = new Map();
//# sourceMappingURL=HttpService.js.map