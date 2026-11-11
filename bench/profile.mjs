/** Self-time theo hàm của Saola khi tạo/thay dòng: node bench/profile.mjs [create|replace|swap|update] (swap/update: 10 lượt mỗi vòng) */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HERE, '../../saola/package.json'));
const esbuild = require('esbuild');
const { chromium } = require('playwright');
const op = process.argv[2] || 'create';
esbuild.buildSync({
    entryPoints: [path.join(HERE, 'entry.ts')], bundle: true, format: 'iife', minify: false,
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: { '@saolabs/client': path.resolve(HERE, '../index.ts') },
    outfile: path.join(HERE, '.cache/saola.dev.js'), logLevel: 'warning',
});
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ content: readFileSync(path.join(HERE, '.cache/saola.dev.js'), 'utf8') });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 50 });
await page.evaluate(() => { for (let i = 0; i < 5; i++) { fw.create(1000); fw.clear(); } });
await cdp.send('Profiler.start');
await page.evaluate((op) => {
    for (let i = 0; i < 40; i++) {
        if (op === 'replace') fw.replace(1000);
        else if (op === 'swap') { if (i === 0) fw.create(1000); for (let k = 0; k < 10; k++) fw.swap(); }
        else if (op === 'update') { if (i === 0) fw.create(1000); for (let k = 0; k < 10; k++) fw.update(); }
        else { fw.create(1000); fw.clear(); }
    }
}, op);
const { profile } = await cdp.send('Profiler.stop');
await browser.close();
const self = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n]));
const dt = profile.timeDeltas; let total = 0;
profile.samples.forEach((id, i) => {
    const n = byId.get(id), f = n.callFrame;
    const name = `${f.functionName || '(anon)'}:${f.lineNumber + 1}`;
    self.set(name, (self.get(name) || 0) + dt[i]); total += dt[i];
});
const rows = [...self].sort((a, b) => b[1] - a[1]).slice(0, 45);
console.log(`total ${(total / 1000).toFixed(0)} ms / 40 lượt`);
for (const [name, t] of rows) console.log((t / 1000 / 40).toFixed(2).padStart(7), 'ms ', (100 * t / total).toFixed(1).padStart(5) + '%', name);
