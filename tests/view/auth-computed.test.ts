import {afterEach, expect, it, vi} from 'vitest';
import {View} from '../../src/core/view/View';
import {AuthService} from '../../src/core/services/AuthService';

let manager: any;
afterEach(() => { manager?.destroy(); vi.restoreAllMocks(); });
const setup = () => manager = new View('test.auth', 'view').__ctrl__.states.__;

it('tracks auth reads hidden inside helpers and invalidates computed chains immediately', () => {
    const auth = new AuthService();
    const m = setup();
    const helper = vi.fn(() => auth.user());
    const user = m.computed('user', helper);
    const name = m.computed('name', () => user()?.name ?? 'Guest', ['user']);
    expect(name()).toBe('Guest');
    expect(name()).toBe('Guest');
    expect(helper).toHaveBeenCalledTimes(1);
    auth.login({id: 1, name: 'Lan'});
    expect(name()).toBe('Lan');
    auth.setUser({id: 1, name: 'Mai'});
    expect(name()).toBe('Mai');
    auth.logout();
    expect(name()).toBe('Guest');
});

it('reconciles conditional guard subscriptions and releases them on replacement and destroy', () => {
    const auth = new AuthService({id: 1});
    const admin = auth.guard('admin');
    const m = setup();
    m.useState(false, 'admin');
    const spy = vi.fn(() => m.getStateByKey('admin') ? admin.id() : auth.id());
    const value = m.computed('id', spy, ['admin']);
    expect(value()).toBe(1);
    m.updateStateByKey('admin', true);
    expect(value()).toBeNull();
    auth.login({id: 2});
    expect(value()).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
    admin.login({id: 3});
    expect(value()).toBe(3);
    m.pause();
    admin.login({id: 4});
    expect(value()).toBe(4);
    const listener = vi.fn();
    m.subscribe('id', listener);
    m.resume();
    expect(listener).toHaveBeenCalled();
    const replaced = vi.fn(() => 'static');
    m.computed('id', replaced);
    expect(value()).toBe('static');
    admin.logout();
    expect(value()).toBe('static');
    expect(replaced).toHaveBeenCalledTimes(1);
    m.destroy();
    expect((auth as any).context.listeners.size).toBe(0);
});
