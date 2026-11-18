/**
 * Router.href() against the cases core runs too (core/tests/fixtures/href-cases.json, core/tests/Unit/HrefCasesTest.php):
 * PHP and JS must give the same URL for the same page and name (docs/CONTEXT_DOMAINS_AND_HREF_PLAN_2026-11-18.md H4).
 * The bootstrap of from.context is simulated: its own routes in `routes`, every other context in `links`.
 * Cases without a page (from: null) are PHP only.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Router, HrefError } from '../../src/core/routers/Router';
import { readBootConfig } from '../../src/core/bootstrap/ssr';

const fixture = JSON.parse(readFileSync(resolve(__dirname, '../../../core/tests/fixtures/href-cases.json'), 'utf8'));
type World = { primary: string; contexts: Record<string, { hosts: string[]; routes: Record<string, string> }> };

function routerFor(world: World, context: string): Router {
    const routes = Object.entries(world.contexts[context].routes).map(([name, path]) => ({ name, path, component: name }));
    const links: Record<string, [string, string]> = {};
    for (const [slug, ctx] of Object.entries(world.contexts)) {
        if (slug === context) continue;
        for (const [name, path] of Object.entries(ctx.routes)) links[name] = [slug, path];
    }
    const contexts = Object.fromEntries(Object.entries(world.contexts).map(([slug, c]) => [slug, { as: slug, hosts: c.hosts }]));
    const router = new Router();
    router.configure({ routes, context, links, contexts, primary: world.primary });
    return router;
}

describe('href() shared cases', () => {
    const cases = (fixture.cases as any[]).map((c, i) => ({ ...c, i })).filter(c => c.from !== null);

    it.each(cases)('#$i $name from $from.url', (c) => {
        const run = () => routerFor(fixture, c.from.context).resolveHref(c.name, c.params, c.options ?? {}, new URL(c.from.url));
        if (c.error) {
            expect(run).toThrow(HrefError);
            expect(run).toThrow(c.error);
        } else {
            expect(run()).toBe(c.expect);
        }
    });
});

describe('href() / go() on the page', () => {
    afterEach(() => vi.restoreAllMocks());

    it('reads the page location; an unknown name logs and gives ""', () => {
        const router = routerFor(fixture, 'web');
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        // jsdom page: http://localhost:3000/ — unclaimed host, so another host-less context stays on it.
        expect(router.href('home.item', { id: 7 })).toBe('/items/7');
        expect(router.href('users.index')).toBe(`${location.origin}/admin/users`);
        expect(router.href('nope.index')).toBe('');
        expect(error).toHaveBeenCalledWith(expect.stringContaining('not defined'));
    });

    it('go(): SPA navigation in the same context, a page load otherwise', () => {
        const router = routerFor(fixture, 'web');
        const navigate = vi.spyOn(router, 'navigate').mockImplementation(() => {});
        const assign = vi.fn();
        vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, href: window.location.href, assign } as any);
        router.go('home.item', { id: 7 });
        router.go('app.home.item', { id: 7 });
        expect(navigate).toHaveBeenCalledWith('/items/7');
        // The dev port of the page (jsdom: 3000) is carried to the other host.
        expect(assign).toHaveBeenCalledWith(`http://app.test${location.port ? ':' + location.port : ''}/items/7`);
    });

    it('boot config carries context, links, contexts and primary to the router', () => {
        (window as any).APP_CONFIGS = {
            context: 'web',
            router: { routes: [{ name: 'web.home.index', path: '/', component: 'web.home' }], links: { 'app.home.index': ['app', '/'] }, contexts: { app: { hosts: ['app.test'] } }, primary: 'http://example.test' },
        };
        try {
            const cfg = readBootConfig()!;
            expect(cfg.router).toMatchObject({ context: 'web', links: { 'app.home.index': ['app', '/'] }, contexts: { app: { hosts: ['app.test'] } }, primary: 'http://example.test' });
            const router = new Router();
            router.configure(cfg.router);
            expect(router.resolveHref('app.home.index', {}, {}, new URL('http://example.test/'))).toBe('http://app.test/');
            expect(router.resolveHref('home.index', {}, {}, new URL('http://example.test/'))).toBe('/');
        } finally {
            delete (window as any).APP_CONFIGS;
        }
    });
});
