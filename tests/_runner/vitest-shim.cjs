/**
 * Shim tối thiểu tương thích vitest API (describe/it/expect/afterEach...)
 * Chỉ dùng cho môi trường không cài được vitest (CI offline / sandbox).
 * Trên máy dev: dùng vitest thật (`npm test`).
 */
const registry = {
    tests: [],        // { name, fn, file }
    afterEach: [],    // { fn, file }
    beforeEach: [],
    currentFile: '',
};
const describeStack = [];

function describe(name, fn) {
    describeStack.push(name);
    try { fn(); } finally { describeStack.pop(); }
}
describe.skip = (name, fn) => {};

function it(name, fn) {
    registry.tests.push({
        name: [...describeStack, name].join(' › '),
        fn,
        file: registry.currentFile,
    });
}
it.skip = (name, fn) => {
    registry.tests.push({ name: [...describeStack, name].join(' › '), fn: null, file: registry.currentFile, skipped: true });
};
const test = it;

function afterEach(fn) { registry.afterEach.push({ fn, file: registry.currentFile }); }
function beforeEach(fn) { registry.beforeEach.push({ fn, file: registry.currentFile }); }

function format(v) {
    try {
        if (v instanceof Error) return v.message;
        if (typeof v === 'object' && v !== null && v.nodeType) return `<${v.nodeName?.toLowerCase?.() ?? 'node'}>`;
        return JSON.stringify(v);
    } catch { return String(v); }
}

function makeExpect(actual, negate = false) {
    const check = (pass, msg) => {
        if (negate ? pass : !pass) {
            throw new Error(`${negate ? '[not] ' : ''}${msg}`);
        }
    };
    const api = {
        toBe: (exp) => check(Object.is(actual, exp), `expected ${format(actual)} toBe ${format(exp)}`),
        toEqual: (exp) => check(JSON.stringify(actual) === JSON.stringify(exp), `expected ${format(actual)} toEqual ${format(exp)}`),
        toBeNull: () => check(actual === null, `expected ${format(actual)} toBeNull`),
        toBeUndefined: () => check(actual === undefined, `expected ${format(actual)} toBeUndefined`),
        toBeTruthy: () => check(!!actual, `expected ${format(actual)} toBeTruthy`),
        toBeFalsy: () => check(!actual, `expected ${format(actual)} toBeFalsy`),
        toContain: (exp) => check(
            (typeof actual === 'string' && actual.includes(exp)) || (Array.isArray(actual) && actual.includes(exp)),
            `expected ${format(actual)} toContain ${format(exp)}`),
        toBeGreaterThan: (exp) => check(actual > exp, `expected ${format(actual)} > ${format(exp)}`),
        toHaveLength: (exp) => check(actual?.length === exp, `expected length ${actual?.length} toBe ${exp}`),
        toThrow: () => {
            let threw = false;
            try { actual(); } catch { threw = true; }
            check(threw, `expected function toThrow`);
        },
    };
    Object.defineProperty(api, 'not', { get: () => makeExpect(actual, !negate) });
    return api;
}
const expect = (actual) => makeExpect(actual);

const vi = {
    fn: (impl) => {
        const calls = [];
        const f = (...args) => { calls.push(args); return impl?.(...args); };
        f.mock = { calls };
        return f;
    },
};

module.exports = { describe, it, test, expect, afterEach, beforeEach, vi, __registry: registry };
