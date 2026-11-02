import { trackDependency } from './ReactiveDependency.js';
import { AuthClient } from './AuthClient.js';

export type AuthUser = Readonly<{ id: string | number; [key: string]: any }>;
export interface AuthSnapshot {
    version: 1;
    defaultGuard: string;
    guards: Record<string, { user: AuthUser | null }>;
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
    listeners: Set<{ guard: string | null; event: AuthEvent; callback: Listener }>;
    revision: number;
    client?: AuthClient;
    transitions: number;
};

/** Client view of server authentication. login/logout record successful server actions; they make no HTTP requests. */
export class AuthService {
    private readonly context: Context;
    private readonly guardName: string | null;

    constructor(user: AuthUser | null = null, defaultGuard = 'web', context?: Context, guardName: string | null = null) {
        this.context = context ?? {
            defaultGuard, users: new Map([[defaultGuard, AuthService.copyUser(user)]]),
            instances: new Map(), listeners: new Set(), revision: 0, transitions: 0,
        };
        this.guardName = guardName;
    }

    static fromSnapshot(snapshot?: unknown): AuthService {
        const service = new AuthService();
        if (snapshot !== undefined) service.applySnapshot(snapshot, true);
        return service;
    }

    get revision(): number { return this.context.revision; }
    get client(): AuthClient { return this.context.client ??= new AuthClient(this); }
    get isTransitioning(): boolean { return this.context.transitions > 0; }
    /** Internal transport barrier: page responses cannot overwrite an in-flight login/logout. */
    beginClientTransition(): () => void {
        this.context.revision++;
        this.context.transitions++;
        let finished = false;
        return () => {
            if (finished) return;
            finished = true;
            this.context.transitions--;
            this.context.revision++;
        };
    }
    private get name(): string { return this.guardName ?? this.context.defaultGuard; }

    guard(name?: string | null): AuthService {
        if (name == null) return this;
        if (!name.trim()) throw new TypeError('An auth guard must have a name.');
        let guard = this.context.instances.get(name);
        if (!guard) {
            guard = new AuthService(null, this.context.defaultGuard, this.context, name);
            this.context.instances.set(name, guard);
        }
        return guard;
    }

    check(): boolean { return this.user() !== null; }
    guest(): boolean { return !this.check(); }
    id(): string | number | null { return this.user()?.id ?? null; }
    user<T extends AuthUser = AuthUser>(): T | null {
        trackDependency(this);
        return (this.context.users.get(this.name) ?? null) as T | null;
    }

    /** Call only after the server accepted login (including registration/OAuth). */
    login(user: AuthUser): this { return this.setUser(user, 'login'); }
    /** Call only after the server confirmed logout or session expiry. */
    logout(): this { return this.setUser(null, 'logout'); }

    setUser(user: AuthUser | null, source: AuthChange['source'] = 'sync'): this {
        const next = AuthService.copyUser(user);
        const previous = this.user();
        // Even a repeated explicit login/logout invalidates older in-flight responses.
        if (source !== 'sync' || !AuthService.sameUser(previous, next)) this.context.revision++;
        this.context.users.set(this.name, next);
        this.emit(this.name, previous, next, source);
        return this;
    }

    /** Authoritative page-data response. A snapshot replaces guards omitted by the server too. */
    sync(snapshot: unknown, source: AuthChange['source'] = 'sync'): this { return this.applySnapshot(snapshot, false, source); }
    /** Bootstrap only: restore the server session without reporting a new login. */
    initialize(snapshot: unknown): this { return this.applySnapshot(snapshot, true); }

    on(event: AuthEvent, callback: Listener): () => void {
        const listener = { guard: this.guardName, event, callback };
        this.context.listeners.add(listener);
        return () => { this.context.listeners.delete(listener); };
    }
    subscribe(callback: Listener): () => void { return this.on('change', callback); }
    destroy(): void { this.context.client?.destroy(); this.context.revision++; this.context.listeners.clear(); this.context.instances.clear(); this.context.users.clear(); }

