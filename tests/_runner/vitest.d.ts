/**
 * Type stubs cho vitest — dùng khi chạy tsc trong môi trường không cài được vitest.
 * Runtime thực tế dùng vitest-shim.cjs qua Module._resolveFilename hijack.
 */
declare module 'vitest' {
    export function describe(name: string, fn: () => void): void;
    export namespace describe {
        function skip(name: string, fn: () => void): void;
    }
    export function it(name: string, fn: () => void | Promise<void>): void;
    export namespace it {
        function skip(name: string, fn: () => void | Promise<void>): void;
    }
    export const test: typeof it;
    export function expect(actual: any): {
        toBe(expected: any): void;
        toEqual(expected: any): void;
        toBeNull(): void;
        toBeUndefined(): void;
        toBeTruthy(): void;
        toBeFalsy(): void;
        toContain(expected: any): void;
        toBeGreaterThan(n: number): void;
        toHaveLength(n: number): void;
        toThrow(): void;
        not: ReturnType<typeof expect>;
    };
    export function afterEach(fn: () => void | Promise<void>): void;
    export function beforeEach(fn: () => void | Promise<void>): void;
    export const vi: {
        fn<T extends (...args: any[]) => any>(impl?: T): T & { mock: { calls: any[][] } };
    };
}
