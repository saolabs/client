import {defineConfig} from 'vitest/config';

// Package checks run in a standalone checkout without PHP or ecosystem siblings.
// npm test remains the complete compiler/admin integration suite.
export default defineConfig({
    resolve: {alias: {'@saolabs/client': new URL('./index.ts', import.meta.url).pathname}},
    test: {
        environment: 'jsdom', globals: true,
        include: ['tests/bootstrap-dist.test.ts', 'tests/language-catalog.test.ts', 'tests/compiled/admin-guards.test.ts'],
    },
});
