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
import { execFileSync } from 'node:child_process';
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
        throw new Error(`Cannot load the compiler fixture builder: ${String(err)}`);
    }

    const builder = new Builder();
    builder.projectRoot = SAOLA_APP_ROOT;

    if (!existsSync(SRC_DIR)) throw new Error(`Missing compiler fixtures: ${SRC_DIR}`);
    const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.sao'));

    for (const file of files) {
        const name = file.replace(/\.sao$/, '');
        const fnName = pascalCase(name);
        const viewPath = `fixtures.${name}`;
        const saoPath = path.join(SRC_DIR, file);

        const source = readFileSync(saoPath, 'utf-8');
        if (name === 'db-language-page') {
            // Pin this contract fixture to the compiler under change, rather than an older
            // Composer installation in the starter. Both use the public compile API.
            const compilerRoot = path.resolve(HERE, '../../../../compiler');
            const script = 'require $argv[1]."/vendor/autoload.php"; $result = (new \\Saola\\Compiler\\SaolaCompiler())->compile(file_get_contents($argv[2]), new \\Saola\\Compiler\\CompileOptions(viewPath: "fixtures.db-language-page", functionName: "DbLanguagePage", factoryName: "DbLanguagePage")); echo json_encode(["js" => $result->js, "blade" => $result->blade], JSON_THROW_ON_ERROR);';
            const result = JSON.parse(execFileSync(process.env.SAOLA_PHP_BINARY || 'php', ['-r', script, compilerRoot, saoPath], { encoding: 'utf8' }));
            writeFileSync(path.join(OUT_JS_DIR, `${name}.js`), result.js, 'utf8');
            writeFileSync(path.join(OUT_BLADE_DIR, `${name}.blade.php`), result.blade, 'utf8');
            continue;
        }
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

        const outJs = path.join(OUT_JS_DIR, `${name}.${result.lang ?? lang}`);
        writeFileSync(outJs, result.js, 'utf-8');

        const outBlade = path.join(OUT_BLADE_DIR, `${name}.blade.php`);
        writeFileSync(outBlade, result.blade, 'utf-8');
    }

    const guide = readFileSync(path.join(SAOLA_APP_ROOT, 'docs/SAO_FILE.md'), 'utf8');
    const example = guide.match(/```sao\r?\n([\s\S]*?)```/);
    if (!example) throw new Error('The getting-started guide must contain a runnable .sao example.');
    const guideResult = await builder.compileWithPhp(example[1], {
        viewPath: 'fixtures.getting-started', functionName: 'GettingStarted', factoryName: 'GettingStarted',
        emit: 'both', lang: 'ts', idMode: 'terse',
    });
    writeFileSync(path.join(OUT_JS_DIR, 'getting-started.ts'), guideResult.js);
    writeFileSync(path.join(OUT_BLADE_DIR, 'getting-started.blade.php'), guideResult.blade);

    // Exercise the starter's actual demo using the compiler being developed here.
    const compilerRoot = path.resolve(HERE, '../../../../compiler');
    const demo = path.join(SAOLA_APP_ROOT, 'resources/saola/web/views/modules/home/language-demo.sao');
    const script = 'require $argv[1]."/vendor/autoload.php"; $result = (new \\Saola\\Compiler\\SaolaCompiler())->compile(file_get_contents($argv[2]), new \\Saola\\Compiler\\CompileOptions(viewPath: "web.modules.home.language-demo", functionName: "LanguageDemo", factoryName: "LanguageDemo")); echo json_encode(["js" => $result->js, "blade" => $result->blade], JSON_THROW_ON_ERROR);';
    const demoResult = JSON.parse(execFileSync(process.env.SAOLA_PHP_BINARY || 'php', ['-r', script, compilerRoot, demo], {encoding: 'utf8'}));
    writeFileSync(path.join(OUT_JS_DIR, 'language-demo.ts'), demoResult.js);
    writeFileSync(path.join(OUT_BLADE_DIR, 'language-demo.blade.php'), demoResult.blade);

    const adminRoot = path.resolve(HERE, '../../../../admin');
    const adminScript = 'require $argv[1]."/vendor/autoload.php"; $result = (new \\Saola\\Compiler\\SaolaCompiler())->compile(file_get_contents($argv[2]), new \\Saola\\Compiler\\CompileOptions(viewPath: $argv[3], functionName: $argv[4], factoryName: $argv[4], lang: \\Saola\\Compiler\\Lang::Ts)); echo json_encode(["js" => $result->js, "blade" => $result->blade], JSON_THROW_ON_ERROR);';
    for (const [name, file, fn] of [
        ['admin-page', 'pages/resource', 'AdminPage'],
        ['admin-renderer', 'components/resource', 'AdminRenderer'],
        ['admin-shell', 'layouts/shell', 'AdminShell'],
        ['admin-settings-page', 'pages/settings', 'AdminSettingsPage'],
        ['admin-settings-form', 'components/settings-form', 'AdminSettingsForm'],
        ['admin-languages-page', 'pages/languages', 'AdminLanguagesPage'],
        ['admin-languages-form', 'components/languages', 'AdminLanguagesForm'],
    ]) {
        const source = path.join(adminRoot, `resources/saola/admin/views/${file}.sao`);
        const result = JSON.parse(execFileSync(process.env.SAOLA_PHP_BINARY || 'php', ['-r', adminScript, compilerRoot, source, `admin.${file.replace('/', '.')}`, fn], {encoding: 'utf8'}));
        writeFileSync(path.join(OUT_JS_DIR, `${name}.ts`), result.js);
        writeFileSync(path.join(OUT_BLADE_DIR, `${name}.blade.php`), result.blade);
    }
    for (const locale of ['en', 'vi']) {
        const script = 'echo json_encode(array_replace_recursive(require $argv[1]."/lang/".$argv[2]."/admin.php", require $argv[1]."/lang/".$argv[2]."/common.php"), JSON_THROW_ON_ERROR);';
        writeFileSync(path.join(GEN_DIR, `admin-${locale}.json`), execFileSync(process.env.SAOLA_PHP_BINARY || 'php', ['-r', script, adminRoot, locale], {encoding: 'utf8'}));
    }
    execFileSync(process.env.SAOLA_PHP_BINARY || 'php', [path.join(adminRoot, 'vendor/bin/phpunit'), '-c', path.join(adminRoot, 'phpunit.xml'), '--filter', 'test_ssr_compiles'], {
        cwd: adminRoot, encoding: 'utf8', env: {...process.env, SAOLA_ADMIN_PREVIEW_DIR: path.join(GEN_DIR, 'admin-ssr')},
    });

    // Boot a fresh Laravel application too: Testbench refreshes route name
    // lookups itself and can hide late booted() registration bugs in a host.
    const liveScript = '$_SERVER = array_merge($_SERVER, ["REQUEST_METHOD" => "GET", "REQUEST_URI" => "/control/settings", "HTTP_ACCEPT" => "application/json", "HTTP_HOST" => "localhost", "SERVER_NAME" => "localhost", "SERVER_PORT" => "80", "SCRIPT_NAME" => "/index.php"]); require $argv[1];';
    const fresh = JSON.parse(execFileSync(process.env.SAOLA_PHP_BINARY || 'php', ['-r', liveScript, path.join(adminRoot, 'workbench/serve-preview.php')], {
        cwd: adminRoot, encoding: 'utf8', env: {...process.env, SAOLA_ADMIN_PREVIEW_DIR: path.join(GEN_DIR, 'admin-ssr')},
    }));
    if (fresh?.view !== 'admin.pages.settings' || fresh?.data?.editor?.group !== 'general') {
        throw new Error('Fresh Laravel settings workbench did not boot: ' + JSON.stringify(fresh));
    }

    console.log(`[fixtures] đã compile ${files.length} file .sao qua Builder + saola/compiler → .generated/{js,blade}`);
}
