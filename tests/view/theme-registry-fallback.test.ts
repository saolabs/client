/**
 * Đường rơi theme → base khi tra registry.
 *
 * Server có ThemeAwareViewFinder nên một view theme không đè vẫn render được từ
 * base. Client KHÔNG có đường đó: `__layout__` là tiền tố của cả context nên
 * `@extends(__layout__ + "workspace")` sinh khoá `themes.{slug}.layouts.workspace`
 * ngay cả khi theme chỉ mang đúng một trang. Server gửi kèm cặp
 * `__view_fallback_from__/to__` trong systemData để client rơi y hệt.
 *
 * Thiếu cơ chế này: "View ... not found in registry" và trang trắng sau hydrate.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ViewManager } from '../../src/core/view/ViewManager';

const makeFactory = (name: string) => Object.assign(() => ({ name }), { __name__: name });

function manager(systemData: Record<string, any>): any {
    const vm: any = new ViewManager();
    vm.init({
        registry: {
            'web.layouts.workspace': makeFactory('web.layouts.workspace'),
            'web.modules.home.index': makeFactory('web.modules.home.index'),
            'themes.aurora.modules.ping.index': makeFactory('themes.aurora.modules.ping.index'),
        },
        systemData,
    });
    return vm;
}

const THEMED = {
    __view_fallback_from__: 'themes.aurora',
    __view_fallback_to__: 'web',
};

describe('registry fallback theme → base', () => {
    it('view theme ĐÃ compile thì giữ nguyên khoá theme', () => {
        const vm = manager(THEMED);
        expect(vm.resolveRegistryKey('themes.aurora.modules.ping.index'))
            .toBe('themes.aurora.modules.ping.index');
        expect(vm.hasView('themes.aurora.modules.ping.index')).toBe(true);
    });

    it('view theme KHÔNG đè thì rơi về khoá base', () => {
        const vm = manager(THEMED);
        expect(vm.resolveRegistryKey('themes.aurora.layouts.workspace'))
            .toBe('web.layouts.workspace');
        expect(vm.hasView('themes.aurora.layouts.workspace')).toBe(true);
    });

    it('base cũng không có thì trả lại tên gốc, không bịa khoá', () => {
        const vm = manager(THEMED);
        expect(vm.resolveRegistryKey('themes.aurora.modules.khong-co.index'))
            .toBe('themes.aurora.modules.khong-co.index');
        expect(vm.hasView('themes.aurora.modules.khong-co.index')).toBe(false);
    });

    it('không có theme thì không đổi khoá nào', () => {
        const vm = manager({});
        expect(vm.resolveRegistryKey('themes.aurora.layouts.workspace'))
            .toBe('themes.aurora.layouts.workspace');
        expect(vm.hasView('themes.aurora.layouts.workspace')).toBe(false);
        expect(vm.hasView('web.layouts.workspace')).toBe(true);
    });

    it('tên chỉ TRÙNG TIỀN TỐ chứ không đúng segment thì không bị đổi', () => {
        const vm = manager(THEMED);
        expect(vm.resolveRegistryKey('themes.aurora-dark.layouts.workspace'))
            .toBe('themes.aurora-dark.layouts.workspace');
    });
});
