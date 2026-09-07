/**
 * Marker index dưới tải thêm mới / cập nhật liên tục.
 *
 * Ràng buộc phải giữ: số lần DỰNG LẠI index tỉ lệ với số LƯỢT hydrate, không
 * tỉ lệ với số claim hay số lần DOM đổi. Vỡ ràng buộc này là quay lại O(N²)
 * mà không test nào khác bắt được.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';

const reg = MarkerRegistry as any;
let builds = 0;
const origBuild = reg.buildIndex.bind(reg);
reg.buildIndex = function (...a: any[]) { builds++; return origBuild(...a); };

const pair = (tag: string, id: string) =>
    `<!--${MarkerRegistry.openComment(tag, id)}-->x<!--${MarkerRegistry.closeComment(tag, id)}-->`;

const ssr = (n: number, gen: number) =>
    Array.from({ length: n }, (_, i) => pair('output', `g${gen}-e${i}`)).join('');

describe('marker index dưới thêm mới / cập nhật liên tục', () => {
    beforeEach(() => { document.body.innerHTML = ''; MarkerRegistry.clear(); builds = 0; });

    it('1 lượt hydrate N marker → dựng index đúng 1 lần', () => {
        const N = 500;
        document.body.innerHTML = ssr(N, 0);
        for (let i = 0; i < N; i++) expect(MarkerRegistry.claim('output', `g0-e${i}`)).not.toBeNull();
        expect(builds).toBe(1);
    });

    it('CSR thêm/xoá marker liên tục KHÔNG đụng index', () => {
        document.body.innerHTML = ssr(100, 0);
        MarkerRegistry.claim('output', 'g0-e0');
        const after = builds;

        // 2000 vòng tạo + gắn + gỡ marker kiểu @foreach cập nhật danh sách
        for (let i = 0; i < 2000; i++) {
            const o = MarkerRegistry.createMarkerStart('reactive', `csr-${i}`);
            const c = MarkerRegistry.createMarkerEnd('reactive', `csr-${i}`);
            document.body.append(o, c);
            if (i % 2) { o.remove(); c.remove(); }
        }
        expect(builds).toBe(after);                               // không rebuild lần nào
        expect(MarkerRegistry.claim('output', 'g0-e5')).not.toBeNull(); // vẫn claim đúng
    });

    it('nhiều lượt HTML server mới: rebuild theo LƯỢT, không theo số claim', async () => {
        const CYCLES = 30, N = 100;
        for (let g = 1; g <= CYCLES; g++) {
            document.body.innerHTML = ssr(N, g);
            MarkerRegistry.invalidateIndex();                     // như hydrateView() làm
            for (let i = 0; i < N; i++)
                expect(MarkerRegistry.claim('output', `g${g}-e${i}`), `g${g}-e${i}`).not.toBeNull();
            await Promise.resolve();
        }
        expect(builds).toBe(CYCLES);                              // 30, KHÔNG phải 30×100
    });

    it('quên invalidateIndex vẫn tự lành, và vẫn bị chặn 1 rebuild / microtask', async () => {
        const CYCLES = 20, N = 50;
        for (let g = 1; g <= CYCLES; g++) {
            document.body.innerHTML = ssr(N, g);                  // KHÔNG gọi invalidateIndex
            for (let i = 0; i < N; i++)
                expect(MarkerRegistry.claim('output', `g${g}-e${i}`), `g${g}-e${i}`).not.toBeNull();
            await Promise.resolve();
        }
        expect(builds).toBeLessThanOrEqual(CYCLES + 1);
    });

    it('miss thật hàng loạt trong CÙNG một lượt chỉ tốn 1 rebuild', () => {
        document.body.innerHTML = ssr(200, 0);
        MarkerRegistry.claim('output', 'g0-e0');
        const after = builds;
        for (let i = 0; i < 1000; i++) expect(MarkerRegistry.claim('output', `khong-co-${i}`)).toBeNull();
        expect(builds - after).toBe(1);
    });
});
