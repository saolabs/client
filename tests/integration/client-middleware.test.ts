import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {Router} from '../../src/core/routers/Router';
import {Application} from '../../src/core/app/Application';
import {AuthService} from '../../src/core/services/AuthService';
import {authMiddleware, guestMiddleware, type ClientMiddlewareContext} from '../../src/core/routers/ClientMiddleware';
import {defineBundle, bootBundles, mergeBundles} from '../../src/core/bootstrap/bundle';

let router: Router, app: Application;
const mounted = vi.fn(async () => ({}));
const hydrated = vi.fn(async () => ({}));
const routes = [
    {path:'/', name:'home', component:'home'},
    {path:'/login', name:'login', component:'login'},
    {path:'/private/{id}', name:'private', component:'private', meta:{middleware:['members']}},
];
beforeEach(() => {
    history.replaceState({}, '', '/'); vi.stubGlobal('scrollTo', vi.fn());
    app = new Application(); app.instance('Auth', new AuthService());
    router = new Router(app).configure({routes}); app.instance('Router', router);
    mounted.mockClear(); hydrated.mockClear();
    router.setViewManager({mountView:mounted, hydrateView:hydrated} as any);
});
afterEach(() => { router.destroy(); app.destroy(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const at = async (path:string) => vi.waitFor(() => {
    expect(location.pathname + location.search + location.hash).toBe(path);
    const active = router.getCurrentRoute();
    expect(active ? active.$uri + (active.$fragment ? '#'+active.$fragment : '') : null).toBe(path);
});

it('registers the project provider through bootstrap before initial hydration and redirects guests without mounting the protected view', async () => {
    const provider = {aliases:{auth:authMiddleware({redirect:({url}) => '/login?next='+encodeURIComponent(url)})}, groups:{members:['auth']}};
    const bundle = defineBundle({middleware:provider});
    bootBundles(mergeBundles([bundle]), app);
    history.replaceState({}, '', '/private/42?q=hello#part');
    const consumeSSRViewId = vi.fn(name => name === 'private' ? 'ssr' : null);
    router.setViewManager({mountView:mounted, hydrateView:hydrated, consumeSSRViewId} as any);
    router.start();
    await at('/login?next=%2Fprivate%2F42%3Fq%3Dhello%23part');
    expect(hydrated).not.toHaveBeenCalled();
    expect(consumeSSRViewId).not.toHaveBeenCalledWith('private');
    expect(mounted.mock.calls.map(call=>call[0])).toEqual(['login']);
});

it('accepts inline async functions and installs every bundle policy before a boot hook navigates', async () => {
    app.Auth.login({id:'member'});
    const check = vi.fn();
    bootBundles(mergeBundles([
        defineBundle({boot(App) { App.Router.navigate('/private/9'); }}),
        defineBundle({middleware:{
            aliases:{inline:async ({app, to, signal}, id) => {
                await Promise.resolve();
                check(to.name, to.params?.id, signal.aborted);
                return app.Auth.check() && to.params?.id === id;
            }},
            groups:{members:['inline:9']},
        }}),
    ]), app);
    await at('/private/9');
    expect(check).toHaveBeenCalledWith('private', '9', false);
    expect(mounted).toHaveBeenCalledTimes(1);
});

it('rolls back bundle middleware and skips boot hooks if registration fails', async () => {
    const boot = vi.fn();
    expect(() => bootBundles(mergeBundles([
        defineBundle({middleware:{aliases:{duplicate:()=>false}}, boot}),
        defineBundle({middleware:{aliases:{duplicate:()=>true}}}),
    ]), app)).toThrow('Duplicate');
    expect(boot).not.toHaveBeenCalled();
    router.useMiddleware({aliases:{duplicate:()=>true},groups:{members:['duplicate']}});
    router.navigate('/private/1'); await at('/private/1');
});

it('runs global, inherited route groups, parameters, project name assignments and existing guards in order', async () => {
    const order:string[] = [];
    class Audit { handle(ctx:ClientMiddlewareContext, action:string) { order.push(action+':'+ctx.to.params?.id); } }
    router.configure({routes:[{path:'/team',meta:{middleware:['parent']},children:[
        {path:'{id}',name:'team',component:'team',meta:{middleware:['child']}},
    ]}]});
    router.useMiddleware({global:[() => {order.push('global');}], aliases:{
        audit:new Audit(), parent:()=>{order.push('parent');}, child:()=>{order.push('child');},
    }, routes:{team:['audit:edit']}});
    router.beforeEach(()=>{order.push('before');return true;});
    router.addNavigationGuard(()=>{order.push('guard');return true;});
    router.navigate('/team/7'); await at('/team/7');
    expect(order).toEqual(['global','parent','child','edit:7','before','guard']);
    expect(mounted).toHaveBeenCalledTimes(1);
});

it('supports named guards and async custom middleware while leaving normal routes public', async () => {
    app.Auth.guard('admin').login({id:'staff'});
    router.useMiddleware({aliases:{auth:authMiddleware({redirect:'/login'})}, groups:{members:['auth:admin',async()=>true]}});
    router.navigate('/private/1'); await at('/private/1');
    expect(mounted.mock.calls[0][0]).toBe('private');
    app.Auth.guard('admin').logout();
    router.navigate('/private/2'); await at('/login');
    router.navigate('/'); await at('/');
});

it('redirects a member away from guest-only pages', async () => {
    app.Auth.login({id:'member'});
    router.useMiddleware({aliases:{guest:guestMiddleware({redirect:'/'})},routes:{login:['guest']}});
    router.navigate('/login'); await at('/');
    expect(mounted.mock.calls.map(c=>c[0])).toEqual(['home']);
});

it('blocks false without changing history or mounting a view', async () => {
    router.useMiddleware({groups:{members:[()=>false]}});
    router.navigate('/private/1');
    await vi.waitFor(()=>expect((router as any).isNavigating).toBe(false));
    expect(location.pathname).toBe('/'); expect(mounted).not.toHaveBeenCalled();
});

it('fails closed for unknown aliases, cyclic groups and malformed results', async () => {
    const error = vi.spyOn(console,'error').mockImplementation(()=>{});
    const configs = [
        {groups:{members:['missing']}},
        {groups:{members:['cycle'],cycle:['members']}},
        {groups:{members:[()=> 'wrong' as any]}},
    ];
    for (const config of configs) {
        const off = router.useMiddleware(config);
        router.navigate('/private/1'); await vi.waitFor(()=>expect((router as any).isNavigating).toBe(false)); off();
    }
    expect(error).toHaveBeenCalledTimes(3); expect(mounted).not.toHaveBeenCalled();
    expect(location.pathname).toBe('/');
});

it('cancels an older async middleware even if it ignores the abort signal', async () => {
    let finish!:(value:boolean)=>void, signal:AbortSignal;
    const slow = vi.fn((ctx:ClientMiddlewareContext) => {signal=ctx.signal;return new Promise<boolean>(resolve=>{finish=resolve;});});
    router.useMiddleware({groups:{members:[slow]}});
    router.navigate('/private/1'); await vi.waitFor(()=>expect(slow).toHaveBeenCalled());
    router.navigate('/login'); await at('/login');
    expect(signal!.aborted).toBe(true);
    finish(true); await Promise.resolve();
    expect(mounted.mock.calls.map(c=>c[0])).toEqual(['login']);
});

it('aborts active middleware on destroy and never mounts from its late result', async () => {
    let finish!:(value:boolean)=>void;
    const slow=vi.fn(()=>new Promise<boolean>(resolve=>{finish=resolve;}));
    router.useMiddleware({groups:{members:[slow]}});
    router.navigate('/private/1'); await vi.waitFor(()=>expect(slow).toHaveBeenCalled());
    router.destroy(); finish(true); await Promise.resolve(); await Promise.resolve();
    expect(mounted).not.toHaveBeenCalled();
});

it('restores the prior URL when browser Back/Forward enters a blocked route', async () => {
    router.useMiddleware({groups:{members:[()=>false]}});
    router.start(true); router.navigate('/login'); await at('/login');
    history.pushState({}, '', '/private/1'); window.dispatchEvent(new PopStateEvent('popstate'));
    await at('/login'); expect(mounted).toHaveBeenCalledTimes(1);
});

it('rejects external redirects and bounds redirect loops', async () => {
    const error = vi.spyOn(console,'error').mockImplementation(()=>{});
    let off=router.useMiddleware({groups:{members:[()=>({redirect:'https://evil.example.test/'})]}});
    router.navigate('/private/1'); await vi.waitFor(()=>expect(error).toHaveBeenCalledTimes(1)); off();
    off=router.useMiddleware({routes:{home:[()=>({redirect:'/login'})],login:[()=>({redirect:'/'})]}});
    router.navigate('/'); await vi.waitFor(()=>expect(error).toHaveBeenCalledTimes(2)); off();
    expect(mounted).not.toHaveBeenCalled();
});

it('supports removal and rejects ambiguous duplicate aliases without partially changing the registry', async () => {
    const off=router.useMiddleware({aliases:{blocked:()=>false},groups:{members:['blocked']}});
    expect(()=>router.useMiddleware({aliases:{blocked:()=>true}})).toThrow('Duplicate');
    off(); off();
    router.useMiddleware({groups:{members:[()=>true]}});
    router.navigate('/private/1'); await at('/private/1');
});
