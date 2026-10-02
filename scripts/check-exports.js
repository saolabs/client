#!/usr/bin/env node
/** Test the packed package in an isolated consumer, without Vitest aliases. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'saola-consumer-'));
const run = (cmd, args, cwd = temp) => execFileSync(cmd, args, {
    cwd, timeout: 30000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, npm_config_cache: path.join(temp, 'npm-cache'), npm_config_update_notifier: 'false', npm_config_offline: 'true' },
});

try {
    const packed = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temp], root));
    const packageDir = path.join(temp, 'node_modules', ...pkg.name.split('/'));
    fs.mkdirSync(packageDir, { recursive: true });
    run('tar', ['-xzf', path.join(temp, packed[0].filename), '-C', packageDir, '--strip-components=1']);
    const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    for (const [name, entry] of Object.entries(manifest.exports)) {
        for (const target of Object.values(entry)) {
            assert.ok(fs.statSync(path.join(packageDir, target)).isFile(), `${name}: missing ${target}`);
        }
    }

    // The client is a browser runtime; provide a DOM without resolving it through Vite.
    const require = createRequire(import.meta.url);
    fs.writeFileSync(path.join(temp, 'dom.cjs'), `
        const { JSDOM } = require(${JSON.stringify(require.resolve('jsdom'))});
        const dom = new JSDOM('<!doctype html><html><body></body></html>', {url: 'http://localhost/'});
        for (const key of ['window', 'document', 'Element', 'HTMLElement', 'Node', 'NodeFilter',
            'Comment', 'Text', 'DocumentFragment', 'Event', 'CustomEvent', 'MutationObserver',
            'AbortController', 'AbortSignal', 'getComputedStyle']) {
            globalThis[key] = key === 'window' ? dom.window : dom.window[key];
        }
    `);

    // Import by package name, with the exact exports and bytes delivered to users.
    fs.writeFileSync(path.join(temp, 'consumer.mjs'), `
        import assert from 'node:assert/strict';
        import { View, HttpService, StateManager } from '@saolabs/client';
        import { createPlugin } from '@saolabs/client/plugins';
        import { mount, mountView, nextFrame } from '@saolabs/client/testing';
        assert.equal(typeof View, 'function');
        assert.equal(typeof new HttpService().get, 'function');
        assert.equal(typeof StateManager, 'function');
        assert.equal(createPlugin('example', () => {}).name, 'example');
        assert.equal(typeof mount, 'function');
        assert.equal(typeof nextFrame, 'function');
        const harness = mountView(function () { return this.wrapper(() => [this.text('packed')]); });
        assert.ok(harness.view instanceof View);
        assert.equal(harness.text(), 'packed');
        harness.destroy();
        // Browser services own timers; this subprocess tests loading and mounting.
        process.exit(0);
    `);
    run(process.execPath, ['--require', './dom.cjs', 'consumer.mjs']);
    // CommonJS consumers can use the standard asynchronous ESM boundary.
    fs.writeFileSync(path.join(temp, 'consumer.cjs'), `
        const assert = require('node:assert/strict');
        import('@saolabs/client').then(m => { assert.equal(typeof m.View, 'function'); process.exit(0); })
            .catch(error => { console.error(error); process.exit(1); });
    `);
    run(process.execPath, ['--require', './dom.cjs', 'consumer.cjs']);

    fs.writeFileSync(path.join(temp, 'consumer.mts'), `
        import { HttpService, type HttpResponse } from '@saolabs/client';
        import { createPlugin } from '@saolabs/client/plugins';
        import { mount, type Harness } from '@saolabs/client/testing';
        const result: Promise<HttpResponse<{name: string}>> = new HttpService().get('/users');
        createPlugin('typed', () => {});
        const mountView: typeof mount = mount;
        let harness: Harness | undefined;
        // @ts-expect-error URL must be a string; published declarations must keep this check.
        new HttpService().get(42);
    `);
    run(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'),
        '--noEmit', '--strict', '--skipLibCheck', '--module', 'NodeNext', '--target', 'ES2020', 'consumer.mts']);
    console.log('Packed consumer passed: all 3 exports, native ESM, CJS dynamic import, strict NodeNext types.');
} catch (error) {
    console.error(error.stderr?.toString() || error.stdout?.toString() || error);
    process.exitCode = 1;
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
