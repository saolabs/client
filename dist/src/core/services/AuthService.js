import { trackDependency } from './ReactiveDependency.js';
import { AuthClient } from './AuthClient.js';
/** Client view of server authentication. login/logout record successful server actions; they make no HTTP requests. */
export class AuthService {
    constructor(user = null, defaultGuard = 'web', context, guardName = null) {
        this.context = context ?? {
            defaultGuard, users: new Map([[defaultGuard, AuthService.copyUser(user)]]),
            instances: new Map(), listeners: new Set(), revision: 0, transitions: 0,
        };
        this.guardName = guardName;
    }
    static fromSnapshot(snapshot) {
        const service = new AuthService();
        if (snapshot !== undefined)
            service.applySnapshot(snapshot, true);
        return service;
    }
    get revision() { return this.context.revision; }
    get client() { var _a; return (_a = this.context).client ?? (_a.client = new AuthClient(this)); }
    get isTransitioning() { return this.context.transitions > 0; }
    /** Internal transport barrier: page responses cannot overwrite an in-flight login/logout. */
    beginClientTransition() {
        this.context.revision++;
        this.context.transitions++;
        let finished = false;
        return () => {
            if (finished)
                return;
            finished = true;
            this.context.transitions--;
            this.context.revision++;
        };
    }
    get name() { return this.guardName ?? this.context.defaultGuard; }
    guard(name) {
        if (name == null)
            return this;
        if (!name.trim())
            throw new TypeError('An auth guard must have a name.');
        let guard = this.context.instances.get(name);
        if (!guard) {
            guard = new AuthService(null, this.context.defaultGuard, this.context, name);
            this.context.instances.set(name, guard);
        }
        return guard;
    }
    check() { return this.user() !== null; }
    guest() { return !this.check(); }
    id() { return this.user()?.id ?? null; }
    user() {
        trackDependency(this);
        return (this.context.users.get(this.name) ?? null);
    }
    /** Call only after the server accepted login (including registration/OAuth). */
    login(user) { return this.setUser(user, 'login'); }
    /** Call only after the server confirmed logout or session expiry. */
    logout() { return this.setUser(null, 'logout'); }
    setUser(user, source = 'sync') {
        const next = AuthService.copyUser(user);
        const previous = this.user();
        // Even a repeated explicit login/logout invalidates older in-flight responses.
        if (source !== 'sync' || !AuthService.sameUser(previous, next))
            this.context.revision++;
        this.context.users.set(this.name, next);
        this.emit(this.name, previous, next, source);
        return this;
    }
    /** Authoritative page-data response. A snapshot replaces guards omitted by the server too. */
    sync(snapshot, source = 'sync') { return this.applySnapshot(snapshot, false, source); }
    /** Bootstrap only: restore the server session without reporting a new login. */
    initialize(snapshot) { return this.applySnapshot(snapshot, true); }
    on(event, callback) {
        const listener = { guard: this.guardName, event, callback };
        this.context.listeners.add(listener);
        return () => { this.context.listeners.delete(listener); };
    }
    subscribe(callback) { return this.on('change', callback); }
    destroy() { this.context.client?.destroy(); this.context.revision++; this.context.listeners.clear(); this.context.instances.clear(); this.context.users.clear(); }
    applySnapshot(snapshot, silent, source = 'sync') {
        if (!AuthService.isSnapshot(snapshot))
            throw new TypeError('Invalid auth snapshot.');
        // Validate everything before replacing any current state.
        const users = new Map(Object.entries(snapshot.guards).map(([name, guard]) => [name, AuthService.copyUser(guard.user)]));
        const previous = this.context.users;
        const previousDefault = this.context.defaultGuard;
        this.context.users = users;
        this.context.defaultGuard = snapshot.defaultGuard;
        if (source !== 'sync' || previousDefault !== snapshot.defaultGuard || [...new Set([...previous.keys(), ...users.keys()])]
            .some(name => !AuthService.sameUser(previous.get(name) ?? null, users.get(name) ?? null)))
            this.context.revision++;
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
    emit(guard, previousUser, user, source) {
        if (AuthService.sameUser(previousUser, user))
            return;
        const change = { guard, previousUser, user, source };
        const identityChanged = previousUser?.id !== user?.id;
        const events = [];
        if (identityChanged && previousUser)
            events.push('logout');
        if (identityChanged && user)
            events.push('login');
        events.push('change');
        for (const event of events) {
            for (const listener of [...this.context.listeners]) {
                if (!this.context.listeners.has(listener) || listener.event !== event
                    || (listener.guard !== null && listener.guard !== guard))
                    continue;
                try {
                    listener.callback(change);
                }
                catch (error) {
                    console.error('[AuthService] Listener error:', error);
                }
            }
        }
    }
    static isSnapshot(value) {
        return value?.version === 1 && typeof value.defaultGuard === 'string' && value.defaultGuard.length > 0
            && value.guards !== null && typeof value.guards === 'object' && !Array.isArray(value.guards)
            && Object.prototype.hasOwnProperty.call(value.guards, value.defaultGuard)
            && Object.values(value.guards).every((guard) => guard && Object.prototype.hasOwnProperty.call(guard, 'user')
                && (guard.user === null || (typeof guard.user === 'object' && !Array.isArray(guard.user)
                    && (typeof guard.user.id === 'string' || typeof guard.user.id === 'number'))));
    }
    static copyUser(user) {
        if (user === null)
            return null;
        if (!user || Array.isArray(user) || (typeof user.id !== 'string' && typeof user.id !== 'number')
            || (typeof user.id === 'number' && !Number.isFinite(user.id))) {
            throw new TypeError('An authenticated user must have an id.');
        }
        const copy = structuredClone(user);
        JSON.stringify(copy); // Reject non-JSON user data before changing any state.
        const seen = new WeakSet();
        const freeze = (value) => {
            if (!value || typeof value !== 'object' || seen.has(value))
                return;
            seen.add(value);
            for (const item of Object.values(value))
                freeze(item);
            Object.freeze(value);
        };
        freeze(copy);
        return copy;
    }
    static sameUser(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
}
//# sourceMappingURL=AuthService.js.map