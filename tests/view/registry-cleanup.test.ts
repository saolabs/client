/**
 * Ranh giới TÁI DÙNG ↔ DỌN SẠCH.
 *
 * Nguyên tắc: tận dụng lại object/element khi còn dùng (PageCache giữ view
 * sống, ForeachSlotCache giữ element), nhưng khi một thứ bị XOÁ THẬT thì mọi
 * registry phải nhả nó ra — nếu không, registry toàn cục phình vô hạn theo số
 * lần điều hướng và có thể trả về xác chết cho lần dùng sau.
 *
 * Test này đo TRẦN: điều hướng nhiều gấp nhiều lần sức chứa PageCache (LRU=10)
 * rồi khẳng định mọi registry đứng yên ở đúng số lượng đối tượng còn SỐNG.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Router } from '../../src/core/routers/Router';
import { ViewManager } from '../../src/core/view/ViewManager';
import { View } from '../../src/core/view/View';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import SectionManager from '../../src/core/services/SectionManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

function layoutFactory() {
    return () => {
        const v = new View('L', 'layout');
        v.__ctrl__.setup({
            superView: null, data: {},
            commitConstructorData() {}, updateVariableData() {}, prerender() { return null; },
            render(this: any) {
                return this.wrapper((p: any) => [
                    this.html('sh', 'div', p, { attrs: { id: { type: 'static', value: 'shell' } } },
                        (p2: any) => [this.blockOutlet('ob-content', 'content', p2)]),
                ]);
            },
        } as any);
        return v;
    };
}

function pageFactory(path: string, label: string) {
    return () => {
        const v = new View(path, 'view');
        v.__ctrl__.setup({
            superView: 'L', data: {},
            commitConstructorData() {}, updateVariableData() {}, prerender() { return null; },
            render(this: any) {
                this.block('b-content', 'content', (p: any) => [
                    this.html(`pg-${label}`, 'span', p, {}, () => [this.text(label)]),
                ]);
                return this.extendView('L');
            },
        } as any);
        return v;
    };
}

const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

const markersByTag = () => {
    const byTag: Record<string, number> = {};
    for (const r of MarkerRegistry.all().values()) byTag[r.tag] = (byTag[r.tag] ?? 0) + 1;
    return byTag;
};

afterEach(() => {
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
    MarkerRegistry.clear();   // singleton toàn cục — không dọn thì test rò sang nhau
});

async function browse(n: number) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);

    const registry: any = { L: layoutFactory() };
    const routes: any[] = [];
    for (let i = 0; i < n; i++) {
        registry['P' + i] = pageFactory('P' + i, 'p' + i);
        routes.push({ path: `/p${i}`, component: 'P' + i });
    }
    vm.init({ container, registry });

    const router = new Router(app() as any);
    router.setViewManager(vm);
    router.configure({ mode: 'history', routes });
    (app() as any).set('Router', router);

    for (let i = 0; i < n; i++) { await router.navigate(`/p${i}`); await frame(); }
    return { vm, router, container };
}

describe('registry có trần khi view bị xoá thật', () => {
    it('80 lần điều hướng, PageCache LRU=10 → mọi registry đứng yên ở số đối tượng SỐNG', async () => {
        const { vm } = await browse(80);

        const liveBlocks = BlockManager.blocks.size;
        const pageCacheSize = (vm as any).pageCache.entries.size;

        // PageCache giữ đúng trần của nó — tái dùng vẫn hoạt động
        expect(pageCacheSize).toBe(10);
        // 10 view trong cache + 1 view đang active
        expect(liveBlocks).toBe(11);

        // MarkerRegistry là singleton TOÀN CỤC: record `block` phải khớp CHÍNH XÁC
        // số Block còn sống, không phải số lần điều hướng (trước đây: 80).
        expect(markersByTag().block).toBe(liveBlocks);
        expect(markersByTag().blockoutlet).toBe(BlockManager.blockOutlets.size);

        // Các registry còn lại: theo view đang hiển thị, không tích luỹ
        expect(BlockManager.activeBlocks.size).toBe(1);
        expect((BlockManager as any).mountedChildren.size).toBe(1);
        expect(SectionManager.sections.size).toBe(0);
        expect(SectionManager.yields.size).toBe(0);
    });

    it('điều hướng gấp đôi số lượng → KHÔNG có registry nào tăng thêm', async () => {
        const a = await browse(20);
        const snapshotA = {
            block: markersByTag().block,
            blocks: BlockManager.blocks.size,
            mounted: (BlockManager as any).mountedChildren.size,
        };
        a.router.destroy();
        a.vm.destroy();              // teardown app — phải trả registry về 0
        document.body.innerHTML = '';

        expect(MarkerRegistry.size).toBe(0);

        const b = await browse(40);
        expect(markersByTag().block).toBe(snapshotA.block);
        expect(BlockManager.blocks.size).toBe(snapshotA.blocks);
        expect((BlockManager as any).mountedChildren.size).toBe(snapshotA.mounted);
        b.router.destroy();
        b.vm.destroy();
    });
});
