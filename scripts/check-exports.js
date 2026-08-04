#!/usr/bin/env node
/**
 * Xác minh mọi entry trong package.json `exports` trỏ tới file CÓ THẬT sau build.
 *
 * Có để bắt lỗi kiểu `./core -> ./dist/core/index.js` (đường dẫn không bao giờ
 * tồn tại vì tsconfig `rootDir: "."` đẩy mọi thứ trong src/ ra dist/src/...).
 * Loại lỗi này im lặng cho tới khi người dùng import mới nổ → phải chặn ở
 * khâu đóng gói.
 *
 * Chạy: node scripts/check-exports.js   (đã gắn vào prepublishOnly)
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

const problems = [];
const checked = [];

/** Mỗi entry có thể là string hoặc object { types, import, require }. */
function targetsOf(entry) {
    if (typeof entry === 'string') return [entry];
    if (entry && typeof entry === 'object') {
        return Object.values(entry).filter(v => typeof v === 'string');
    }
    return [];
}

for (const [name, entry] of Object.entries(pkg.exports || {})) {
    for (const target of targetsOf(entry)) {
        const full = path.join(root, target);
        const ok = fs.existsSync(full);
        checked.push({ name, target, ok });
        if (!ok) problems.push(`  ${name} -> ${target}`);
    }
}

for (const { name, target, ok } of checked) {
    console.log(`${ok ? '  OK  ' : '  MISS'}  ${name} -> ${target}`);
}

if (problems.length > 0) {
    console.error(`\n✗ ${problems.length} export trỏ tới file không tồn tại:\n${problems.join('\n')}`);
    console.error('\nChạy `npm run build` trước, hoặc sửa/xoá entry trong package.json.\n');
    process.exit(1);
}

console.log(`\n✓ ${checked.length} export đều resolve được.\n`);
