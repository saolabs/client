/**
 * Phase 9 — Directive Binding Helpers tests
 *
 * Test ba method trên ViewController được gọi bởi compiled @show/@style/@class directives:
 *   - __showBinding(stateKeys, condition)   → CSS display string
 *   - __styleBinding(stateKeys, styles)     → inline CSS string
 *   - __classBinding(configs)               → CSS class string (legacy path)
 *
 * Flow trong compiled code:
 *   @show($isOpen)  →  style="${this.__showBinding(['isOpen'], isOpen)}"
 *   @style(...)     →  ${this.__styleBinding([...], [['color', val], ...])}
 *   @class(...)     →  ${this.__classBinding([{type, value, checker?}])}
 *
 * Tham chiếu: COMPILER_CONTRACT.md §15, ViewController.ts §Directive Binding Helpers
 */

import { describe, it, expect } from 'vitest';
import { ViewController } from '../../src/core/view/ViewController';
import { app } from '../../src/core/helpers/app';

// ─── Factory: tạo ViewController bare-minimum ────────────────────────────────

function makeCtrl(): ViewController {
    return new ViewController({ app: app() as any } as any);
}

// ─── __showBinding ────────────────────────────────────────────────────────────

describe('ViewController.__showBinding', () => {
    it('condition truthy → chuỗi rỗng (element hiện)', () => {
        const ctrl = makeCtrl();
        expect(ctrl.__showBinding(['isVisible'], true)).toBe('');
        expect(ctrl.__showBinding(['isVisible'], 1)).toBe('');
        expect(ctrl.__showBinding(['isVisible'], 'yes')).toBe('');
        expect(ctrl.__showBinding(['isVisible'], [])).toBe(''); // truthy object
    });

    it('condition falsy → "display: none;"', () => {
        const ctrl = makeCtrl();
        expect(ctrl.__showBinding(['isVisible'], false)).toBe('display: none;');
        expect(ctrl.__showBinding(['isVisible'], 0)).toBe('display: none;');
        expect(ctrl.__showBinding(['isVisible'], null)).toBe('display: none;');
        expect(ctrl.__showBinding(['isVisible'], undefined)).toBe('display: none;');
        expect(ctrl.__showBinding(['isVisible'], '')).toBe('display: none;');
    });

    it('stateKeys không ảnh hưởng đến kết quả', () => {
        const ctrl = makeCtrl();
        // stateKeys chỉ để Html.ts biết subscribe; __showBinding không dùng nó
        expect(ctrl.__showBinding([], true)).toBe('');
        expect(ctrl.__showBinding(['a', 'b', 'c'], false)).toBe('display: none;');
    });
});

// ─── __styleBinding ───────────────────────────────────────────────────────────

