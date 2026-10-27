import { describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import { mergeBundles, loadBundles } from '../../src/core/bootstrap/bundle';
import { Application } from '../../src/core/app/Application';
import { buildDefaultProviders } from '../../src/core/bootstrap/providers/default-providers';
import { app } from '../../src/core/helpers/app';

const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('mergeBundles strict', () => {
    it('mặc định giữ hành vi cũ: trùng khoá thì sau đè, không báo', () => {
        const m = mergeBundles([{ name: 'a', services: { S: 1 } }, { name: 'b', services: { S: 2 } }]);
        expect(m.services.S).toBe(2);
        expect(m.failed).toEqual([]);
    });

    it('strict: trùng khoá không có overrides → bỏ cả bundle sau, báo tên hai bên', () => {
        const spy = quiet();
        const m = mergeBundles([{ name: 'a', services: { S: 1 } }, { name: 'b', services: { S: 2, T: 3 } }], { strict: true });
        spy.mockRestore();
        expect(m.services).toEqual({ S: 1 });
        expect(m.loaded).toEqual(['a']);
        expect(m.failed[0][0]).toBe('b');
        expect(m.failed[0][1]).toMatch(/"S".*"a".*"b"/);
    });

    it('strict: overrides hợp lệ thắng, kể cả qua tiền tố overridable', () => {
        const m = mergeBundles([
            { name: 'a', services: { 'Admin.Presentation.Card': 1 } },
            { name: 'proj', overrides: ['Admin.Presentation.Card'], services: { 'Admin.Presentation.Card': 2 } },
        ], { strict: true, overridable: ['Admin.Presentation'] });
        expect(m.services['Admin.Presentation.Card']).toBe(2);
        expect(m.failed).toEqual([]);
    });

    it('strict: overrides ngoài overridable bị từ chối', () => {
        const spy = quiet();
        const m = mergeBundles([
            { name: 'a', services: { Resources: 1 } },
            { name: 'proj', overrides: ['Resources'], services: { Resources: 2 } },
        ], { strict: true, overridable: ['Admin.Presentation'] });
        spy.mockRestore();
        expect(m.services.Resources).toBe(1);
        expect(m.failed).toHaveLength(1);
    });

    it('strict: view trùng giữa hai gói cũng là lỗi', () => {
        const spy = quiet();
        const m = mergeBundles([{ name: 'a', views: { v: () => 1 } }, { name: 'b', views: { v: () => 2 } }], { strict: true });
        spy.mockRestore();
        expect((m.views.v as () => number)()).toBe(1);
        expect(m.failed).toHaveLength(1);
    });

    it('strict: provider trùng name chỉ nhận một lần', () => {
        const m = mergeBundles([
            { name: 'a', providers: [{ name: 'p', register() {} }] },
            { name: 'b', providers: [{ name: 'p', register() {} }, { name: 'q', register() {} }] },
        ], { strict: true });
        expect(m.providers.map((p: any) => p.name)).toEqual(['p', 'q']);
        expect(m.failed).toHaveLength(1);
    });

    it('strict: theme khai khoá ngoài namespace trình bày bị bỏ, khoá trong namespace thì nhận', () => {
        const spy = quiet();
        const m = mergeBundles([
            { name: 'ok', kind: 'theme', views: { 'admin.x.v': () => 1 }, services: { 'Admin.Presentation.Card': 1 } },
            { name: 'xấu', kind: 'theme', services: { Resources: 9 } },
            { name: 'prov', kind: 'theme', providers: [{ name: 'z', register() {} }] },
        ], { strict: true, themeNamespaces: ['Admin.Presentation'] });
        spy.mockRestore();
        expect(m.loaded).toEqual(['ok']);
        expect(m.services.Resources).toBeUndefined();
        expect(m.failed.map(f => f[0])).toEqual(['xấu', 'prov']);
    });

    it('opts.kind ép theme dù bundle không tự khai', () => {
        const spy = quiet();
        const m = mergeBundles([{ name: 'giả', services: { Resources: 9 } }], { strict: true, kind: 'theme' });
        spy.mockRestore();
        expect(m.loaded).toEqual([]);
    });
});

describe('service factory & khoá hệ thống', () => {
    it('{ factory } được gọi với app, mỗi lần dựng ra instance riêng', () => {
        const App = app<any>();
        const providers = buildDefaultProviders({ services: { FacTest: { factory: () => ({ n: Math.random() }) } } });
        const prov = providers.find(p => p.name === 'FacTest')!;
        prov.register();
        const first = App.FacTest;
        prov.register();
        expect(first).toBeTruthy();
        expect(App.FacTest).not.toBe(first); // dựng lại → instance mới, không dùng chung
    });

    it('strict: service trùng khoá hệ thống ném lỗi; không strict thì chỉ warn', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(() => buildDefaultProviders({ services: { Http: {} } })).not.toThrow();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
        expect(() => buildDefaultProviders({ strictBundles: true, services: { Http: {} } })).toThrow(/Http/);
        app<any>().strictBundles = false;
    });

    it('strict: Application.set đè thuộc tính có sẵn ném lỗi, tắt thì bỏ qua im lặng', () => {
        const a = new Application();
        expect(() => a.set('make', 1)).not.toThrow();
        a.strictBundles = true;
        expect(() => a.set('make', 1)).toThrow(/make/);
    });
});

describe('trusted bundle URL classification', () => {
    const url = pathToFileURL(resolve('tests/bundle/fixtures/disguised-theme.js')).href;
    it('a theme cannot promote itself to package by declaring kind in its contents', async () => {
        const spy = quiet();
        try {
            const merged = await loadBundles([url], {strict: true, bundleKinds: {[url]: 'theme'}, themeNamespaces: ['Admin.Presentation']});
            expect(merged.services.Resources).toBeUndefined();
            expect(merged.failed).toHaveLength(1);
            expect(merged.failed[0][1]).toMatch(/ngoài namespace/);
        } finally { spy.mockRestore(); }
    });
    it('strict source mode rejects URLs missing trusted classification', async () => {
        const spy = quiet();
        try {
            const merged = await loadBundles([url], {strict: true, bundleKinds: {}});
            expect(merged.loaded).toEqual([]);
            expect(merged.failed[0]).toEqual([url, 'Missing trusted bundle kind from server']);
        } finally { spy.mockRestore(); }
    });
    it('the same source can be loaded as a package when the server classifies it that way', async () => {
        const merged = await loadBundles([url], {strict: true, bundleKinds: {[url]: 'package'}});
        expect(merged.services.Resources).toEqual({replaced: true});
        expect(merged.failed).toEqual([]);
    });
    it('source services cannot be replaced by a remote package without an allowed override', async () => {
        const spy = quiet();
        try {
            const merged = await loadBundles([url], {strict: true, bundleKinds: {[url]: 'package'}, initialBundle: {name: 'source', services: {Resources: {original: true}}}});
            expect(merged.services.Resources).toEqual({original: true});
            expect(merged.failed[0][1]).toMatch(/source.*disguised-theme/);
        } finally { spy.mockRestore(); }
    });
    it('source providers are retained once even when there are no external URLs', async () => {
        const provider = {name: 'source-provider', register() {}};
        const merged = await loadBundles([], {strict: true, initialBundle: {providers: [provider]}});
        expect(merged.providers).toEqual([provider]);
    });
});

describe('kiểu của namespace gói', () => {
    it('App.Admin có kiểu: phương thức sai / tham số sai lỗi biên dịch', () => {
        execFileSync('npx', ['tsc', '-p', 'tests/bundle/types/tsconfig.json'], { stdio: 'pipe' });
    }, 60000);
});
