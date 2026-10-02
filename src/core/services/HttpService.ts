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

// ─── Types ──────────────────────────────────────────────────────

export interface HttpRequestConfig extends RequestInit {
    headers?: Record<string, string>;
    timeout?: number;
    /** Default: cancel only an identical method + final URL. */
    dedupe?: 'cancel-previous' | 'parallel';
    /** Explicit logical identity, e.g. latest search across different queries. */
    requestKey?: string;
    [key: string]: any;
}

export interface HttpResponse<T = any> {
    status: boolean;
    statusCode: number;
    data: T;
    headers: Headers;
}

export interface HttpInterceptor {
    request?: (config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>;
    response?: <T = any>(response: HttpResponse<T>) => HttpResponse<T> | Promise<HttpResponse<T>>;
    error?: (error: Error) => Error | Promise<Error>;
}

// ─── HttpService ────────────────────────────────────────────────

export class HttpService {
    private static instances: Map<string, HttpService> = new Map();
    static getInstance(key: string = 'default'): HttpService {
        if (!HttpService.instances.has(key)) {
            HttpService.instances.set(key, new HttpService());
        }
        return HttpService.instances.get(key)!;
    }
    static instance(key: string = 'default'): HttpService {
        return HttpService.getInstance(key);
    }
    static removeInstance(key: string = 'default'): void {
        HttpService.instances.delete(key);
    }
    
    private baseUrl: string = '';
    private timeout: number = 10000;
    private defaultHeaders: Record<string, string> = {};
    private interceptors: HttpInterceptor[] = [];
    private pending = new Map<string, Set<AbortController>>();
    private activeRequests = new Set<AbortController>();

    // ─── Config ─────────────────────────────────────────────────

    setBaseUrl(url: string): this {
        this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        return this;
    }

    setTimeout(ms: number): this {
        this.timeout = ms;
        return this;
    }

    setDefaultHeaders(headers: Record<string, string>): this {
        Object.assign(this.defaultHeaders, headers);
        return this;
    }

    setHeader(name: string, value: string): this {
        this.defaultHeaders[name] = value;
        return this;
    }

    removeHeader(name: string): this {
        delete this.defaultHeaders[name];
        return this;
    }

    /** Add interceptor. Returns unregister function. */
    addInterceptor(interceptor: HttpInterceptor): () => void {
        this.interceptors.push(interceptor);
        return () => {
            const idx = this.interceptors.indexOf(interceptor);
            if (idx !== -1) this.interceptors.splice(idx, 1);
        };
    }

    // ─── Core Request ───────────────────────────────────────────

    async request<T = any>(
        method: string,
        url: string,
        data: any = null,
        options: HttpRequestConfig = {},
    ): Promise<HttpResponse<T>> {
        const controller = new AbortController();
        this.activeRequests.add(controller);
        const detach: (() => void)[] = [];
        const linked = new Set<AbortSignal>();
        const linkSignal = (signal?: AbortSignal | null) => {
            if (!signal || signal === controller.signal || linked.has(signal)) return;
            linked.add(signal);
            const abort = () => controller.abort(signal.reason);
            if (signal.aborted) abort();
            else {
                signal.addEventListener('abort', abort, { once: true });
                detach.push(() => signal.removeEventListener('abort', abort));
            }
        };
        linkSignal(options.signal);
        let requestKey: string | undefined;
        const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? this.timeout);
        try {
            let config: HttpRequestConfig = {
                ...options,
                method: (options.method ?? method).toUpperCase(),
                headers: { ...this.defaultHeaders, ...options.headers },
                signal: controller.signal,
            };
            if (typeof window !== 'undefined') {
                const revision = (window as any).APP_CONFIGS?.view?.revision;
                const headers = config.headers as Record<string, string>;
                if (typeof revision === 'string' && !headers['X-Saola-View-Revision']) {
                    headers['X-Saola-View-Revision'] = revision;
                    headers['X-Sao-Response'] ??= 'json';
                }
            }
            controller.signal.throwIfAborted();
            for (const i of this.interceptors) {
                if (i.request) config = await i.request(config);
                linkSignal(config.signal);
                config.signal = controller.signal;
                controller.signal.throwIfAborted();
            }
            config.method = (config.method ?? method).toUpperCase();
            if (data !== null && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
                const ct = config.headers?.['Content-Type'];
                if (data instanceof FormData) {
                    config.body = data;
                    if (config.headers) delete config.headers['Content-Type'];
                } else if (ct === 'application/json' || !ct) {
                    config.headers ??= {};
                    config.headers['Content-Type'] = 'application/json';
                    config.body = JSON.stringify(data);
                } else config.body = data;
            }
            const urlObj = this.resolveUrl(url);
            if (data && config.method === 'GET' && typeof data === 'object') {
                for (const [key, value] of Object.entries(data)) urlObj.searchParams.append(key, String(value));
            }
            const fullUrl = urlObj.toString();
            requestKey = `${config.method}:${config.requestKey ?? fullUrl}`;
            let group = this.pending.get(requestKey);
            if (config.dedupe !== 'parallel') {
                for (const previous of group ?? []) previous.abort();
            }
            if (!group) this.pending.set(requestKey, group = new Set());
            group.add(controller);
            const raw = await fetch(fullUrl, config);
            const responseData = await raw.json().catch(() => ({}));
            controller.signal.throwIfAborted();

            const viewContext = responseData?.viewContext;
            const currentContext = typeof window !== 'undefined'
                ? (window as any).APP_CONFIGS?.view?.systemData?.__context__
                : null;
            if (viewContext?.changed === true
                && (!currentContext || viewContext.context === currentContext)
                && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('saola:view-context', {
                    detail: viewContext,
                }));
            }

