import type { ApplicationInterface } from '../contracts/ApplicationInterface.js';
import type { ActiveRoute, Route, Router } from './Router.js';
export interface ClientMiddlewareContext {
    app: ApplicationInterface;
    router: Router;
    to: Route;
    from: ActiveRoute | null;
    /** Complete local destination, including query and fragment. */
    url: string;
    signal: AbortSignal;
}
export type ClientMiddlewareResult = void | boolean | {
    redirect: string;
    replace?: boolean;
};
export type ClientMiddleware = (context: ClientMiddlewareContext, ...parameters: string[]) => ClientMiddlewareResult | Promise<ClientMiddlewareResult>;
export type ClientMiddlewareHandler = ClientMiddleware | {
    handle: ClientMiddleware;
};
export type ClientMiddlewareRef = string | ClientMiddlewareHandler;
export interface ClientMiddlewareConfig {
    aliases?: Record<string, ClientMiddlewareHandler>;
    groups?: Record<string, readonly ClientMiddlewareRef[]>;
    global?: readonly ClientMiddlewareRef[];
    /** Optional project-only assignment by exact route name. */
    routes?: Record<string, readonly ClientMiddlewareRef[]>;
}
/** Per-router registry. Projects register configuration through bootstrap, not the builder. */
export declare class ClientMiddlewareRegistry {
    private configs;
    register(config: ClientMiddlewareConfig): () => void;
    has(route: Route): boolean;
    clear(): void;
    run(context: ClientMiddlewareContext): Promise<ClientMiddlewareResult>;
    private assertHandler;
    /** A middleware that ignores AbortSignal must not hold up a newer navigation. */
    private waitForResult;
}
export interface AuthMiddlewareOptions {
    redirect: string | ((context: ClientMiddlewareContext) => string);
    guard?: string;
}
export declare function authMiddleware(options: AuthMiddlewareOptions): ClientMiddleware;
export declare function guestMiddleware(options: AuthMiddlewareOptions): ClientMiddleware;
//# sourceMappingURL=ClientMiddleware.d.ts.map