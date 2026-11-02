/** Per-router registry. Projects register configuration through bootstrap, not the builder. */
export class ClientMiddlewareRegistry {
    constructor() {
        this.configs = new Set();
    }
    register(config) {
        const names = new Set();
        for (const current of [...this.configs, config]) {
            for (const name of [...Object.keys(current.aliases ?? {}), ...Object.keys(current.groups ?? {})]) {
                if (!/^[A-Za-z_][\w.-]*$/.test(name) || names.has(name))
                    throw new Error(`Duplicate or invalid client middleware alias: ${name}`);
                names.add(name);
            }
            for (const handler of Object.values(current.aliases ?? {}))
                this.assertHandler(handler);
        }
        const installed = {
            aliases: { ...config.aliases },
            groups: Object.fromEntries(Object.entries(config.groups ?? {}).map(([name, refs]) => [name, [...refs]])),
            global: [...config.global ?? []],
            routes: Object.fromEntries(Object.entries(config.routes ?? {}).map(([name, refs]) => [name, [...refs]])),
        };
        this.configs.add(installed);
        return () => { this.configs.delete(installed); };
    }
    has(route) { return this.configs.size > 0 || route.meta?.middleware !== undefined; }
    clear() { this.configs.clear(); }
    async run(context) {
        const aliases = Object.create(null);
        const groups = Object.create(null);
        const global = [], local = [];
        for (const config of this.configs) {
            Object.assign(aliases, config.aliases);
            Object.assign(groups, config.groups);
            global.push(...config.global ?? []);
            local.push(...(context.to.name ? config.routes?.[context.to.name] ?? [] : []));
        }
        const declared = context.to.meta?.middleware ?? [];
        if (!Array.isArray(declared))
            throw new TypeError('Route meta.middleware must be an array.');
        const pipeline = [];
        const expand = (ref, stack = []) => {
            if (typeof ref !== 'string') {
                this.assertHandler(ref);
                pipeline.push({ handler: ref, parameters: [] });
                return;
            }
            const colon = ref.indexOf(':');
            const name = colon < 0 ? ref : ref.slice(0, colon);
            const parameters = colon < 0 ? [] : ref.slice(colon + 1).split(',');
            if (Object.prototype.hasOwnProperty.call(groups, name)) {
                if (parameters.length || stack.includes(name))
                    throw new Error(`Invalid or recursive client middleware group: ${[...stack, name].join(' -> ')}`);
                for (const child of groups[name])
                    expand(child, [...stack, name]);
            }
            else {
                if (!Object.prototype.hasOwnProperty.call(aliases, name))
                    throw new Error(`Unknown client middleware: ${name}`);
                pipeline.push({ handler: aliases[name], parameters });
            }
        };
        for (const ref of [...global, ...declared, ...local])
            expand(ref);
        for (const { handler, parameters } of pipeline) {
            if (context.signal.aborted)
                return false;
            const result = await this.waitForResult(typeof handler === 'function' ? handler(context, ...parameters) : handler.handle(context, ...parameters), context.signal);
            if (context.signal.aborted)
                return false;
            if (result === false)
                return false;
            if (result && typeof result === 'object' && typeof result.redirect === 'string')
                return result;
            if (result !== undefined && result !== true)
                throw new TypeError('Client middleware must return true, false, void or {redirect}.');
        }
        return true;
    }
    assertHandler(handler) {
        if (typeof handler !== 'function' && (!handler || typeof handler.handle !== 'function')) {
            throw new TypeError('Client middleware must be a function or an instance with handle(context).');
        }
    }
    /** A middleware that ignores AbortSignal must not hold up a newer navigation. */
    waitForResult(value, signal) {
        return new Promise((resolve, reject) => {
            const abort = () => { signal.removeEventListener('abort', abort); resolve(false); };
            if (signal.aborted) {
                Promise.resolve(value).catch(() => { });
                resolve(false);
                return;
            }
            signal.addEventListener('abort', abort, { once: true });
            Promise.resolve(value).then(result => { signal.removeEventListener('abort', abort); resolve(result); }, error => { signal.removeEventListener('abort', abort); reject(error); });
        });
    }
}
export function authMiddleware(options) {
    return (context, guard = options.guard) => {
        if (context.app.Auth.guard(guard).check())
            return true;
        return { redirect: typeof options.redirect === 'function' ? options.redirect(context) : options.redirect };
    };
}
export function guestMiddleware(options) {
    return (context, guard = options.guard) => {
        if (context.app.Auth.guard(guard).guest())
            return true;
        return { redirect: typeof options.redirect === 'function' ? options.redirect(context) : options.redirect };
    };
}
//# sourceMappingURL=ClientMiddleware.js.map