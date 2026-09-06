# @saolabs/client

Runtime TypeScript phía trình duyệt của Saola: hydration HTML do Laravel render,
state, component, điều hướng SPA và vòng đời tài nguyên.

## Bắt đầu

```bash
npm install @saolabs/client
npm install --save-dev @saolabs/builder typescript
composer require saola/core saola/compiler
```

Viết giao diện bằng `.sao`, để compiler sinh class View và registry. Bắt đầu với
[hướng dẫn component](../saola/docs/SAO_FILE.md) trong workspace hệ sinh thái.
Compiler PHP sinh Blade SSR; client nhận DOM và xử lý tương tác trong browser.

## Module và tương thích

Package phát hành **ESM**. Các entry công khai:

- `@saolabs/client`: runtime, services và kiểu dữ liệu.
- `@saolabs/client/plugins`: `createPlugin`, `pluginManager`.
- `@saolabs/client/testing`: `mount`, `mountView`, `nextFrame` và `Harness`.

```ts
import { HttpService } from '@saolabs/client';
import { createPlugin, pluginManager } from '@saolabs/client/plugins';

const http = new HttpService();
pluginManager.register(createPlugin('example', () => {
    http.setTimeout(5000);
})).install('example');
```

Các công cụ CommonJS dùng `await import('@saolabs/client')`; package không cam kết
`require()` đồng bộ. Runtime cần DOM (browser hoặc jsdom trong test), không phải
renderer SSR chạy trong Node. Dùng PHP compiler cho SSR Laravel.
Các import tương đối có đuôi `.js`; build và declaration được kiểm với NodeNext.

## Test component đã compile

```ts
import { mount, nextFrame } from '@saolabs/client/testing';
import Counter from './compiled/counter.js';

const counter = mount(Counter, {initial: 3});
counter.container.querySelector('button')?.click();
await nextFrame();
console.log(counter.text());
counter.destroy();
```

Chạy trong môi trường DOM. Với theme nạp rời, externalize `@saolabs/client` để
app và theme dùng cùng một runtime; xem [bootstrap](docs/BOOTSTRAP_PROVIDER_GUIDE.md).

## Phát triển và kiểm chứng

```bash
npm run build          # ESM JS và declarations
npm run typecheck      # Kiểm source, không emit
npm test               # Runtime + compile-to-mount contract tests
npm run check-exports  # Pack thật; kiểm 3 entry và types trong consumer tạm
```

`check-exports` không publish. Nó kiểm native ESM, dynamic import từ CommonJS,
mount view qua package đã đóng và TypeScript NodeNext, không dùng alias source.
Bộ test compile fixture cần sibling `builder/`, `compiler/`, `saola/` trong
workspace hệ sinh thái. Thiếu builder là lỗi kiểm tra, không tự bỏ qua test.

## Tài liệu

- [Runtime API](docs/RUNTIME_API_SPEC.md)
- [Compiler contract](docs/COMPILER_CONTRACT.md)
- [Testing](docs/TESTING.md)
- [Devtools](docs/DEVTOOLS.md)

MIT.
