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
    private pending = new Map<string, AbortController>();

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
        // Build full URL
        let fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

        // Cancel duplicate in-flight request
        const requestKey = `${method.toUpperCase()}:${fullUrl}`;
        this.pending.get(requestKey)?.abort();

        const controller = new AbortController();
        this.pending.set(requestKey, controller);

        // Build config
        let config: HttpRequestConfig = {
            method: method.toUpperCase(),
            headers: { ...this.defaultHeaders, ...options.headers },
            signal: options.signal ?? controller.signal,
            ...options,
        };

        // Apply request interceptors
        for (const i of this.interceptors) {
            if (i.request) config = await i.request(config);
        }

        // Body for POST/PUT/PATCH
        if (data && ['POST', 'PUT', 'PATCH'].includes(config.method!)) {
            const ct = (config.headers as Record<string, string>)?.['Content-Type'];
            if (data instanceof FormData) {
                config.body = data;
                delete (config.headers as Record<string, string>)['Content-Type'];
            } else if (ct === 'application/json' || !ct) {
                (config.headers as Record<string, string>)['Content-Type'] = 'application/json';
                config.body = JSON.stringify(data);
            } else {
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

            this.pending.delete(requestKey);

            if (!raw.ok) {
                throw Object.assign(new Error(`HTTP ${raw.status} ${raw.statusText}`), { response });
            }

            return response;
        } catch (err) {
            this.pending.delete(requestKey);

            let error = err as Error;
            for (const i of this.interceptors) {
                if (i.error) error = await i.error(error);
            }

            if (error.name === 'AbortError') {
                throw new Error('Request cancelled');
            }
            throw error;
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
        this.pending.forEach((c) => c.abort());
        this.pending.clear();
    }

    /** Cancel a specific pending request */
    cancel(url: string, method: string = 'GET'): void {
        const key = `${method.toUpperCase()}:${url}`;
        this.pending.get(key)?.abort();
        this.pending.delete(key);
    }

    /** Destroy — cancel all + clear interceptors */
    destroy(): void {
        this.cancelAll();
        this.interceptors = [];
    }
}
