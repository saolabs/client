import type {ApplicationInterface} from '../contracts/ApplicationInterface.js';
import type {ActiveRoute, Route, Router} from './Router.js';

export interface ClientMiddlewareContext {
    app: ApplicationInterface;
    router: Router;
    to: Route;
    from: ActiveRoute | null;
    /** Complete local destination, including query and fragment. */
    url: string;
    signal: AbortSignal;
}
export type ClientMiddlewareResult = void | boolean | {redirect: string; replace?: boolean};
export type ClientMiddleware = (context: ClientMiddlewareContext, ...parameters: string[]) => ClientMiddlewareResult | Promise<ClientMiddlewareResult>;
export type ClientMiddlewareHandler = ClientMiddleware | {handle: ClientMiddleware};
export type ClientMiddlewareRef = string | ClientMiddlewareHandler;
export interface ClientMiddlewareConfig {
    aliases?: Record<string, ClientMiddlewareHandler>;
    groups?: Record<string, readonly ClientMiddlewareRef[]>;
    global?: readonly ClientMiddlewareRef[];
    /** Optional project-only assignment by exact route name. */
    routes?: Record<string, readonly ClientMiddlewareRef[]>;
}

/** Per-router registry. Projects register configuration through bootstrap, not the builder. */
export class ClientMiddlewareRegistry {
    private configs = new Set<ClientMiddlewareConfig>();

    register(config: ClientMiddlewareConfig): () => void {
        const names = new Set<string>();
        for (const current of [...this.configs, config]) {
            for (const name of [...Object.keys(current.aliases ?? {}), ...Object.keys(current.groups ?? {})]) {
                if (!/^[A-Za-z_][\w.-]*$/.test(name) || names.has(name)) throw new Error(`Duplicate or invalid client middleware alias: ${name}`);
                names.add(name);
            }
            for (const handler of Object.values(current.aliases ?? {})) this.assertHandler(handler);
        }
        const installed = {
            aliases: {...config.aliases},
            groups: Object.fromEntries(Object.entries(config.groups ?? {}).map(([name, refs]) => [name, [...refs]])),
            global: [...config.global ?? []],
            routes: Object.fromEntries(Object.entries(config.routes ?? {}).map(([name, refs]) => [name, [...refs]])),
        };
        this.configs.add(installed);
        return () => { this.configs.delete(installed); };
    }

    has(route: Route): boolean { return this.configs.size > 0 || route.meta?.middleware !== undefined; }
    clear(): void { this.configs.clear(); }

    async run(context: ClientMiddlewareContext): Promise<ClientMiddlewareResult> {
        const aliases: Record<string, ClientMiddlewareHandler> = Object.create(null);
        const groups: Record<string, readonly ClientMiddlewareRef[]> = Object.create(null);
        const global: ClientMiddlewareRef[] = [], local: ClientMiddlewareRef[] = [];
        for (const config of this.configs) {
            Object.assign(aliases, config.aliases); Object.assign(groups, config.groups);
            global.push(...config.global ?? []);
            local.push(...(context.to.name ? config.routes?.[context.to.name] ?? [] : []));
        }
        const declared = context.to.meta?.middleware ?? [];
        if (!Array.isArray(declared)) throw new TypeError('Route meta.middleware must be an array.');
        const pipeline: Array<{handler: ClientMiddlewareHandler; parameters: string[]}> = [];
        const expand = (ref: ClientMiddlewareRef, stack: string[] = []) => {
            if (typeof ref !== 'string') { this.assertHandler(ref); pipeline.push({handler:ref, parameters:[]}); return; }
            const colon = ref.indexOf(':');
            const name = colon < 0 ? ref : ref.slice(0, colon);
            const parameters = colon < 0 ? [] : ref.slice(colon + 1).split(',');
            if (Object.prototype.hasOwnProperty.call(groups, name)) {
                if (parameters.length || stack.includes(name)) throw new Error(`Invalid or recursive client middleware group: ${[...stack, name].join(' -> ')}`);
                for (const child of groups[name]) expand(child, [...stack, name]);
            } else {
                if (!Object.prototype.hasOwnProperty.call(aliases, name)) throw new Error(`Unknown client middleware: ${name}`);
                pipeline.push({handler:aliases[name], parameters});
            }
        };
        for (const ref of [...global, ...declared, ...local]) expand(ref);
        for (const {handler, parameters} of pipeline) {
            if (context.signal.aborted) return false;
            const result = await this.waitForResult(
                typeof handler === 'function' ? handler(context, ...parameters) : handler.handle(context, ...parameters), context.signal);
            if (context.signal.aborted) return false;
            if (result === false) return false;
            if (result && typeof result === 'object' && typeof result.redirect === 'string') return result;
            if (result !== undefined && result !== true) throw new TypeError('Client middleware must return true, false, void or {redirect}.');
        }
        return true;
    }

    private assertHandler(handler: unknown): asserts handler is ClientMiddlewareHandler {
        if (typeof handler !== 'function' && (!handler || typeof (handler as any).handle !== 'function')) {
            throw new TypeError('Client middleware must be a function or an instance with handle(context).');
        }
    }

    /** A middleware that ignores AbortSignal must not hold up a newer navigation. */
    private waitForResult(value: ClientMiddlewareResult | Promise<ClientMiddlewareResult>, signal: AbortSignal): Promise<ClientMiddlewareResult> {
        return new Promise((resolve, reject) => {
            const abort = () => { signal.removeEventListener('abort', abort); resolve(false); };
            if (signal.aborted) { Promise.resolve(value).catch(() => {}); resolve(false); return; }
            signal.addEventListener('abort', abort, {once:true});
            Promise.resolve(value).then(result => { signal.removeEventListener('abort', abort); resolve(result); },
                error => { signal.removeEventListener('abort', abort); reject(error); });
        });
    }
}

export interface AuthMiddlewareOptions {
    redirect: string | ((context: ClientMiddlewareContext) => string);
    guard?: string;
}

export function authMiddleware(options: AuthMiddlewareOptions): ClientMiddleware {
    return (context, guard = options.guard) => {
        if (context.app.Auth.guard(guard).check()) return true;
        return {redirect: typeof options.redirect === 'function' ? options.redirect(context) : options.redirect};
    };
}

export function guestMiddleware(options: AuthMiddlewareOptions): ClientMiddleware {
    return (context, guard = options.guard) => {
        if (context.app.Auth.guard(guard).guest()) return true;
        return {redirect: typeof options.redirect === 'function' ? options.redirect(context) : options.redirect};
    };
}