    private applySnapshot(snapshot: unknown, silent: boolean, source: AuthChange['source'] = 'sync'): this {
        if (!AuthService.isSnapshot(snapshot)) throw new TypeError('Invalid auth snapshot.');
        // Validate everything before replacing any current state.
        const users = new Map(Object.entries(snapshot.guards).map(([name, guard]) => [name, AuthService.copyUser(guard.user)]));
        const previous = this.context.users;
        const previousDefault = this.context.defaultGuard;
        this.context.users = users;
        this.context.defaultGuard = snapshot.defaultGuard;
        if (source !== 'sync' || previousDefault !== snapshot.defaultGuard || [...new Set([...previous.keys(), ...users.keys()])]
            .some(name => !AuthService.sameUser(previous.get(name) ?? null, users.get(name) ?? null))) this.context.revision++;
        if (!silent) {
            for (const name of new Set([...previous.keys(), ...users.keys()])) {
                this.emit(name, previous.get(name) ?? null, users.get(name) ?? null, source);
            }
            if (previousDefault !== snapshot.defaultGuard && AuthService.sameUser(previous.get(snapshot.defaultGuard) ?? null, users.get(snapshot.defaultGuard) ?? null)) {
                this.emit(snapshot.defaultGuard, previous.get(previousDefault) ?? null, users.get(snapshot.defaultGuard) ?? null, source);
            }
        }
        return this;
    }

    private emit(guard: string, previousUser: AuthUser | null, user: AuthUser | null, source: AuthChange['source']): void {
        if (AuthService.sameUser(previousUser, user)) return;
        const change = { guard, previousUser, user, source };
        const identityChanged = previousUser?.id !== user?.id;
        const events: AuthEvent[] = [];
        if (identityChanged && previousUser) events.push('logout');
        if (identityChanged && user) events.push('login');
        events.push('change');
        for (const event of events) {
            for (const listener of [...this.context.listeners]) {
                if (!this.context.listeners.has(listener) || listener.event !== event
                    || (listener.guard !== null && listener.guard !== guard)) continue;
                try { listener.callback(change); }
                catch (error) { console.error('[AuthService] Listener error:', error); }
            }
        }
    }

    static isSnapshot(value: any): value is AuthSnapshot {
        return value?.version === 1 && typeof value.defaultGuard === 'string' && value.defaultGuard.length > 0
            && value.guards !== null && typeof value.guards === 'object' && !Array.isArray(value.guards)
            && Object.prototype.hasOwnProperty.call(value.guards, value.defaultGuard)
            && Object.values(value.guards).every((guard: any) => guard && Object.prototype.hasOwnProperty.call(guard, 'user')
                && (guard.user === null || (typeof guard.user === 'object' && !Array.isArray(guard.user)
                    && (typeof guard.user.id === 'string' || typeof guard.user.id === 'number'))));
    }
    private static copyUser(user: AuthUser | null): AuthUser | null {
        if (user === null) return null;
        if (!user || Array.isArray(user) || (typeof user.id !== 'string' && typeof user.id !== 'number')
            || (typeof user.id === 'number' && !Number.isFinite(user.id))) {
            throw new TypeError('An authenticated user must have an id.');
        }
        const copy = structuredClone(user);
        JSON.stringify(copy); // Reject non-JSON user data before changing any state.
        const seen = new WeakSet<object>();
        const freeze = (value: any): void => {
            if (!value || typeof value !== 'object' || seen.has(value)) return;
            seen.add(value);
            for (const item of Object.values(value)) freeze(item);
            Object.freeze(value);
        };
        freeze(copy);
        return copy;
    }
    private static sameUser(a: AuthUser | null, b: AuthUser | null): boolean { return JSON.stringify(a) === JSON.stringify(b); }
}
