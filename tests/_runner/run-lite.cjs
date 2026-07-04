#!/usr/bin/env node
/**
 * Runner nhẹ thay vitest cho môi trường offline.
 *   node tests/_runner/run-lite.cjs            — chạy toàn bộ .test-build/tests
 * Yêu cầu: đã compile bằng `npx tsc -p tests/_runner/tsconfig.test.json`
 * và jsdom resolve được (NODE_PATH nếu cần).
 */
const path = require('path');
const fs = require('fs');
const Module = require('module');

// ── Alias 'vitest' → shim ────────────────────────────────────
const shimPath = path.join(__dirname, 'vitest-shim.cjs');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
    if (request === 'vitest') return shimPath;
    return origResolve.call(this, request, ...args);
};

// ── jsdom globals ────────────────────────────────────────────
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
});
const w = dom.window;
global.window = w;
global.document = w.document;
for (const key of [
    'Node', 'NodeFilter', 'Comment', 'Text', 'Element', 'HTMLElement', 'DocumentFragment',
    'Event', 'MouseEvent', 'KeyboardEvent', 'CustomEvent', 'InputEvent',
    'navigator', 'location', 'history', 'performance', 'Range',
    'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
    'MutationObserver', 'AbortController', 'TreeWalker',
]) {
    if (!(key in global) && key in w) global[key] = w[key];
}
// Node có AbortController riêng nhưng jsdom addEventListener đòi AbortSignal CỦA jsdom
global.AbortController = w.AbortController;
global.AbortSignal = w.AbortSignal;

// ── Load compiled tests ──────────────────────────────────────
const shim = require(shimPath);
const reg = shim.__registry;
const buildDir = path.join(__dirname, '..', '..', '.test-build', 'tests');

function collectTestFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...collectTestFiles(full));
        else if (entry.name.endsWith('.test.js')) out.push(full);
    }
    return out;
}

const files = collectTestFiles(buildDir);
if (files.length === 0) {
    console.error(`Không tìm thấy test đã compile trong ${buildDir}. Chạy: npx tsc -p tests/_runner/tsconfig.test.json`);
    process.exit(2);
}
for (const f of files) {
    reg.currentFile = f;
    require(f);
}

// ── Run ──────────────────────────────────────────────────────
(async () => {
    let pass = 0, fail = 0, skip = 0;
    const failures = [];

    for (const t of reg.tests) {
        if (t.skipped) { skip++; console.log(`  ⏭  ${t.name}`); continue; }
        const before = reg.beforeEach.filter((h) => h.file === t.file);
        const after = reg.afterEach.filter((h) => h.file === t.file);
        try {
            for (const h of before) await h.fn();
            await t.fn();
            pass++;
            console.log(`  ✅ ${t.name}`);
        } catch (e) {
            fail++;
            failures.push({ name: t.name, file: path.relative(process.cwd(), t.file), error: e });
            console.log(`  ❌ ${t.name}`);
            console.log(`       ${String(e && e.message ? e.message : e).split('\n')[0]}`);
        } finally {
            for (const h of after) {
                try { await h.fn(); } catch (e) { console.log(`       (afterEach error: ${e.message})`); }
            }
        }
    }

    console.log(`\n══════════════════════════════════════`);
    console.log(`  ${pass} passed, ${fail} failed${skip ? `, ${skip} skipped` : ''} / ${reg.tests.length} total`);
    if (failures.length) {
        console.log(`\n  Failed:`);
        for (const f of failures) console.log(`   - ${f.name}`);
    }
    process.exit(fail > 0 ? 1 : 0);
})();
