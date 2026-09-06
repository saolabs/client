import { afterEach, expect, it } from 'vitest';
import path from 'node:path';
import ts from 'typescript';
import { mount, nextFrame, type Harness } from '../../src/testing';

const generated = path.join(__dirname, '../fixtures/compiled/.generated/js/typed-computed.ts');
let harness: Harness | undefined;
afterEach(() => { harness?.destroy(); harness = undefined; });

it('typed source → compiler → mount: server props, computed chains and immediate reads', async () => {
    const module = await import(/* @vite-ignore */ generated);
    harness = mount(module.default, { price: 7 });
    expect(harness.view.literal()).toBe('@state(count = 0) @await @fetch("sample")');
    expect(harness.container.querySelector('#active')?.textContent).toBe('1');
    expect(harness.container.querySelector('#roles')?.textContent).toBe('1');
    expect(harness.container.querySelector('#total')?.textContent).toBe('14');
    expect(harness.container.querySelector('#doubled')?.textContent).toBe('28');
    (harness.container.querySelector('#inc') as HTMLElement).click();
    await nextFrame();
    expect(harness.container.querySelector('#active')?.textContent).toBe('2');
    expect(harness.container.querySelector('#roles')?.textContent).toBe('3');
    expect(harness.container.querySelector('#total')?.textContent).toBe('21');
    expect(harness.container.querySelector('#doubled')?.textContent).toBe('42');
    expect(harness.container.querySelector('#observed')?.textContent).toBe('42');
    expect(harness.view.calls).toBe(1);
    // Config methods are bound to the View, including detached and async calls.
    const record = harness.view.record;
    expect(record(2)).toBe(harness.view.path);
    expect(harness.view.calls).toBe(3);
    expect(await harness.view.owner()).toBe(harness.view);
});

it('generated TypeScript checks defaults, prop reads and setters with the real type checker', () => {
    const options: ts.CompilerOptions = {
        strict: true, noEmit: true, skipLibCheck: true,
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: path.join(__dirname, '../..'),
        paths: { '@saolabs/client': ['index.ts'] },
    };
    const check = (replace?: (source: string) => string) => {
        const host = ts.createCompilerHost(options);
        const read = host.readFile.bind(host);
        host.readFile = file => {
            const source = read(file);
            return file === generated && source && replace ? replace(source) : source;
        };
        const program = ts.createProgram([generated], options, host);
        return ts.getPreEmitDiagnostics(program).filter(d => d.file?.fileName === generated);
    };
    expect(check().map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    expect(check(s => s.replace('setQty(qty + 1)', "setQty('wrong')"))).not.toHaveLength(0);
    expect(check(s => s.replace('let qty: number = 2', "let qty: number = 'wrong'"))).not.toHaveLength(0);
    expect(check(s => s.replace('price * qty', 'price.toUpperCase()'))).not.toHaveLength(0);
    expect(check(s => s.replace('this.record(1)', "this.record('wrong')"))).not.toHaveLength(0);
    expect(check(s => s.replace('this.record(1)', 'this.missingMethod()'))).not.toHaveLength(0);
    expect(check(s => s.replace('this.calls += step', "this.calls = 'wrong'"))).not.toHaveLength(0);
    expect(check(s => s.replace('return this.path', 'return this.path.toFixed()'))).not.toHaveLength(0);
}, 20000);
