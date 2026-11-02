import {afterEach, beforeAll, beforeEach, expect, it, vi} from 'vitest';
import path from 'node:path';
import {app} from '../../src/core/helpers/app';
import {AuthService} from '../../src/core/services/AuthService';
import {HelperService} from '../../src/core/services/HelperService';
import {ViewManager} from '../../src/core/view/ViewManager';
import {Router} from '../../src/core/routers/Router';
import {View} from '../../src/core/view/View';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';

let factory:any, vm:ViewManager, router:Router;
const setup = vi.fn();
beforeAll(async () => {
    factory = (await import(/* @vite-ignore */ path.join(__dirname, '../fixtures/compiled/.generated/js/middleware.js'))).default;
});
beforeEach(() => {
    history.replaceState({}, '', '/'); vi.stubGlobal('scrollTo', vi.fn()); setup.mockClear();
    app().instance('Auth', new AuthService()); app().instance('Helper', new HelperService(app())); app().instance('Registry', MarkerRegistry);
    Object.assign(app().Helper, {recordMiddlewareSetup:setup});
    const root = document.createElement('div'); document.body.append(root);
    vm = new ViewManager(app()); app().instance('View', vm);
    vm.init({container:root, registry:{'fixtures.middleware':factory, 'public':() => {
        const view=new View('public', 'view');
        view.__ctrl__.setup({superView:null,data:{},render(){return this.wrapper(p=>[this.html('public','p',p,{},()=>[this.text('Public')])]);}} as any);
        return view;
    }}});
    router = new Router(app()).configure({routes:[{path:'/',name:'public',component:'public'},
        {path:'/private',name:'private',component:'fixtures.middleware'}]});
    router.setViewManager(vm); app().instance('Router', router);
});
afterEach(() => { router?.destroy(); vm?.destroy(); app().flush(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const at=async(path:string)=>vi.waitFor(()=>expect(router.getCurrentRoute()?.$uri).toBe(path));

it('checks compiled metadata before setup and checks again before restoring a cached page', async () => {
    expect(factory.middleware).toEqual(['requireLogin']);
    const check=vi.fn(({app})=>app.Auth.check());
    router.useMiddleware({aliases:{requireLogin:check}});
    router.navigate('/private'); await vi.waitFor(()=>expect(check).toHaveBeenCalledTimes(1));
    expect(setup).not.toHaveBeenCalled(); expect(document.querySelector('#middleware-protected')).toBeNull();
    app().Auth.login({id:1}); router.navigate('/private'); await at('/private');
    const node=document.querySelector('#middleware-protected'); expect(node).not.toBeNull(); expect(setup).toHaveBeenCalledTimes(1);
    router.navigate('/'); await at('/');
    router.navigate('/private'); await at('/private');
    expect(document.querySelector('#middleware-protected')).toBe(node); expect(setup).toHaveBeenCalledTimes(1);
    router.navigate('/'); await at('/'); app().Auth.logout();
    router.navigate('/private'); await vi.waitFor(()=>expect(check).toHaveBeenCalledTimes(4));
    expect(router.getCurrentRoute()?.$uri).toBe('/'); expect(document.querySelector('#middleware-protected')).toBeNull();
});

it('blocks SSR hydration before consuming its id or constructing the view', async () => {
    const consume=vi.spyOn(vm,'consumeSSRViewId'); const hydrate=vi.spyOn(vm,'hydrateView');
    router.useMiddleware({aliases:{requireLogin:()=>({redirect:'/'})}});
    history.replaceState({}, '', '/private'); router.start(); await at('/');
    expect(hydrate).not.toHaveBeenCalled(); expect(consume).not.toHaveBeenCalledWith('fixtures.middleware');
    expect(setup).not.toHaveBeenCalled();
});

it('reads lazy-loader metadata without importing the protected chunk when denied', async () => {
    const load=vi.fn(async()=>({default:factory}));
    vm.registerView('fixtures.middleware', Object.assign(load,{middleware:factory.middleware}));
    router.useMiddleware({aliases:{requireLogin:()=>false}});
    router.navigate('/private'); await vi.waitFor(()=>expect((router as any).isNavigating).toBe(false));
    expect(load).not.toHaveBeenCalled(); expect(setup).not.toHaveBeenCalled();
});

it('combines route and view policies in order and waits for async view checks before setup', async () => {
    const order:string[]=[]; let finish!:(value:boolean)=>void;
    router.replaceRoutes([{path:'/private',component:'fixtures.middleware',meta:{middleware:['routeCheck']}}]);
    router.useMiddleware({aliases:{routeCheck:()=>{order.push('route');}, requireLogin:()=>{
        order.push('view'); return new Promise<boolean>(resolve=>{finish=resolve;});
    }}});
    router.navigate('/private'); await vi.waitFor(()=>expect(order).toEqual(['route','view']));
    expect(setup).not.toHaveBeenCalled(); finish(true); await at('/private'); expect(setup).toHaveBeenCalledTimes(1);
});