describe('ViewController.__styleBinding', () => {
    it('render đúng CSS props từ [prop, value] pairs', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__styleBinding(
            ['color', 'fontSize'],
            [['color', 'red'], ['font-size', '16px']],
        );
        expect(result).toBe('color: red; font-size: 16px');
    });

    it('lọc bỏ value = null', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__styleBinding(
            ['color'],
            [['color', null], ['background', 'blue']],
        );
        expect(result).toBe('background: blue');
        expect(result).not.toContain('color');
    });

    it('lọc bỏ value = undefined', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__styleBinding(
            ['color'],
            [['color', undefined], ['margin', '0']],
        );
        expect(result).toBe('margin: 0');
    });

    it('lọc bỏ value = false', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__styleBinding(
            ['display'],
            [['display', false], ['padding', '8px']],
        );
        expect(result).toBe('padding: 8px');
    });

    it('lọc bỏ value = "" (chuỗi rỗng)', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__styleBinding(
            ['color'],
            [['color', ''], ['opacity', '0.5']],
        );
        expect(result).toBe('opacity: 0.5');
    });

    it('trả về "" khi tất cả values bị lọc', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__styleBinding(
            ['x'],
            [['color', null], ['display', false], ['margin', '']],
        );
        expect(result).toBe('');
    });

    it('value = 0 (số) vẫn được render (zero là valid CSS value)', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__styleBinding(
            ['z-index'],
            [['z-index', 0]],
        );
        // 0 là falsy nhưng KHÔNG bị lọc vì... thực ra cần check: spec lọc false/null/undefined/''
        // 0 (number) không trong danh sách, nên phải được giữ
        expect(result).toBe('z-index: 0');
    });

    it('trả về "" khi input không phải array', () => {
        const ctrl = makeCtrl();
        // @ts-expect-error — test defensive guard
        expect(ctrl.__styleBinding([], null)).toBe('');
        // @ts-expect-error
        expect(ctrl.__styleBinding([], 'invalid')).toBe('');
    });

    it('trả về "" khi mảng rỗng', () => {
        const ctrl = makeCtrl();
        expect(ctrl.__styleBinding([], [])).toBe('');
    });

    it('stateKeys không ảnh hưởng kết quả', () => {
        const ctrl = makeCtrl();
        const a = ctrl.__styleBinding([], [['color', 'red']]);
        const b = ctrl.__styleBinding(['color', 'theme'], [['color', 'red']]);
        expect(a).toBe(b);
    });
});

// ─── __classBinding ───────────────────────────────────────────────────────────

describe('ViewController.__classBinding', () => {
    it('static class luôn được thêm', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__classBinding([
            { type: 'static', value: 'btn' },
            { type: 'static', value: 'btn-lg' },
        ]);
        expect(result).toBe('btn btn-lg');
    });

    it('binding class: thêm khi checker() = truthy', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__classBinding([
            { type: 'static', value: 'card' },
            { type: 'binding', value: 'is-active', checker: () => true },
        ]);
        expect(result).toBe('card is-active');
    });

    it('binding class: bỏ qua khi checker() = falsy', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__classBinding([
            { type: 'static', value: 'card' },
            { type: 'binding', value: 'is-active', checker: () => false },
        ]);
        expect(result).toBe('card');
    });

    it('binding class không có checker → bỏ qua (không crash)', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__classBinding([
            { type: 'static', value: 'foo' },
            { type: 'binding', value: 'no-checker' }, // thiếu checker
        ]);
        expect(result).toBe('foo');
    });

    it('trả về "" khi tất cả binding classes đều false', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__classBinding([
            { type: 'binding', value: 'hidden', checker: () => false },
            { type: 'binding', value: 'collapsed', checker: () => 0 },
        ]);
        expect(result).toBe('');
    });

    it('trả về "" khi input không phải array', () => {
        const ctrl = makeCtrl();
        // @ts-expect-error — test defensive guard
        expect(ctrl.__classBinding(null)).toBe('');
        // @ts-expect-error
        expect(ctrl.__classBinding(undefined)).toBe('');
    });

    it('bỏ qua config không có value', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__classBinding([
            { type: 'static', value: '' },     // value rỗng → bỏ
            { type: 'static', value: 'real' },
        ]);
        expect(result).toBe('real');
    });

    it('checker nhận state động (closure)', () => {
        const ctrl = makeCtrl();
        let isActive = false;

        const result1 = ctrl.__classBinding([
            { type: 'binding', value: 'active', checker: () => isActive },
        ]);
        expect(result1).toBe('');

        isActive = true;
        const result2 = ctrl.__classBinding([
            { type: 'binding', value: 'active', checker: () => isActive },
        ]);
        expect(result2).toBe('active');
    });

    it('kết hợp static + multiple binding classes', () => {
        const ctrl = makeCtrl();
        const result = ctrl.__classBinding([
            { type: 'static', value: 'btn' },
            { type: 'binding', value: 'btn-primary', checker: () => true },
            { type: 'binding', value: 'btn-lg', checker: () => false },
            { type: 'binding', value: 'disabled', checker: () => false },
        ]);
        expect(result).toBe('btn btn-primary');
    });
});
