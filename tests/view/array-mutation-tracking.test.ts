/**
 * Mutate state TẠI CHỖ — mảng (`push`/`splice`/…) lẫn object (`a.b = 'c'`) —
 * phải TỰ ĐỘNG emit change, KHÔNG cần gọi setter.
 *
 * Trước đây `list.push(x)` không đổi reference và không đi qua setter nào nên
 * chỉ được PHÁT HIỆN muộn lúc flush (cảnh báo, không cập nhật UI).
 * Nay các method mutate được vá NGAY TRÊN mảng đó (kỹ thuật Vue 2, KHÔNG dùng
 * Proxy) → gọi xong tự `enqueueChange(key)`.
 *
 * @see StateManager.trackArray
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ViewState } from '../../src/core/view/ViewState';

const makeState = (path = 'test.view') => new ViewState({ path } as any);

afterEach(() => vi.restoreAllMocks());

describe('tự bắt mutate mảng — không cần set lại', () => {
    const MUTATORS: Array<[string, (l: any[]) => void, any[]]> = [
        ['push', (l) => l.push(4), [1, 2, 3, 4]],
        ['pop', (l) => l.pop(), [1, 2]],
        ['shift', (l) => l.shift(), [2, 3]],
        ['unshift', (l) => l.unshift(0), [0, 1, 2, 3]],
        ['splice', (l) => l.splice(1, 1), [1, 3]],
        ['reverse', (l) => l.reverse(), [3, 2, 1]],
        ['sort', (l) => l.sort((a, b) => b - a), [3, 2, 1]],
        ['fill', (l) => l.fill(9, 1), [1, 9, 9]],
        ['copyWithin', (l) => l.copyWithin(0, 1), [2, 3, 3]],
    ];

    for (const [name, mutate, expected] of MUTATORS) {
        it(`${name}() → notify, KHÔNG cần setter`, () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const s = makeState(`view.${name}`);
            const list = [1, 2, 3];
            s.__.register('items', list);

            const seen: any[] = [];
            s.__.subscribe('items', (v) => seen.push(v));

            mutate(list);              // KHÔNG gọi set gì cả
            s.__.flushNow();

            expect(seen.length).toBe(1);
            expect(s.__.getStateByKey('items')).toEqual(expected);
            // Đã xử lý xong thì detectExternalMutation không được kêu nữa
            expect(warn).not.toHaveBeenCalled();
        });
    }

    it('nhiều mutate trong cùng tick → gộp thành MỘT lần notify', () => {
        const s = makeState('view.batch');
        const list: number[] = [];
        s.__.register('items', list);
        const seen: any[] = [];
        s.__.subscribe('items', (v) => seen.push(v));

        list.push(1); list.push(2); list.push(3);
        s.__.flushNow();

        expect(seen.length).toBe(1);              // batch qua pendingChanges
        expect(s.__.getStateByKey('items')).toEqual([1, 2, 3]);
    });

    it('mảng giữ NGUYÊN reference và hành xử như mảng thường', () => {
        const s = makeState('view.identity');
        const list = [1, 2];
        s.__.register('items', list);
        list.push(3);

        expect(s.__.getStateByKey('items')).toBe(list);   // cùng reference
        expect(Array.isArray(list)).toBe(true);
        expect([...list]).toEqual([1, 2, 3]);             // spread không thấy method vá
        expect(JSON.stringify(list)).toBe('[1,2,3]');
        expect(Object.keys(list)).toEqual(['0', '1', '2']);
        for (const k in list) expect(['0', '1', '2']).toContain(k);
    });

    it('thay bằng mảng MỚI → mảng cũ thôi notify, mảng mới được theo dõi', () => {
        const s = makeState('view.swap');
        const oldList = [1];
        const set = s.__.register('items', oldList);
        const seen: any[] = [];
        s.__.subscribe('items', () => seen.push(1));

        const newList = [9];
        set(newList);
        s.__.flushNow();
        expect(seen.length).toBe(1);              // do set

        oldList.push(2);                          // mảng CŨ — không còn liên quan
        s.__.flushNow();
        expect(seen.length).toBe(1);              // không notify thêm

        newList.push(10);                         // mảng MỚI — phải bắt được
        s.__.flushNow();
        expect(seen.length).toBe(2);
    });

    it('destroy → gỡ hook, mutate sau đó không còn notify', () => {
        const s = makeState('view.destroy');
        const list = [1];
        s.__.register('items', list);
        const seen: any[] = [];
        s.__.subscribe('items', () => seen.push(1));

        s.__.destroy();
        expect(() => list.push(2)).not.toThrow();
        expect(seen.length).toBe(0);
    });

    it('GIỚI HẠN đã biết: gán qua index/length KHÔNG bắt được (cần Proxy) — vẫn cảnh báo', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.limit');
        const list = [1, 2, 3];
        s.__.register('items', list);
        s.__.register('tick', 0);

        const seen: any[] = [];
        s.__.subscribe('items', () => seen.push(1));

        list[0] = 99;                              // gán index — ngoài tầm với
        s.__.updateStateByKey('tick', 1);          // ép một flush do key khác
        s.__.flushNow();

        expect(seen.length).toBe(0);               // không notify — đúng như tài liệu
        expect(warn).toHaveBeenCalledTimes(1);     // nhưng CÓ cảnh báo
        expect(String(warn.mock.calls[0][0])).toContain('KHÔNG set lại');
    });
});

describe('tự bắt mutate OBJECT — a.b = "c"', () => {
    it('gán thuộc tính cấp 1 → notify', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const s = makeState('view.obj1');
        const user: any = { name: 'a', age: 1 };
        s.__.register('user', user);
        const seen: any[] = [];
        s.__.subscribe('user', () => seen.push(1));

        user.name = 'c';                 // KHÔNG gọi setter
        s.__.flushNow();

        expect(seen.length).toBe(1);
        expect(s.__.getStateByKey('user').name).toBe('c');
        expect(warn).not.toHaveBeenCalled();
    });

    it('gán LỒNG SÂU a.b.c = x → notify (trước đây im lặng hoàn toàn)', () => {
        const s = makeState('view.obj2');
        const data: any = { user: { profile: { city: 'HN' } } };
        s.__.register('data', data);
        const seen: any[] = [];
        s.__.subscribe('data', () => seen.push(1));

        data.user.profile.city = 'SG';
        s.__.flushNow();

        expect(seen.length).toBe(1);
    });

    it('object lồng trong MẢNG cũng được quan sát', () => {
        const s = makeState('view.obj3');
        const list: any[] = [{ id: 1, done: false }];
        s.__.register('items', list);
        const seen: any[] = [];
        s.__.subscribe('items', () => seen.push(1));

        list[0].done = true;             // sửa field của phần tử
        s.__.flushNow();

        expect(seen.length).toBe(1);
    });

    it('phần tử MỚI push vào cũng được quan sát', () => {
        const s = makeState('view.obj4');
        const list: any[] = [];
        s.__.register('items', list);
        const seen: any[] = [];
        s.__.subscribe('items', () => seen.push(1));

        list.push({ id: 1, done: false });
        s.__.flushNow();
        expect(seen.length).toBe(1);

        list[0].done = true;             // object vừa thêm — phải bắt được
        s.__.flushNow();
        expect(seen.length).toBe(2);
    });

    it('object giữ identity + spread/JSON/keys không đổi', () => {
        const s = makeState('view.obj5');
        const user: any = { name: 'a', age: 1 };
        s.__.register('user', user);
        user.name = 'c';

        expect(s.__.getStateByKey('user')).toBe(user);
        expect({ ...user }).toEqual({ name: 'c', age: 1 });
        expect(JSON.stringify(user)).toBe('{"name":"c","age":1}');
        expect(Object.keys(user)).toEqual(['name', 'age']);
    });

    it('KHÔNG đụng Date/Map/instance class (chỉ object thuần + mảng)', () => {
        const s = makeState('view.obj6');
        class Foo { constructor(public v = 1) {} }
        const payload: any = { d: new Date(0), m: new Map(), f: new Foo() };
        s.__.register('p', payload);

        expect(payload.d instanceof Date).toBe(true);
        expect(payload.m instanceof Map).toBe(true);
        expect(payload.f instanceof Foo).toBe(true);
        expect(() => payload.m.set('k', 1)).not.toThrow();
    });

    it('tham chiếu VÒNG không làm treo', () => {
        const s = makeState('view.obj7');
        const a: any = { name: 'a' };
        a.self = a;                      // vòng
        expect(() => s.__.register('a', a)).not.toThrow();
        const seen: any[] = [];
        s.__.subscribe('a', () => seen.push(1));
        a.name = 'b';
        s.__.flushNow();
        expect(seen.length).toBe(1);
    });
});

/**
 * Kiến trúc này truyền dữ liệu bằng THAM CHIẾU TRỰC TIẾP: item của `@foreach`
 * đi thẳng vào view con qua props, mảng có thể nằm trong store dùng chung.
 * Nên CÙNG MỘT object sống qua nhiều lần mount/destroy — bộ quan sát phải gỡ
 * sạch dấu vết, nếu không tập hook phình vô hạn.
 *
 * Cùng lớp bất biến với tests/view/registry-cleanup.test.ts ("mọi registry
 * phải có trần").
 */
