import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/core/helpers/app';
import { defineBundle, mergeBundles } from '../../src/core/bootstrap/bundle';
import { Application } from '../../src/core/app/Application';
import type { ServiceProviderInterface } from '../../src/core/contracts/ServiceProviderInterface';

describe('hợp đồng bundle', () => {
    it('gộp theo ĐÚNG thứ tự mảng — bundle sau đè bundle trước', () => {
        const a = defineBundle({
            name: 'a',
            views: { 'x': () => 'từ-a', 'chỉ-a': () => 'a' },
            services: { S: 'a' },
            helpers: { h: () => 'a' },
        });
        const b = defineBundle({ name: 'b', views: { 'x': () => 'từ-b' }, services: { S: 'b' } });

        const m = mergeBundles([a, b]);

        expect(m.loaded).toEqual(['a', 'b']);
        expect((m.views['x'] as () => string)()).toBe('từ-b');   // sau đè trước
        expect(m.views['chỉ-a']).toBeDefined();                   // không mất khoá cũ
        expect(m.services.S).toBe('b');
        expect(m.helpers.h).toBeDefined();
    });

    it('providers CỘNG THÊM chứ không thay — bundle không gỡ được provider của app', () => {
        const p1 = { name: 'p1', register() {} };
        const p2 = { name: 'p2', register() {} };
        const m = mergeBundles([{ providers: [p1] }, { providers: [p2] }]);
        expect(m.providers).toEqual([p1, p2]);
    });

    it('bundle rỗng / null không làm hỏng merge', () => {
        const m = mergeBundles([null, undefined, {}, { name: 'ok', views: { v: () => 1 } }]);
        expect(m.loaded).toEqual(['(không tên)', 'ok']);
        expect(Object.keys(m.views)).toEqual(['v']);
    });

    it('boot() của bundle chạy, lỗi một cái không chặn cái sau', async () => {
        const { bootBundles } = await import('../../src/core/bootstrap/bundle');
        const order: string[] = [];
        const m = mergeBundles([
            { name: 'nổ', boot() { order.push('nổ'); throw new Error('x'); } },
            { name: 'sau', boot() { order.push('sau'); } },
        ]);
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        bootBundles(m, app());
        spy.mockRestore();
        expect(order).toEqual(['nổ', 'sau']);
    });
});

describe('provider đăng ký sau khi app đã boot', () => {
    let container: Application;
    beforeEach(() => { container = new Application(); });

    it('vẫn chạy CẢ register() lẫn boot()', () => {
        container.boot();                       // app đã boot xong
        const ran: string[] = [];
        const late: ServiceProviderInterface = {
            name: 'muộn',
            register() { ran.push('register'); },
            boot() { ran.push('boot'); },
        };

        container.register(late);

        // Trước khi sửa: chỉ có 'register' — provider mất nửa vòng đời, không lỗi nào.
        expect(ran).toEqual(['register', 'boot']);
    });

    it('đăng ký TRƯỚC boot vẫn chỉ boot một lần', () => {
        const ran: string[] = [];
        container.register({ name: 'sớm', register() { ran.push('r'); }, boot() { ran.push('b'); } });
        container.boot();
        container.boot();                       // gọi lại không được boot thêm
        expect(ran).toEqual(['r', 'b']);
    });
});
