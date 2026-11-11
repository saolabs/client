/**
 * Benchmark bảng 1000 dòng: Saola (client trong repo này + compiler bên cạnh)
 * so với React và Vue bản production, trên Chrome thật.
 *
 *   node bench/run.mjs            # bảng tổng (script + layout), median
 *   node bench/run.mjs --split    # tách riêng script và layout
 *   BENCH_VIEW=/đường/dẫn/view.sao node bench/run.mjs   # đo một biến thể của view
 *   BENCH_ONLY=saola node bench/run.mjs                 # chỉ đo một bên (lặp nhanh)
 *
 * Cùng một thao tác, cùng dữ liệu, cùng cấu trúc DOM ở cả ba bên (xem table.sao,
 * react.js, vue.js). Số đo là từ lúc gọi tới khi layout xong (`offsetHeight`),
 * KHÔNG gồm paint. Chạy vài lần — sai số giữa các lượt cỡ ±10%.
 *
 * esbuild và Playwright mượn từ `../saola/node_modules`; React/Vue tải về
 * `bench/.cache` ở lượt chạy đầu.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CACHE = path.join(HERE, '.cache');
const require = createRequire(path.resolve(ROOT, '../saola/package.json'));
const esbuild = require('esbuild');
const { chromium } = require('playwright');
const SPLIT = process.argv.includes('--split');
const RUNS = Number(process.env.RUNS || 12), WARM = 4;

mkdirSync(CACHE, { recursive: true });

// 1. Biên dịch view bằng compiler THẬT rồi bundle cùng client trong repo.
const compiled = JSON.parse(execFileSync('php', [
    path.resolve(ROOT, '../compiler/bin/saoc'), 'compile', process.env.BENCH_VIEW || path.join(HERE, 'table.sao'),
    '--view-path=bench.table', '--fn=BenchTable', '--factory=BenchTable', '--json',
], { encoding: 'utf8' }));
writeFileSync(path.join(CACHE, 'table.view.js'), compiled.js);
esbuild.buildSync({
    entryPoints: [path.join(HERE, 'entry.ts')], bundle: true, format: 'iife', minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: { '@saolabs/client': path.join(ROOT, 'index.ts') },
    outfile: path.join(CACHE, 'saola.js'), logLevel: 'warning',
});

// 2. React / Vue production.
const libs = {
    'react.production.min.js': 'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
    'react-dom.production.min.js': 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
    'vue.global.prod.js': 'https://unpkg.com/vue@3.5.13/dist/vue.global.prod.js',
};
for (const [file, url] of Object.entries(libs)) {
    const target = path.join(CACHE, file);
    if (!existsSync(target)) writeFileSync(target, Buffer.from(await (await fetch(url)).arrayBuffer()));
}
const targets = [
    { label: 'saola', files: [path.join(CACHE, 'saola.js')] },
    { label: 'react 18.3', files: [path.join(CACHE, 'react.production.min.js'), path.join(CACHE, 'react-dom.production.min.js'), path.join(HERE, 'react.js')] },
    { label: 'vue 3.5', files: [path.join(CACHE, 'vue.global.prod.js'), path.join(HERE, 'vue.js')] },
].filter(target => !process.env.BENCH_ONLY || target.label.startsWith(process.env.BENCH_ONLY));

// 3. Đo.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};
for (const target of targets) {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error(`[${target.label}]`, error.message));
    await page.setContent('<!doctype html><html><body></body></html>');
    for (const file of target.files) await page.addScriptTag({ content: readFileSync(file, 'utf8') });
    results[target.label] = await page.evaluate(async ({ RUNS, WARM, SPLIT }) => {
        const fw = window.fw;
        const idle = () => new Promise(resolve => setTimeout(resolve, 30));
        const samples = {};
        const measure = async (name, keep, run) => {
            await idle();
            const t0 = performance.now(); await run(); const t1 = performance.now();
            void document.body.offsetHeight; const t2 = performance.now();
            if (keep) (samples[name] ||= []).push([t1 - t0, t2 - t1]);
        };
        const expect = (ok, what) => { if (!ok) throw new Error(`${fw.name}: ${what}`); };
        for (let i = 0; i < RUNS + WARM; i++) {
            const keep = i >= WARM;
            await fw.clear();
            await measure('tạo 1.000 dòng', keep, () => fw.create(1000)); expect(fw.count() === 1000, 'create');
            await measure('sửa mỗi dòng thứ 10', keep, () => fw.update());
            await measure('chọn 1 dòng', keep, () => fw.select()); expect(document.querySelector('tr.danger'), 'select');
            await measure('đổi chỗ 2 dòng', keep, () => fw.swap());
            await measure('xoá 1 dòng', keep, () => fw.remove()); expect(fw.count() === 999, 'remove');
            await measure('thêm 1.000 dòng', keep, () => fw.append(1000));
            await measure('thay 2.000 dòng', keep, () => fw.replace(2000));
            await measure('xoá sạch 2.000 dòng', keep, () => fw.clear()); expect(fw.count() === 0, 'clear');
        }
        for (let i = 0; i < 4; i++) { await fw.clear(); await measure('tạo 10.000 dòng', i >= 1, () => fw.create(10000)); }
        await fw.clear();
        const median = values => values.slice().sort((a, b) => a - b)[values.length >> 1];
        return Object.fromEntries(Object.entries(samples).map(([name, rows]) => {
            const script = median(rows.map(row => row[0])), layout = median(rows.map(row => row[1]));
            return [name, SPLIT ? `${script.toFixed(1)} + ${layout.toFixed(1)}` : median(rows.map(row => row[0] + row[1])).toFixed(1)];
        }));
    }, { RUNS, WARM, SPLIT });
    await page.close();
}
await browser.close();

const pad = (value, width) => String(value).padEnd(width);
console.log(pad(SPLIT ? 'ms (script + layout)' : 'ms (median)', 24) + targets.map(target => pad(target.label, 16)).join(''));
for (const name of Object.keys(results[targets[0].label])) {
    console.log(pad(name, 24) + targets.map(target => pad(results[target.label][name], 16)).join(''));
}
