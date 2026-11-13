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
export declare class HttpService {
    private static instances;
    static getInstance(key?: string): HttpService;
    static instance(key?: string): HttpService;
    static removeInstance(key?: string): void;
    private baseUrl;
    private timeout;
    private defaultHeaders;
    private interceptors;
    private pending;
    private activeRequests;
    setBaseUrl(url: string): this;
    setTimeout(ms: number): this;
    setDefaultHeaders(headers: Record<string, string>): this;
    setHeader(name: string, value: string): this;
    removeHeader(name: string): this;
    /** Add interceptor. Returns unregister function. */
    addInterceptor(interceptor: HttpInterceptor): () => void;
    request<T = any>(method: string, url: string, data?: any, options?: HttpRequestConfig): Promise<HttpResponse<T>>;
    private static contextSyncs;
    private static languageSyncs;
    /**
     * Revision ở header lệch bản đang giữ ⇒ tải trạng thái view context (routes,
     * systemData có `__site`, sharedData) MỘT lần cho mỗi revision, rồi phát
     * `saola:view-context` như trước — Router lo phần áp dụng/reload.
     */
    static syncViewContext(context: string, revision: string): Promise<void>;
    /**
     * `X-Saola-Language-Revision: scope;vi=7` — catalog đang giữ đã cũ. Tải bản mới
     * qua mẫu URL từ điển (`APP_CONFIGS.i18n.dictionary`); không có mẫu thì chỉ
     * phát `saola:language-stale` để ứng dụng tự xử lý.
     */
    static syncLanguage(header: string): Promise<void>;
    get<T = any>(url: string, params?: any, options?: HttpRequestConfig): Promise<HttpResponse<T>>;
    post<T = any>(url: string, data?: any, options?: HttpRequestConfig): Promise<HttpResponse<T>>;
    put<T = any>(url: string, data?: any, options?: HttpRequestConfig): Promise<HttpResponse<T>>;
    patch<T = any>(url: string, data?: any, options?: HttpRequestConfig): Promise<HttpResponse<T>>;
    delete<T = any>(url: string, options?: HttpRequestConfig): Promise<HttpResponse<T>>;
    /** Cancel all pending requests */
    cancelAll(): void;
    /** Cancel a specific pending request */
    cancel(url: string, method?: string): void;
    /** Cancel a logical requestKey (all parallel requests in the group). */
    cancelKey(identity: string, method?: string): void;
    private resolveUrl;
    /** Destroy — cancel all + clear interceptors */
    destroy(): void;
}
//# sourceMappingURL=HttpService.d.ts.map