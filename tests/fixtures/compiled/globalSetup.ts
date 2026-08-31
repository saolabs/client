/**
 * globalSetup — compile các `.sao` nguồn trong `src/` bằng ĐÚNG pipeline thật
 * của `@saolabs/builder` + `saola/compiler` TRƯỚC khi bất kỳ test nào chạy.
 *
 * Đây là điểm khác biệt cốt lõi so với các test "contract" cũ: fixture ở đây
 * là OUTPUT COMPILER THẬT, không phải chuỗi chép tay mô phỏng pattern của nó.
 * Xem docs/FIX_PLAN_2026-08-14.md §F5 — lý do và hệ quả của việc chép tay
 * trước đây (test xanh nhưng compiler sinh code sai vẫn lọt qua).
 *
 * PIPELINE: `.sao` → Builder transport → `vendor/bin/saoc` → Blade + JS/TS.
 * Đây cũng là đường production; fixture không tự ráp input và không dùng
 * compiler Python làm lối tắt.
 *
 * Chạy MỘT LẦN cho cả run (không phải mỗi test file).
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(HERE, 'src');
const GEN_DIR = path.join(HERE, '.generated');
const OUT_JS_DIR = path.join(GEN_DIR, 'js');
const OUT_BLADE_DIR = path.join(GEN_DIR, 'blade');
// client/tests/fixtures/compiled/ → ../../../../builder
const BUILDER_ROOT = path.resolve(HERE, '../../../../builder');
const SAOLA_APP_ROOT = path.resolve(HERE, '../../../../saola');

/** snake/kebab-case filename → PascalCase view/function name. */
function pascalCase(name: string): string {
    return name
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join('');
}

export default async function setup() {
    // .generated/ không commit — dọn sạch để không lẫn output của lần chạy trước
    // (đổi tên/xoá .sao phải phản ánh đúng, không giữ file mồ côi).
    rmSync(GEN_DIR, { recursive: true, force: true });
    mkdirSync(OUT_JS_DIR, { recursive: true });
    mkdirSync(OUT_BLADE_DIR, { recursive: true });

    // Builder là CommonJS — nạp qua createRequire từ test TypeScript ESM.
    const require = createRequire(import.meta.url);
    let Builder: any;
    try {
        Builder = require(path.join(BUILDER_ROOT, 'src', 'index.js'));
    } catch (err) {
        console.warn(
            `\n[fixtures] KHÔNG nạp được builder Node API (${(err as Error).message}) — ` +
            'BỎ QUA compile fixture. Test liên quan sẽ tự skip, KHÔNG được coi là pass.\n'
        );
        return;
    }

    const builder = new Builder();
    builder.projectRoot = SAOLA_APP_ROOT;

    if (!existsSync(SRC_DIR)) return;
    const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.sao'));

    for (const file of files) {
        const name = file.replace(/\.sao$/, '');
        const fnName = pascalCase(name);
        const viewPath = `fixtures.${name}`;
        const saoPath = path.join(SRC_DIR, file);

        const source = readFileSync(saoPath, 'utf-8');
        const langMatch = source.match(/<script\s+setup\b[^>]*\blang=["']?([^"'\s>]+)["']?/i);
        const lang = langMatch && ['ts', 'typescript'].includes(langMatch[1].toLowerCase()) ? 'ts' : 'js';
        const result = await builder.compileWithPhp(source, {
            viewPath,
            functionName: fnName,
            factoryName: fnName,
            emit: 'both',
            lang,
            idMode: 'terse',
        });

        const outJs = path.join(OUT_JS_DIR, `${name}.${lang}`);
        writeFileSync(outJs, result.js, 'utf-8');

        const outBlade = path.join(OUT_BLADE_DIR, `${name}.blade.php`);
        writeFileSync(outBlade, result.blade, 'utf-8');
    }

    console.log(`[fixtures] đã compile ${files.length} file .sao qua Builder + saola/compiler → .generated/{js,blade}`);
}