describe('quan sát mutate — dọn sạch theo tham chiếu dùng chung', () => {
    const HOOKS = Symbol.for('sao.mutationHooks');
    const hookCount = (o: any) => (o as any)[HOOKS]?.size ?? 0;

    it('N lần mount/destroy trên CÙNG dữ liệu → hook không tích luỹ', () => {
        const shared: any[] = [{ id: 1 }, { id: 2 }];
        for (let i = 0; i < 50; i++) {
            const s = makeState('view.' + i);
            s.__.register('items', shared);
            s.__.destroy();
        }
        // Đo được TRƯỚC khi vá: 50 (mỗi vòng để lại một channel chết).
        expect(hookCount(shared)).toBe(0);
        expect(hookCount(shared[0])).toBe(0);
    });

    it('thay giá trị → gỡ hook khỏi cây CŨ, kể cả node lồng sâu', () => {
        const s = makeState('view.replace');
        const oldTree: any = { a: { b: { c: 1 } } };
        const set = s.__.register('data', oldTree);
        expect(hookCount(oldTree.a.b)).toBe(1);

        set({ x: 1 });
        expect(hookCount(oldTree.a.b)).toBe(0);   // cây cũ sạch dấu vết
    });

    it('cùng object ở CHA và CON — cha destroy, con vẫn hoạt động', () => {
        const item: any = { id: 1, name: 'a' };
        const parent = makeState('view.p');
        parent.__.register('items', [item]);
        const child = makeState('view.c');
        child.__.register('a', item);            // con nhận CHÍNH tham chiếu đó
        expect(hookCount(item)).toBe(2);

        let cSeen = 0;
        child.__.subscribe('a', () => cSeen++);

        parent.__.destroy();
        expect(hookCount(item)).toBe(1);         // chỉ còn channel của con

        item.name = 'b';
        child.__.flushNow();
        expect(cSeen).toBe(1);
    });

    it('identity nguyên vẹn — điều kiện sống còn của ForeachSlotCache', () => {
        const s = makeState('view.id');
        const item = { id: 1 };
        const list = [item];
        s.__.register('items', list);
        // `ForeachSlotCache.claim()` tái dùng element theo `slot.item === item`,
        // và `__foreach` dùng chính reference item làm cache key khi không có
        // `@key`. Proxy sẽ phá cả hai; defineProperty thì không.
        expect(s.__.getStateByKey('items')).toBe(list);
        expect(s.__.getStateByKey('items')[0]).toBe(item);
    });

    it('mutate KHÔNG được chụp lại cả mảng (O(1), không O(n))', () => {
        const s = makeState('view.hot');
        const big = Array.from({ length: 5000 }, (_, i) => ({ id: i, name: 'n' + i }));
        s.__.register('items', big);

        const t0 = performance.now();
        for (let i = 0; i < 500; i++) big[i].name = 'x' + i;
        const dt = performance.now() - t0;

        // Bản trước gọi shallowCopy(mảng 5000) mỗi lần gán → ~14ms.
        // Ngưỡng rộng rãi để không giòn trên máy CI chậm, vẫn bắt được hồi quy O(n).
        expect(dt).toBeLessThan(50);
    });
});
