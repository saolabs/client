import { AuthService, type AuthSnapshot } from './AuthService.js';
export interface AuthProviderInfo {
    name: string;
    label: string;
    url: string;
}
export interface AuthClientConfig {
    version: 1;
    guard: string;
    csrfToken: string | null;
    usernameField: string;
    endpoints: {
        session: string;
        login: string | null;
        logout: string;
    };
    providers: AuthProviderInfo[];
}
export interface AuthClientOptions {
    fetch?: typeof fetch;
    navigate?: (url: string) => void;
}
/** Same-origin session transport; no dependency on Router, View or a context API. */
export declare class AuthClient {
    private readonly auth;
    private readonly options;
    private config;
    private queue;
    private requests;
    private disposed;
    private generation;
    constructor(auth: AuthService, options?: AuthClientOptions);
    configure(config: AuthClientConfig | null): this;
    get available(): boolean;
    get csrfToken(): string | null;
    get usernameField(): string | null;
    get providers(): AuthProviderInfo[];
    login(credentials: Record<string, string | boolean>): Promise<AuthSnapshot>;
    logout(): Promise<AuthSnapshot>;
    refresh(): Promise<AuthSnapshot>;
    loginUrl(provider: string, options?: {
        next?: string;
    }): string;
    /** OAuth redirects through the server; callback restores auth via a fresh SSR bootstrap. */
    loginWith(provider: string, options?: {
        next?: string;
    }): void;
    private enqueue;
    private request;
    private localUrl;
    private assertAvailable;
    destroy(): void;
}
//# sourceMappingURL=AuthClient.d.ts.map