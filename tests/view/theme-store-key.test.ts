import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewManager } from '../../src/core/view/ViewManager';

/**
 * Khoá store của view phải bám khoá registry ĐÃ RESOLVE, không phải tên yêu cầu.
 *
 * Khi theme đang bật, `__layout__` là tiền tố của cả context nên `@extends` sinh
 * tên `themes.{slug}.layouts.docs`, trong khi view thật lấy từ base và mang
 * `ctrl.path = 'web.layouts.docs'`. Hai chỗ dọn store (`pageCache.onEvict` và
 * `destroyLayoutView`) đều xoá theo `ctrl.path`.
 *
 * Lưu theo tên yêu cầu ⇒ instance đã destroy nằm lại trong store vĩnh viễn ⇒
 * lần điều hướng sau `extendView` trả về nó và `render()` trả rỗng. Triệu chứng
 * thật: "trang chủ → docs → logo → docs" thì lần thứ hai đứng im, log
 * `View "web.layouts.docs" returned nothing from render()`.
 *
 * KHÔNG bật theme thì hai khoá trùng nhau nên bug ẩn hoàn toàn — đó là lý do nó
 * lọt qua mọi test cũ.
 */
describe('khoá store view khi theme đang bật', () => {
    // StoreService.instance("ViewManager") dùng CHUNG giữa mọi ViewManager, nên
    // không xả thì test sau nhận cache của test trước.
    beforeEach(() => { new ViewManager().store.clear(); });

    const makeManager = () => {
        const vm = new ViewManager();
        const made: any[] = [];
        const factory = () => {
            const view: any = { __ctrl__: { path: 'web.layouts.docs', updateData: vi.fn() } };
            made.push(view);
            return view;
        };
        vm.setViewRegistry({ 'web.layouts.docs': factory });
        // Server gửi cặp này trong systemData khi theme đang bật.
        (vm as any).systemData = {
            __view_fallback_from__: 'themes.aurora',
            __view_fallback_to__: 'web',
        };

        return { vm, made };
    };

    it('lưu theo khoá base, không theo tên có tiền tố theme', () => {
        const { vm } = makeManager();

        vm.resolveViewSync('themes.aurora.layouts.docs', {}, true);

        const store = (vm as any).store;
        expect(store.has('web.layouts.docs')).toBe(true);
        // Lưu theo tên yêu cầu là bug: chỗ dọn store xoá theo ctrl.path.
        expect(store.has('themes.aurora.layouts.docs')).toBe(false);
    });

    it('gỡ theo ctrl.path thì lần sau dựng instance MỚI, không trả instance chết', () => {
        const { vm, made } = makeManager();

        const first = vm.resolveViewSync('themes.aurora.layouts.docs', {}, true);
        expect(made).toHaveLength(1);

        // Mô phỏng destroyLayoutView / pageCache.onEvict: xoá theo ctrl.path.
        (vm as any).store.remove(first.__ctrl__.path);

        const second = vm.resolveViewSync('themes.aurora.layouts.docs', {}, true);
        expect(made).toHaveLength(2);
        expect(second).not.toBe(first);
    });

    it('view mà theme THẬT SỰ đè thì giữ nguyên khoá của theme', () => {
        const vm = new ViewManager();
        vm.setViewRegistry({
            'themes.aurora.modules.ping.index': () => ({
                __ctrl__: { path: 'themes.aurora.modules.ping.index', updateData: vi.fn() },
            }),
        });
        (vm as any).systemData = {
            __view_fallback_from__: 'themes.aurora',
            __view_fallback_to__: 'web',
        };

        vm.resolveViewSync('themes.aurora.modules.ping.index', {}, true);

        expect((vm as any).store.has('themes.aurora.modules.ping.index')).toBe(true);
    });
});
