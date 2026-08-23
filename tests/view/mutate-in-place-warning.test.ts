/**
 * Reactivity ở đây là so sánh `===` — mutate tại chỗ (`push`/`splice`/gán field)
 * giữ nguyên reference nên KHÔNG cập nhật gì. Trước đây thất bại hoàn toàn im
 * lặng; giờ phải có đúng 1 cảnh báo cho mỗi key.
 *
 * @see StateManager.warnSameReference
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ViewState } from '../../src/core/view/ViewState';

function makeState(path = 'test.view') {
    const s = new ViewState({ path } as any);
    return s;
}

afterEach(() => vi.restoreAllMocks());

describe('mutate tại chỗ RỒI set lại — phải HOẠT ĐỘNG', () => {
    it('push() rồi set cùng ref → CÓ notify, KHÔNG cảnh báo', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.a');
        const list: any[] = [];
        const set = s.__.register('items', list);

        const seen: any[] = [];
        s.__.subscribe('items', v => seen.push(v));

        list.push({ id: 1 });   // mutate tại chỗ
        set(list);              // set lại chính ref đó (đường dev)
        s.__.flushNow();

        // Gọi setter = tuyên bố "giá trị vừa đổi". So NỘI DUNG (độ sâu 1) với
        // bản chụp thay vì chỉ so reference → nhận ra thay đổi thật.
        // Trước đây bài test này khoá hành vi CŨ (im lặng không làm gì) — đó
        // chính là lỗi khiến `list.splice(i,1); setList(list)` không cập nhật UI.
        expect(seen.length).toBe(1);
        expect(warn).not.toHaveBeenCalled();
    });

    it('splice() rồi set cùng ref → CÓ notify', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.a2');
        const list: any[] = [1, 2, 3];
        const set = s.__.register('items', list);
        s.__.flushNow();               // chụp baseline

        const seen: any[] = [];
        s.__.subscribe('items', v => seen.push(v));

        list.splice(1, 1);
        set(list);
        s.__.flushNow();

        expect(seen.length).toBe(1);
        expect(seen[0]).toEqual([1, 3]);
        expect(warn).not.toHaveBeenCalled();
    });

    it('mutate LỒNG SÂU (a.b.c = x) → nay CÓ notify, không cần set', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.a3');
        const user: any = { profile: { name: 'a' } };
        s.__.register('user', user);
        s.__.flushNow();

        const seen: any[] = [];
        s.__.subscribe('user', v => seen.push(v));

        user.profile.name = 'b';       // độ sâu 2, KHÔNG gọi setter
        s.__.flushNow();

        // Trước đây ca này im lặng HOÀN TOÀN: không cập nhật và cũng không
        // cảnh báo (`shallowDiffers` chỉ so độ sâu 1 nên không thấy gì).
        // `StateManager.observe` nay quan sát đệ quy nên bắt được.
        expect(seen.length).toBe(1);
        expect(warn).not.toHaveBeenCalled();
    });

    it('GIỚI HẠN: thêm KEY MỚI chưa từng có → không bắt được, chỉ cảnh báo', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.a4');
        const user: any = { name: 'a' };
        s.__.register('user', user);
        s.__.register('tick', 0);
        s.__.updateStateByKey('tick', 1);
        s.__.flushNow();               // chụp baseline

        const seen: any[] = [];
        s.__.subscribe('user', v => seen.push(v));

        // Key `extra` chưa tồn tại lúc observe ⇒ không có accessor nào để bắt.
        // Đây là giới hạn cố hữu của defineProperty (Vue 2 phải có `Vue.set`);
        // muốn vượt thì phải dùng Proxy — xem GAPS §2.16b, đã quyết định không.
        user.extra = 'new';
        s.__.updateStateByKey('tick', 2);
        s.__.flushNow();

        expect(seen.length).toBe(0);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('KHÔNG set lại');
    });

    it('chỉ cảnh báo 1 lần cho mỗi key', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.b');
        const list: any[] = [];
        const set = s.__.register('items', list);

        for (let i = 0; i < 5; i++) set(list);

        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('KHÔNG cảnh báo cho primitive — set lại cùng số/chuỗi là bình thường', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.c');
        const setCount = s.__.register('count', 0);
        const setName = s.__.register('name', 'a');
        const setNothing = s.__.register('nothing', null);

        setCount(0);
        setName('a');
        setNothing(null);

        expect(warn).not.toHaveBeenCalled();
    });

    it('KHÔNG cảnh báo trên đường props (updateStateByKey re-pass cùng ref)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.props');
        const user = { id: 1 };
        s.__.register('user', user);

        // Cha truyền lại đúng object cũ — hợp lệ, không phải bug của dev
        s.__.updateStateByKey('user', user);

        expect(warn).not.toHaveBeenCalled();
    });

    it('array MỚI vẫn notify bình thường, không cảnh báo', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.d');
        const list: any[] = [];
        const set = s.__.register('items', list);

        const seen: any[] = [];
        s.__.subscribe('items', v => seen.push(v));
        set([...list, { id: 1 }]);
        s.__.flushNow();

        expect(seen.length).toBe(1);
        expect(warn).not.toHaveBeenCalled();
    });
});

describe('mutate KHÔNG kèm set — phát hiện lúc flush', () => {
    /** Ép một flush do key KHÁC gây ra. */
    function flushViaOtherKey(s: any) {
        s.__.updateStateByKey('tick', Math.random());
        s.__.flushNow();
    }

    it('push() rồi không set gì → nay TỰ CẬP NHẬT, không còn cảnh báo', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.m1');
        const list: any[] = [];
        s.__.register('items', list);
        s.__.register('tick', 0);

        flushViaOtherKey(s);            // chụp baseline
        expect(warn).not.toHaveBeenCalled();

        const seen: any[] = [];
        s.__.subscribe('items', () => seen.push(1));

        list.push({ id: 1 });           // mutate lặng lẽ, KHÔNG set
        s.__.flushNow();

        // Trước đây bài này khoá hành vi CŨ (chỉ cảnh báo, không cập nhật).
        // `StateManager.trackArray` nay vá thẳng các method mutate của mảng nên
        // `push` tự `enqueueChange` — xem tests/view/array-mutation-tracking.test.ts.
        expect(seen.length).toBe(1);
        expect(warn).not.toHaveBeenCalled();
    });

    it('gán qua INDEX (không phải method) vẫn chỉ cảnh báo — giới hạn đã biết', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.m1b');
        const list: any[] = [{ id: 1 }];
        s.__.register('items', list);
        s.__.register('tick', 0);
        flushViaOtherKey(s);

        list[0] = { id: 2 };            // gán index — ngoài tầm với nếu không dùng Proxy
        flushViaOtherKey(s);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('items');
        expect(String(warn.mock.calls[0][0])).toContain('KHÔNG set lại');
    });

    it('bắt cả splice và gán lại phần tử', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.m2');
        const list: any[] = [{ id: 1 }, { id: 2 }];
        s.__.register('items', list);
        s.__.register('tick', 0);
        flushViaOtherKey(s);

        list[0] = { id: 9 };            // ref phần tử đổi, độ dài không đổi
        flushViaOtherKey(s);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('bắt thêm/bớt field của object state', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.m3');
        const user: any = { name: 'a' };
        s.__.register('user', user);
        s.__.register('tick', 0);
        flushViaOtherKey(s);

        user.age = 30;
        flushViaOtherKey(s);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('gán giá trị MỚI (đúng cách) → KHÔNG cảnh báo', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.m4');
        const set = s.__.register('items', [] as any[]);
        s.__.register('tick', 0);
        flushViaOtherKey(s);

        set([{ id: 1 }]);
        s.__.flushNow();
        flushViaOtherKey(s);

        expect(warn).not.toHaveBeenCalled();
    });

    it('primitive không bị soi', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.m5');
        s.__.register('n', 1);
        s.__.register('tick', 0);
        flushViaOtherKey(s);
        flushViaOtherKey(s);
        expect(warn).not.toHaveBeenCalled();
    });
});

describe('subscribe với key chưa register', () => {
    it('nhiều key: không bị nuốt, key register muộn vẫn fire', () => {
        const s = makeState('view.s1');
        const seen: any[] = [];
        // cả hai key đều CHƯA tồn tại lúc subscribe
        s.__.subscribe(['a', 'b'], (v: any) => seen.push(v));

        s.__.register('a', 0);
        s.__.updateStateByKey('a', 1);
        s.__.flushNow();

        expect(seen.length).toBe(1);
    });

    it('nhất quán với đường single-key', () => {
        const s = makeState('view.s2');
        const one: any[] = [];
        const many: any[] = [];
        s.__.subscribe(['solo'], () => one.push(1));
        s.__.subscribe(['x', 'y'], () => many.push(1));

        s.__.register('solo', 0);
        s.__.register('x', 0);
        s.__.updateStateByKey('solo', 1);
        s.__.updateStateByKey('x', 1);
        s.__.flushNow();

        expect(one.length).toBe(1);
        expect(many.length).toBe(1);   // trước đây: 0
    });
});
