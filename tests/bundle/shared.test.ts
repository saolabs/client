import { afterEach, describe, expect, it } from 'vitest';
import { Application } from '../../src/core/app/Application';
import { readBootConfig } from '../../src/core/bootstrap/ssr';

// Kênh `Saola::share()` (PHP) → APP_CONFIGS.shared → App.shared(): helper JS
// của package đọc dữ liệu theo request mà không tự chạm vào window.
describe('App.shared', () => {
    afterEach(() => { delete (window as any).APP_CONFIGS; });

    it('readBootConfig chuyển nguyên khối shared, bỏ giá trị không phải object', () => {
        (window as any).APP_CONFIGS = { shared: { permission: { routes: ['a'] } } };
        expect(readBootConfig()?.shared).toEqual({ permission: { routes: ['a'] } });

        (window as any).APP_CONFIGS = { shared: ['x'] };
        expect(readBootConfig()?.shared).toBeUndefined();
    });

    it('đọc theo khoá, trả fallback khi thiếu, và set() không đè được method', () => {
        const app = new Application();
        expect(app.shared('permission', 'none')).toBe('none');

        app.set('SharedData', { permission: { routes: ['admin.roles.index'] } });
        expect(app.shared<{ routes: string[] }>('permission').routes).toEqual(['admin.roles.index']);
        expect(app.shared()).toEqual({ permission: { routes: ['admin.roles.index'] } });

        app.set('shared', 'đè');
        expect(typeof app.shared).toBe('function');
    });
});
