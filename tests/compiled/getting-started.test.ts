import { afterEach, expect, it } from 'vitest';
import path from 'node:path';
import ts from 'typescript';
import { mount, nextFrame, type Harness } from '../../src/testing';

const generated = path.join(__dirname, '../fixtures/compiled/.generated/js/getting-started.ts');
let harness: Harness | undefined;
afterEach(() => { harness?.destroy(); harness = undefined; });

it('the first .sao example in the guide compiles and supports props, computed, increment and reset', async () => {
    const module = await import(/* @vite-ignore */ generated);
    harness = mount(module.default, {initial: 3});
    const text = (id: string) => harness!.container.querySelector(id)?.textContent;
    expect(text('#count')).toBe('3');
    expect(text('#doubled')).toBe('6');
    (harness.container.querySelector('#increment') as HTMLButtonElement).click();
    await nextFrame();
    expect(text('#count')).toBe('4');
    expect(text('#doubled')).toBe('8');
    (harness.container.querySelector('#reset') as HTMLButtonElement).click();
    await nextFrame();
    expect(text('#count')).toBe('3');
    expect(text('#doubled')).toBe('6');
});

it('the guide example has valid strict TypeScript', () => {
    const program = ts.createProgram([generated], {
        noEmit: true, strict: true, skipLibCheck: true,
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: path.join(__dirname, '../..'), paths: {'@saolabs/client': ['index.ts']},
    });
    expect(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
});
