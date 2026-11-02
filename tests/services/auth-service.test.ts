import {afterEach, describe, expect, it, vi} from 'vitest';
import {AuthService, type AuthSnapshot} from '../../src/core/services/AuthService';
import {Application} from '../../src/core/app/Application';
import {HelperService} from '../../src/core/services/HelperService';
import {CoreServiceProvider} from '../../src/core/bootstrap/providers/CoreServiceProvider';
import {HttpService} from '../../src/core/services/HttpService';
import {app} from '../../src/core/helpers/app';

const snapshot = (user:any = null):AuthSnapshot => ({version:1,defaultGuard:'web',guards:{web:{user}}});
afterEach(() => { vi.unstubAllGlobals(); app().flush(); });

describe('AuthService', () => {
    it('boots the server user before Helper is created and returns the same service instance', () => {
        const application = new Application();
        application.set('SharedData',{auth:snapshot({id:7,name:'Lan'})});
        new CoreServiceProvider(application).register();
        const helper = new HelperService(application);
        expect(helper.auth()).toBe(application.Auth);
        expect(helper.auth()).toBe(helper.auth());
        expect(helper.auth().check()).toBe(true);
        expect(helper.auth().guest()).toBe(false);
        expect(helper.auth().id()).toBe(7);
        expect(helper.auth().user()?.name).toBe('Lan');
        expect(helper.isAuth()).toBe(true);
        application.flush();
    });

    it('notifies transitions once and profile updates without another login', () => {
        const auth = new AuthService();
        const login=vi.fn(),logout=vi.fn(),change=vi.fn();
        auth.on('login',login); auth.on('logout',logout); const off=auth.subscribe(change);
        expect(auth.guest()).toBe(true);
        auth.login({id:'one',name:'Lan'});
        auth.login({id:'one',name:'Lan'});
        auth.setUser({id:'one',name:'Lan updated'});
        expect(login).toHaveBeenCalledTimes(1);
        expect(change).toHaveBeenCalledTimes(2);
        expect(auth.user()?.name).toBe('Lan updated');
        auth.logout(); auth.logout();
        expect(logout).toHaveBeenCalledTimes(1);
        expect(auth.user()).toBeNull(); expect(auth.id()).toBeNull();
        off(); auth.login({id:'two'});
        expect(change).toHaveBeenCalledTimes(3);
    });

    it('preserves early subscribers while restoring the boot user silently', () => {
        const application=new Application(); const helper=new HelperService(application);
        const early=helper.auth(); const login=vi.fn(); const logout=vi.fn();
        early.on('login',login); early.on('logout',logout);
        application.set('SharedData',{auth:snapshot({id:'restored'})});
        new CoreServiceProvider(application).register();
        expect(helper.auth()).toBe(early); expect(early.id()).toBe('restored');
        expect(login).not.toHaveBeenCalled();
        early.logout(); expect(logout).toHaveBeenCalledTimes(1);
        application.flush();
    });

    it('reports an account switch in logout/login/change order', () => {
        const auth=new AuthService({id:'first'}); const events:string[]=[];
        auth.subscribe(()=>events.push('change'));
        auth.on('login',()=>events.push('login'));
        auth.on('logout',()=>events.push('logout'));
        auth.login({id:'second'});
        expect(events).toEqual(['logout','login','change']);
        expect(auth.id()).toBe('second');
    });

    it('isolates guards and atomically replaces user data without keeping a previous account', () => {
        const auth=AuthService.fromSnapshot({...snapshot({id:'web'}),guards:{web:{user:{id:'web'}},admin:{user:{id:'staff'}}}});
        const admin=auth.guard('admin');
        const adminChanged=vi.fn(); admin.subscribe(adminChanged);
        auth.login({id:'other'});
        expect(admin.id()).toBe('staff'); expect(adminChanged).not.toHaveBeenCalled();
        auth.sync(snapshot(null));
        expect(auth.guest()).toBe(true); expect(admin.guest()).toBe(true);
        expect(adminChanged).toHaveBeenCalledTimes(1);
        auth.login({id:'keep'});
        expect(()=>auth.sync({...snapshot(),guards:{web:{user:{name:'invalid'}}}})).toThrow();
        expect(auth.id()).toBe('keep');
    });

    it('detaches subscribers and keeps a caller-owned object separate from auth state', () => {
        const user={id:1,name:'First'}; const auth=new AuthService(user); user.name='Changed';
        expect(auth.user()?.name).toBe('First');
        const callback=vi.fn(); auth.subscribe(callback); auth.destroy();
        auth.login({id:2}); expect(callback).not.toHaveBeenCalled();
    });

    it('consumes same-origin page snapshots and rejects a response older than explicit logout', async () => {
        const auth=AuthService.fromSnapshot(snapshot({id:'user'})); app.instance('Auth',auth);
        const http=new HttpService();
        vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{title:'Page'},auth:snapshot({id:'new-user'})}))));
        await http.get('/page'); expect(auth.id()).toBe('new-user');
        let respond!:(response:Response)=>void;
        vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{respond=resolve;})));
        const pending=http.get('/older-page'); auth.logout();
        respond(new Response(JSON.stringify({auth:snapshot({id:'stale-user'})})));
        await pending; expect(auth.guest()).toBe(true);
    });

    it('does not allow an external endpoint to replace application authentication', async () => {
        const auth=new AuthService({id:'local'}); app.instance('Auth',auth);
        vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({auth:snapshot({id:'external'})}))));
        await new HttpService().get('https://external.example.test/page');
        expect(auth.id()).toBe('local');
    });

    it('keeps a newly logged-in user when an older guest response arrives', async () => {
        const auth=new AuthService(); app.instance('Auth',auth);
        let respond!:(response:Response)=>void;
        vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{respond=resolve;})));
        const pending=new HttpService().get('/before-login');
        auth.login({id:'signed-in'});
        respond(new Response(JSON.stringify({auth:snapshot(null)})));
        await pending; expect(auth.id()).toBe('signed-in');
    });
});
