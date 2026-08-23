import { defineConfig } from 'vitest/config';

export default defineConfig({
    // Cho phép test nạp OUTPUT COMPILER THẬT (tests/fixtures/**) — file compiled
    // import '@saolabs/client', mà package này CHÍNH LÀ nó. Trỏ thẳng vào src để
    // test chạy trên code nguồn thay vì dist đã build.
    resolve: {
        alias: { '@saolabs/client': new URL('./index.ts', import.meta.url).pathname },
    },
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
        globals: true,
        // Compile tests/fixtures/compiled/src/*.sao bằng CLI Python thật của
        // compiler/ TRƯỚC khi chạy bất kỳ test nào — xem docs/FIX_PLAN_2026-08-14.md §F5.
        globalSetup: ['./tests/fixtures/compiled/globalSetup.ts'],
    },
});
