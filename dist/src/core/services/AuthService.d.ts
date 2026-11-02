import { AuthClient } from './AuthClient.js';
export type AuthUser = Readonly<{
    id: string | number;
    [key: string]: any;
}>;
export interface AuthSnapshot {
    version: 1;
    defaultGuard: string;
    guards: Record<string, {
        user: AuthUser | null;
    }>;
}
export interface AuthChange {
    guard: string;
    user: AuthUser | null;
    previousUser: AuthUser | null;
    source: 'login' | 'logout' | 'sync';
}
export type AuthEvent = 'login' | 'logout' | 'change';
type Listener = (change: AuthChange) => void;
type Context = {
    defaultGuard: string;
    users: Map<string, AuthUser | null>;
    instances: Map<string, AuthService>;
    listeners: Set<{
        guard: string | null;
        event: AuthEvent;
        callback: Listener;
    }>;
    revision: number;
    client?: AuthClient;
    transitions: number;
};
/** Client view of server authentication. login/logout record successful server actions; they make no HTTP requests. */
export declare class AuthService {
    private readonly context;
    private readonly guardName;
    constructor(user?: AuthUser | null, defaultGuard?: string, context?: Context, guardName?: string | null);
    static fromSnapshot(snapshot?: unknown): AuthService;
    get revision(): number;
    get client(): AuthClient;
    get isTransitioning(): boolean;
    /** Internal transport barrier: page responses cannot overwrite an in-flight login/logout. */
    beginClientTransition(): () => void;
    private get name();
    guard(name?: string | null): AuthService;
    check(): boolean;
    guest(): boolean;
    id(): string | number | null;
    user<T extends AuthUser = AuthUser>(): T | null;
    /** Call only after the server accepted login (including registration/OAuth). */
    login(user: AuthUser): this;
    /** Call only after the server confirmed logout or session expiry. */
    logout(): this;
    setUser(user: AuthUser | null, source?: AuthChange['source']): this;
    /** Authoritative page-data response. A snapshot replaces guards omitted by the server too. */
    sync(snapshot: unknown, source?: AuthChange['source']): this;
    /** Bootstrap only: restore the server session without reporting a new login. */
    initialize(snapshot: unknown): this;
    on(event: AuthEvent, callback: Listener): () => void;
    subscribe(callback: Listener): () => void;
    destroy(): void;
    private applySnapshot;
    private emit;
    static isSnapshot(value: any): value is AuthSnapshot;
    private static copyUser;
    private static sameUser;
}
export {};
//# sourceMappingURL=AuthService.d.ts.map