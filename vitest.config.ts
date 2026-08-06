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
    },
});