            let response: HttpResponse<T> = {
                status: raw.ok,
                statusCode: raw.status,
                data: responseData,
                headers: raw.headers,
            };

            // Apply response interceptors
            for (const i of this.interceptors) {
                if (i.response) response = await i.response(response);
            }

            controller.signal.throwIfAborted();

            if (!raw.ok) {
                // Ưu tiên message của server (Laravel 422 trả "The email field is
                // required."): caller nào cũng in `err.message`, mà "HTTP 422
                // Unprocessable Content" thì người dùng không biết sai ở đâu.
                // Body đầy đủ (kèm `errors` từng field) vẫn nằm ở `err.response`.
                const serverMessage = typeof (responseData as any)?.message === 'string'
                    ? (responseData as any).message.trim()
                    : '';
                const message = serverMessage !== ''
                    ? serverMessage
                    : `HTTP ${raw.status} ${raw.statusText}`;
                throw Object.assign(new Error(message), { response });
            }

            return response;
        } catch (err) {

            let error = err as Error;
            for (const i of this.interceptors) {
                if (i.error) error = await i.error(error);
            }

            if (controller.signal.aborted || error.name === 'AbortError') {
                throw Object.assign(new Error('Request cancelled'), { name: 'AbortError', cause: error });
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
            for (const off of detach) off();
            this.activeRequests.delete(controller);
            if (requestKey !== undefined) {
                const group = this.pending.get(requestKey);
                group?.delete(controller);
                if (group?.size === 0) this.pending.delete(requestKey);
            }
        }
    }

    // ─── Convenience ────────────────────────────────────────────

    get<T = any>(url: string, params?: any, options?: HttpRequestConfig) {
        return this.request<T>('GET', url, params, options);
    }

    post<T = any>(url: string, data?: any, options?: HttpRequestConfig) {
        return this.request<T>('POST', url, data, options);
    }

    put<T = any>(url: string, data?: any, options?: HttpRequestConfig) {
        return this.request<T>('PUT', url, data, options);
    }

    patch<T = any>(url: string, data?: any, options?: HttpRequestConfig) {
        return this.request<T>('PATCH', url, data, options);
    }

    delete<T = any>(url: string, options?: HttpRequestConfig) {
        return this.request<T>('DELETE', url, null, options);
    }

    // ─── Cancellation ───────────────────────────────────────────

    /** Cancel all pending requests */
    cancelAll(): void {
        for (const controller of this.activeRequests) controller.abort();
        this.pending.clear();
    }

    /** Cancel a specific pending request */
    cancel(url: string, method: string = 'GET'): void {
        this.cancelKey(this.resolveUrl(url).toString(), method);
    }

    /** Cancel a logical requestKey (all parallel requests in the group). */
    cancelKey(identity: string, method: string = 'GET'): void {
        const key = `${method.toUpperCase()}:${identity}`;
        for (const controller of this.pending.get(key) ?? []) controller.abort();
        this.pending.delete(key);
    }

    private resolveUrl(url: string): URL {
        const full = /^(https?:)?\/\//i.test(url) ? url : `${this.baseUrl}${url}`;
        const resolved = new URL(full, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        resolved.hash = ''; // fragments are never sent to the server
        return resolved;
    }

    /** Destroy — cancel all + clear interceptors */
    destroy(): void {
        this.cancelAll();
        this.interceptors = [];
    }
}
