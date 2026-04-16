// ─── HTTP Service Interface ──────────────────────────────────────

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

export interface HttpServiceInterface {
    // ─── Config ─────────────────────────────────────────────────
    setBaseUrl(url: string): this;
    setTimeout(ms: number): this;
    setDefaultHeaders(headers: Record<string, string>): this;
    setHeader(name: string, value: string): this;
    removeHeader(name: string): this;

    /** Add interceptor. Returns unregister function. */
    addInterceptor(interceptor: HttpInterceptor): () => void;

    // ─── Core Request ───────────────────────────────────────────
    request<T = any>(method: string, url: string, data?: any, options?: HttpRequestConfig): Promise<HttpResponse<T>>;

    // ─── Convenience ────────────────────────────────────────────
    get<T = any>(url: string, params?: any, options?: HttpRequestConfig): Promise<HttpResponse<T>>;
    post<T = any>(url: string, data?: any, options?: HttpRequestConfig): Promise<HttpResponse<T>>;
    put<T = any>(url: string, data?: any, options?: HttpRequestConfig): Promise<HttpResponse<T>>;
    patch<T = any>(url: string, data?: any, options?: HttpRequestConfig): Promise<HttpResponse<T>>;
    delete<T = any>(url: string, options?: HttpRequestConfig): Promise<HttpResponse<T>>;

    // ─── Cancellation ───────────────────────────────────────────
    /** Cancel all pending requests */
    cancelAll(): void;
    /** Cancel a specific pending request */
    cancel(url: string, method?: string): void;

    /** Destroy — cancel all + clear interceptors */
    destroy(): void;
}
