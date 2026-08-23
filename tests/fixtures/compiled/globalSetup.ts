/**
 * globalSetup — compile các `.sao` nguồn trong `src/` bằng ĐÚNG pipeline thật
 * của `compiler/` TRƯỚC khi bất kỳ test nào chạy.
 *
 * Đây là điểm khác biệt cốt lõi so với các test "contract" cũ: fixture ở đây
 * là OUTPUT COMPILER THẬT, không phải chuỗi chép tay mô phỏng pattern của nó.
 * Xem docs/FIX_PLAN_2026-08-14.md §F5 — lý do và hệ quả của việc chép tay
 * trước đây (test xanh nhưng compiler sinh code sai vẫn lọt qua).
 *
 * PIPELINE (bám theo `compiler/test-compile.js` — đường mà app thật dùng):
 *   .sao → Compiler.parseSaoFile() → Preprocessor.preprocess() → 2 CLI Python
 *
 * Bước Preprocessor KHÔNG được bỏ qua: nó chuyển cú pháp JS của `.sao` sang
 * cú pháp PHP cho nhánh Blade (`a` → `$a`) VÀ biến đổi ngữ nghĩa cho CẢ HAI
 * nhánh (đo được: `{{ items.length }}` → `App.Helper.count(items)`). Gọi
 * thẳng CLI trên `.sao` thô sinh ra output KHÁC production — và với nhánh
 * Blade là PHP KHÔNG HỢP LỆ (`@attr(['href' => a])`, `{{c}}` → hằng số
 * không xác định). Bỏ qua bước này chính là tái lập đúng lỗi mà F5 sinh ra
 * để loại bỏ: fixture "gần giống" thay vì fixture thật.
 *
 * Chạy MỘT LẦN cho cả run (không phải mỗi test file) — tránh N lần gọi
 * Python song song ghi đè cùng thư mục output.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(HERE, 'src');
const GEN_DIR = path.join(HERE, '.generated');
const OUT_JS_DIR = path.join(GEN_DIR, 'js');
const OUT_BLADE_DIR = path.join(GEN_DIR, 'blade');
const TMP_DIR = path.join(GEN_DIR, 'tmp');

// client/tests/fixtures/compiled/ → ../../../../compiler
const COMPILER_ROOT = path.resolve(HERE, '../../../../compiler');
const JS_CLI = path.join(COMPILER_ROOT, 'src', 'sao2js', 'cli.py');
const BLADE_CLI = path.join(COMPILER_ROOT, 'src', 'sao2blade', 'cli.py');

/** snake/kebab-case filename → PascalCase view/function name. */
function pascalCase(name: string): string {
    return name
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join('');
}

function findPython(): string | null {
    for (const bin of ['python3', 'python']) {
        try {
            execFileSync(bin, ['--version'], { stdio: 'ignore' });
            return bin;
        } catch {
            // thử binary kế tiếp
        }
    }
    return null;
}

export default function setup() {
    // .generated/ không commit — dọn sạch để không lẫn output của lần chạy trước
    // (đổi tên/xoá .sao phải phản ánh đúng, không giữ file mồ côi).
    rmSync(GEN_DIR, { recursive: true, force: true });
    mkdirSync(OUT_JS_DIR, { recursive: true });
    mkdirSync(OUT_BLADE_DIR, { recursive: true });
    mkdirSync(TMP_DIR, { recursive: true });

    const python = findPython();
    if (!python) {
        console.warn(
            '\n[fixtures] KHÔNG tìm thấy python3/python trên PATH — BỎ QUA compile ' +
            'fixture thật. Các test dùng tests/fixtures/compiled/.generated sẽ tự ' +
            'skip (có cảnh báo riêng từng file), KHÔNG được coi là pass.\n'
        );
        return;
    }

    // Compiler + Preprocessor là CommonJS trong compiler/ — nạp qua createRequire.
    const require = createRequire(import.meta.url);
    let Compiler: any;
    let Preprocessor: any;
    try {
        Compiler = require(path.join(COMPILER_ROOT, 'src', 'index.js'));
        Preprocessor = require(path.join(COMPILER_ROOT, 'src', 'preprocessor'));
    } catch (err) {
        console.warn(
            `\n[fixtures] KHÔNG nạp được compiler Node API (${(err as Error).message}) — ` +
            'BỎ QUA compile fixture. Test liên quan sẽ tự skip, KHÔNG được coi là pass.\n'
        );
        return;
    }

    const compiler = new Compiler();
    const preprocessor = new Preprocessor();

    if (!existsSync(SRC_DIR)) return;
    const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.sao'));

    for (const file of files) {
        const name = file.replace(/\.sao$/, '');
        const fnName = pascalCase(name);
        const viewPath = `fixtures.${name}`;
        const saoPath = path.join(SRC_DIR, file);

        const parts = compiler.parseSaoFile(readFileSync(saoPath, 'utf-8'), saoPath);
        const bp = preprocessor.preprocess(parts);

        const decl = bp.declarations?.length ? bp.declarations.join('\n') + '\n\n' : '';
        const wrap = (body: string) =>
            parts.wrapperType ? `<${parts.wrapperType}>\n${body}\n</${parts.wrapperType}>` : body;

        // Nhánh Blade dùng bladeWithSSR (có nội dung SSR inline); nhánh JS dùng
        // bp.blade + các thẻ script/style thô (sao2js cần chúng để lấy metadata:
        // <script setup>, <style scoped>, <link rel=stylesheet>).
        const bladeSource = decl + wrap(bp.bladeWithSSR || bp.blade);
        const scriptTags = parts.cleanedContent.match(/<script[^>]*>[\s\S]*?<\/script>/gi) ?? [];
        const styleTags = parts.cleanedContent.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];
        const linkTags = parts.cleanedContent.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) ?? [];
        const assetTags = [...scriptTags, ...styleTags, ...linkTags];
        const jsSource =
            decl + (assetTags.length ? assetTags.join('\n') + '\n\n' : '') + wrap(bp.blade);

        const tmpBlade = path.join(TMP_DIR, `${name}.blade.sao`);
        const tmpJs = path.join(TMP_DIR, `${name}.js.sao`);
        writeFileSync(tmpBlade, bladeSource);
        writeFileSync(tmpJs, jsSource);

        const outJs = path.join(OUT_JS_DIR, `${name}.js`);
        execFileSync(python, [JS_CLI, tmpJs, outJs, fnName, viewPath], { stdio: 'inherit' });
        if (!existsSync(outJs)) {
            throw new Error(`[fixtures] sao2js không sinh được ${outJs} từ ${file}`);
        }

        const outBlade = path.join(OUT_BLADE_DIR, `${name}.blade.php`);
        execFileSync(python, [BLADE_CLI, tmpBlade, outBlade, fnName, viewPath], { stdio: 'inherit' });
        if (!existsSync(outBlade)) {
            throw new Error(`[fixtures] sao2blade không sinh được ${outBlade} từ ${file}`);
        }
    }

    console.log(`[fixtures] đã compile ${files.length} file .sao qua pipeline thật → .generated/{js,blade}`);
}
