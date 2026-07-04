/**
 * Tests — Phase 5: ForeachSlotCache + identity-keyed reconciliation.
 *
 * Kiểm tra:
 *   1. Initial render: elements được tạo + cache populated
 *   2. Re-render same list: NO element destroy/recreate (cache hit toàn bộ)
 *   3. Re-render grow: new items appended, old items kept
 *   4. Re-render shrink: removed items destroyed, remaining kept
 *   5. Re-render replace item at index: old item destroyed, new item created
 *   6. Re-render reorder (same refs): DOM reordered, elements reused
 *   7. Empty list → có items → empty list lại
 *   8. DOM state preservation: focus không bị mất khi item unchanged
 *
 * Tham chiếu: client/docs/FOREACH_RECONCILIATION_DESIGN.md §0–§3
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { View } from '../../src/core/view/View';
import { ViewManager } from '../../src/core/view/ViewManager';
import { app } from '../../src/core/helpers/app';
import { HelperService } from '../../src/core/services/HelperService';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import { StoreService } from '../../src/core/services/StoreService';

if (!app.has('Registry')) app.instance('Registry', MarkerRegistry);
if (!app.has('Helper')) app.instance('Helper', new HelperService(app() as any));

// ─── Factory helpers ────────────────────────────────────────────────────────

type Item = { id: number; name: string };

/**
 * Tạo view có một @foreach render list items.
 * Template tương đương:
 *   @foreach($items as $item)
 *     <li data-id="{{ $item.id }}">{{ $item.name }}</li>
 *   @endforeach
 */
function makeListFactory(pathName = 'test.list') {
    return () => {
        const view = new View(pathName, 'view');
        const ctrl = view.__ctrl__;
        const __STATE__ = ctrl.states;

        const set$items = __STATE__.__.register('items');
        let items: Item[] = [];
        const setItems = (s: Item[]) => { items = s; set$items(s); };
        __STATE__.__.setters.setItems = setItems;
        __STATE__.__.setters.items = setItems;

        const lockUpdateRealState = () => __STATE__.__.lockUpdateRealState();
        const update$items = (v: Item[]) => {
            if (__STATE__.__.canUpdateStateByKey) {
                __STATE__.__.updateStateByKey('items', v);
                items = v;
            }
        };

        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() {
                update$items([]);
                lockUpdateRealState();
            },
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((parent: any) => [
                    this.html('ul-root', 'ul', parent, { attrs: { id: { type: 'static', value: 'list' } } },
                        (p: any) => [
                            // @foreach — compiler pattern
                            this.reactive('foreach-items', 'foreach', null, p, ['items'],
                                (pr: any, pe: any) => {
                                    return this.__foreach(items, (item: Item, key: string, idx: number) => [
                                        this.html(`li-${item.id}`, 'li', pe, {
                                            attrs: {
                                                'data-id': { type: 'static', value: String(item.id) },
                                            },
                                        }, (p2: any) => [
                                            this.text(item.name),
                                        ]),
                                    ]);
                                }),
                        ]),
                ]);
            },
        } as any);
        return view;
    };
}

// ─── Setup/teardown ─────────────────────────────────────────────────────────

let container: HTMLElement;
let vm: ViewManager;

function createManager(pathName = 'test.list') {
    container = document.createElement('div');
    document.body.appendChild(container);
    vm = new ViewManager(app() as any);
    vm.setApp(app() as any);
    (app() as any).set('View', vm);
    vm.init({ container, registry: { [pathName]: makeListFactory(pathName) } });
    return { vm, container };
}

const route = (url: string) => ({ $urlPath: url } as any);
const frame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

function getItems() {
    return Array.from(container.querySelectorAll('#list li'));
}

function getCtrl() {
    return vm.getCurrentView()!.__ctrl__;
}

beforeEach(() => {});
afterEach(() => {
    document.body.innerHTML = '';
    BlockManager.destroy();
    StoreService.instance('ViewManager').clear();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ForeachSlotCache — identity-keyed reconciliation', () => {

    it('initial render: danh sách rỗng → 0 items', async () => {
        createManager();
        await vm.mountView('test.list', {}, route('/'));
        expect(getItems().length).toBe(0);
    });

    it('initial render: setItems([A, B]) → 2 li items với đúng nội dung', async () => {
        createManager();
        await vm.mountView('test.list', {}, route('/'));

        const ctrl = getCtrl();
        ctrl.states.__.setters.setItems([
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
        ]);
        await frame();

        const lis = getItems();
        expect(lis.length).toBe(2);
        expect(lis[0].textContent).toBe('Alice');
        expect(lis[1].textContent).toBe('Bob');
        expect((lis[0] as HTMLElement).getAttribute('data-id')).toBe('1');
    });

    it('re-render same list reference: items không thay đổi → elements được reuse', async () => {
        createManager();
        await vm.mountView('test.list', {}, route('/'));

        const ctrl = getCtrl();
        const A = { id: 1, name: 'Alice' };
        const B = { id: 2, name: 'Bob' };

        ctrl.states.__.setters.setItems([A, B]);
        await frame();

        // Ghi nhớ DOM nodes của items trước
        const li0Before = getItems()[0];
        const li1Before = getItems()[1];

        // Set cùng array nhưng object references giữ nguyên
        ctrl.states.__.setters.setItems([A, B]);
        await frame();

        const li0After = getItems()[0];
        const li1After = getItems()[1];

        // DOM nodes phải là CÙNG objects (reused, không recreate)
        expect(li0After).toBe(li0Before);
        expect(li1After).toBe(li1Before);
    });

    it('grow list: thêm item cuối → old items được reuse, new item được create', async () => {
        createManager();
        await vm.mountView('test.list', {}, route('/'));

        const ctrl = getCtrl();
        const A = { id: 1, name: 'Alice' };
        const B = { id: 2, name: 'Bob' };

        ctrl.states.__.setters.setItems([A, B]);
        await frame();

        // Ghi nhớ DOM nodes cũ
        const li0Before = getItems()[0];
        const li1Before = getItems()[1];

        // Thêm item mới C
        const C = { id: 3, name: 'Charlie' };
        ctrl.states.__.setters.setItems([A, B, C]);
        await frame();

        const lis = getItems();
        expect(lis.length).toBe(3);
        expect(lis[2].textContent).toBe('Charlie');

        // Old items phải được reuse (same DOM node)
        expect(lis[0]).toBe(li0Before);
        expect(lis[1]).toBe(li1Before);
    });

    it('shrink list: xoá item cuối → old items được reuse, removed item khỏi DOM', async () => {
        createManager();
        await vm.mountView('test.list', {}, route('/'));

        const ctrl = getCtrl();
        const A = { id: 1, name: 'Alice' };
        const B = { id: 2, name: 'Bob' };
        const C = { id: 3, name: 'Charlie' };

        ctrl.states.__.setters.setItems([A, B, C]);
        await frame();

        const li0Before = getItems()[0];
        const li1Before = getItems()[1];
        const li2Before = getItems()[2] as HTMLElement; // Charlie — sẽ bị removed

        // Xoá Charlie
        ctrl.states.__.setters.setItems([A, B]);
        await frame();

        const lis = getItems();
        expect(lis.length).toBe(2);

        // Alice và Bob được reuse
        expect(lis[0]).toBe(li0Before);
        expect(lis[1]).toBe(li1Before);

        // Charlie không còn trong DOM
        expect(container.contains(li2Before)).toBeFalsy();
    });

    it('replace item at index: khác ref → old destroyed, new created', async () => {
        createManager();
        await vm.mountView('test.list', {}, route('/'));

        const ctrl = getCtrl();
        const A = { id: 1, name: 'Alice' };
        const B = { id: 2, name: 'Bob' };

        ctrl.states.__.setters.setItems([A, B]);
        await frame();

        const li1Before = getItems()[1] as HTMLElement; // Bob — sẽ bị replace

        // Thay B bằng object mới (B2 khác ref)
        const B2 = { id: 2, name: 'Bobby' };
        ctrl.states.__.setters.setItems([A, B2]);
        await frame();

        const lis = getItems();
        expect(lis.length).toBe(2);
        expect(lis[1].textContent).toBe('Bobby');

        // li cho B2 phải là node MỚI (không phải li của Bob)
        expect(lis[1]).not.toBe(li1Before);
        // li của Bob không còn trong DOM
        expect(container.contains(li1Before)).toBeFalsy();
    });

    it('reorder list: same refs, khác thứ tự → elements moved, nội dung đúng', async () => {
        createManager();
        await vm.mountView('test.list', {}, route('/'));

        const ctrl = getCtrl();
        const A = { id: 1, name: 'Alice' };
        const B = { id: 2, name: 'Bob' };
        const C = { id: 3, name: 'Charlie' };

        ctrl.states.__.setters.setItems([A, B, C]);
        await frame();

        // Ghi nhớ DOM nodes
        const liA = getItems()[0];
        const liB = getItems()[1];
        const liC = getItems()[2];

        // Reorder: [C, A, B]
        ctrl.states.__.setters.setItems([C, A, B]);
        await frame();

        const lis = getItems();
        expect(lis.length).toBe(3);
        expect(lis[0].textContent).toBe('Charlie');
        expect(lis[1].textContent).toBe('Alice');
        expect(lis[2].textContent).toBe('Bob');

        // Same DOM nodes (reused), chỉ vị trí đổi
        expect(lis[0]).toBe(liC);
        expect(lis[1]).toBe(liA);
        expect(lis[2]).toBe(liB);
    });

    it('empty → items → empty: full lifecycle không crash', async () => {
        createManager();
        await vm.mountView('test.list', {}, route('/'));
        const ctrl = getCtrl();
        const A = { id: 1, name: 'Alice' };

        // Empty → items
        ctrl.states.__.setters.setItems([A]);
        await frame();
        expect(getItems().length).toBe(1);

        // Items → empty
        ctrl.states.__.setters.setItems([]);
        await frame();
        expect(getItems().length).toBe(0);

        // Empty → items lại
        ctrl.states.__.setters.setItems([A]);
        await frame();
        expect(getItems().length).toBe(1);
        expect(getItems()[0].textContent).toBe('Alice');
    });

    it('DOM state preservation: input value trong item không bị reset khi render item khác', async () => {
        // View có list với input field bên trong
        const pathName = 'test.list-input';
        const listFactory = () => {
            const view = new View(pathName, 'view');
            const ctrl = view.__ctrl__;
            const __STATE__ = ctrl.states;

            const set$items = __STATE__.__.register('items');
            let items: Item[] = [];
            const setItems = (s: Item[]) => { items = s; set$items(s); };
            __STATE__.__.setters.setItems = setItems;

            const update$items = (v: Item[]) => {
                if (__STATE__.__.canUpdateStateByKey) {
                    __STATE__.__.updateStateByKey('items', v);
                    items = v;
                }
            };

            ctrl.setup({
                superView: null,
                data: {},
                commitConstructorData() { update$items([]); __STATE__.__.lockUpdateRealState(); },
                updateVariableData() {},
                prerender() { return null; },
                render(this: any) {
                    return this.wrapper((parent: any) => [
                        this.html('ul-root', 'ul', parent, {},
                            (p: any) => [
                                this.reactive('foreach-items', 'foreach', null, p, ['items'],
                                    (pr: any, pe: any) => {
                                        return this.__foreach(items, (item: Item, _key: string, idx: number) => [
                                            this.html(`li-${item.id}`, 'li', pe, {},
                                                (p2: any) => [
                                                    // input KHÔNG bind state — để test DOM state preservation
                                                    this.html(`input-${item.id}`, 'input', p2, {
                                                        attrs: {
                                                            type: { type: 'static', value: 'text' },
                                                            id: { type: 'static', value: `inp-${item.id}` },
                                                        },
                                                    }),
                                                    this.text(item.name),
                                                ]),
                                        ]);
                                    }),
                            ]),
                    ]);
                },
            } as any);
            return view;
        };

        container = document.createElement('div');
        document.body.appendChild(container);
        const localVm = new ViewManager(app() as any);
        localVm.setApp(app() as any);
        (app() as any).set('View', localVm);
        localVm.init({ container, registry: { [pathName]: listFactory } });
        await localVm.mountView(pathName, {}, route('/'));

        const ctrl = localVm.getCurrentView()!.__ctrl__;
        const A = { id: 1, name: 'Alice' };
        const B = { id: 2, name: 'Bob' };

        ctrl.states.__.setters.setItems([A, B]);
        await frame();

        // User "types" into Alice's input
        const inputA = container.querySelector('#inp-1') as HTMLInputElement;
        inputA.value = 'typed text';

        // Thêm item C (không làm thay đổi A và B's refs)
        const C = { id: 3, name: 'Charlie' };
        ctrl.states.__.setters.setItems([A, B, C]);
        await frame();

        // Alice's input vẫn là cùng DOM node → value không bị reset
        const inputAAfter = container.querySelector('#inp-1') as HTMLInputElement;
        expect(inputAAfter).toBe(inputA);        // same DOM node
        expect(inputAAfter.value).toBe('typed text'); // value preserved!
    });
});

// ─── Phase 5b: field-keyed (@key) + occurrence + prune ──────────────────────

/**
 * View với @foreach CÓ @key(item.id) — compiler emit keyFn arg thứ 3.
 * Template tương đương:
 *   @foreach(items as item) @key(item.id) <li>{{ item.name }}</li> @endforeach
 */
function makeKeyedListFactory(pathName = 'test.keyed-list') {
    return () => {
        const view = new View(pathName, 'view');
        const ctrl = view.__ctrl__;
        const __STATE__ = ctrl.states;

        const set$items = __STATE__.__.register('items');
        let items: Item[] = [];
        const setItems = (s: Item[]) => { items = s; set$items(s); };
        __STATE__.__.setters.setItems = setItems;

        const update$items = (v: Item[]) => {
            if (__STATE__.__.canUpdateStateByKey) {
                __STATE__.__.updateStateByKey('items', v);
                items = v;
            }
        };

        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() { update$items([]); __STATE__.__.lockUpdateRealState(); },
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((parent: any) => [
                    this.html('ul-root', 'ul', parent, { attrs: { id: { type: 'static', value: 'list' } } },
                        (p: any) => [
                            this.reactive('foreach-items', 'foreach', null, p, ['items'],
                                (pr: any, pe: any) => {
                                    return this.__foreach(items, (item: Item) => [
                                        this.html(`li-${item.id}`, 'li', pe, {}, (p2: any) => [
                                            this.text(item.name),
                                        ]),
                                    ], (item: Item) => item.id); // ← keyFn từ @key(item.id)
                                }),
                        ]),
                ]);
            },
        } as any);
        return view;
    };
}

/** View @foreach danh sách PRIMITIVE (không keyFn — identity + occurrence). */
function makePrimitiveListFactory(pathName = 'test.prim-list') {
    return () => {
        const view = new View(pathName, 'view');
        const ctrl = view.__ctrl__;
        const __STATE__ = ctrl.states;

        const set$tags = __STATE__.__.register('tags');
        let tags: string[] = [];
        const setTags = (s: string[]) => { tags = s; set$tags(s); };
        __STATE__.__.setters.setTags = setTags;

        const update$tags = (v: string[]) => {
            if (__STATE__.__.canUpdateStateByKey) {
                __STATE__.__.updateStateByKey('tags', v);
                tags = v;
            }
        };

        ctrl.setup({
            superView: null,
            data: {},
            commitConstructorData() { update$tags([]); __STATE__.__.lockUpdateRealState(); },
            updateVariableData() {},
            prerender() { return null; },
            render(this: any) {
                return this.wrapper((parent: any) => [
                    this.html('ul-root', 'ul', parent, { attrs: { id: { type: 'static', value: 'list' } } },
                        (p: any) => [
                            this.reactive('foreach-tags', 'foreach', null, p, ['tags'],
                                (pr: any, pe: any) => {
                                    return this.__foreach(tags, (tag: string, _k: string, idx: number) => [
                                        this.html(`li-${idx + 1}`, 'li', pe, {}, (p2: any) => [
                                            this.text(tag),
                                        ]),
                                    ]);
                                }),
                        ]),
                ]);
            },
        } as any);
        return view;
    };
}

describe('ForeachSlotCache — field-keyed (@key) reconciliation (Phase 5b)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
    });

    function createKeyed() {
        const pathName = 'test.keyed-list';
        container = document.createElement('div');
        document.body.appendChild(container);
        vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({ container, registry: { [pathName]: makeKeyedListFactory(pathName) } });
        return pathName;
    }

    it('same refs: reuse DOM nodes (fast path như identity)', async () => {
        const path = createKeyed();
        await vm.mountView(path, {}, route('/'));
        const ctrl = getCtrl();
        const A = { id: 1, name: 'Alice' };
        const B = { id: 2, name: 'Bob' };

        ctrl.states.__.setters.setItems([A, B]);
        await frame();
        const li0 = getItems()[0];

        ctrl.states.__.setters.setItems([A, B]);
        await frame();
        expect(getItems()[0]).toBe(li0);
    });

    it('ref đổi cùng key → recreate với content MỚI, node cũ khỏi DOM', async () => {
        const path = createKeyed();
        await vm.mountView(path, {}, route('/'));
        const ctrl = getCtrl();
        const A = { id: 1, name: 'Alice' };

        ctrl.states.__.setters.setItems([A]);
        await frame();
        const liBefore = getItems()[0] as HTMLElement;

        // Immutable update: object mới cùng id, content đổi
        ctrl.states.__.setters.setItems([{ id: 1, name: 'Alicia' }]);
        await frame();

        const lis = getItems();
        expect(lis.length).toBe(1);
        expect(lis[0].textContent).toBe('Alicia'); // content mới (không stale)
        expect(container.contains(liBefore)).toBeFalsy();
    });

    it('keyed reorder same refs: DOM move, không recreate', async () => {
        const path = createKeyed();
        await vm.mountView(path, {}, route('/'));
        const ctrl = getCtrl();
        const A = { id: 1, name: 'Alice' };
        const B = { id: 2, name: 'Bob' };

        ctrl.states.__.setters.setItems([A, B]);
        await frame();
        const liA = getItems()[0];
        const liB = getItems()[1];

        ctrl.states.__.setters.setItems([B, A]);
        await frame();
        expect(getItems()[0]).toBe(liB);
        expect(getItems()[1]).toBe(liA);
    });

    it('prune: item rời list → slot bị destroy, cache không leak', async () => {
        const path = createKeyed();
        await vm.mountView(path, {}, route('/'));
        const ctrl = getCtrl();
        const A = { id: 1, name: 'Alice' };
        const B = { id: 2, name: 'Bob' };
        const C = { id: 3, name: 'Charlie' };

        ctrl.states.__.setters.setItems([A, B, C]);
        await frame();

        // Registry id có prefix viewId (RUNTIME_CONTRACT §5)
        const reactiveEl: any = (ctrl as any).elements.get(`${(ctrl as any).viewId}-foreach-items`);
        expect(reactiveEl._foreachCache.size).toBe(3);

        ctrl.states.__.setters.setItems([A]);
        await frame();

        // Slot của B, C bị prune — cache chỉ còn A (trước fix: leak vĩnh viễn)
        expect(reactiveEl._foreachCache.size).toBe(1);
        expect(getItems().length).toBe(1);
    });
});

describe('ForeachSlotCache — duplicate items (occurrence keying)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        BlockManager.destroy();
        StoreService.instance('ViewManager').clear();
    });

    function createPrim() {
        const pathName = 'test.prim-list';
        container = document.createElement('div');
        document.body.appendChild(container);
        vm = new ViewManager(app() as any);
        vm.setApp(app() as any);
        (app() as any).set('View', vm);
        vm.init({ container, registry: { [pathName]: makePrimitiveListFactory(pathName) } });
        return pathName;
    }

    it('primitive trùng nhau render đủ số lượng (không collision Map key)', async () => {
        const path = createPrim();
        await vm.mountView(path, {}, route('/'));
        const ctrl = getCtrl();

        ctrl.states.__.setters.setTags(['a', 'b', 'a']);
        await frame();

        const lis = getItems();
        expect(lis.length).toBe(3);
        expect(lis.map(l => l.textContent)).toEqual(['a', 'b', 'a']);
    });

    it('duplicate shrink: [a,a] → [a] còn đúng 1', async () => {
        const path = createPrim();
        await vm.mountView(path, {}, route('/'));
        const ctrl = getCtrl();

        ctrl.states.__.setters.setTags(['a', 'a']);
        await frame();
        expect(getItems().length).toBe(2);

        ctrl.states.__.setters.setTags(['a']);
        await frame();
        expect(getItems().length).toBe(1);
        expect(getItems()[0].textContent).toBe('a');
    });

    it('duplicate reuse: [a,a] re-render giữ nguyên cả 2 nodes', async () => {
        const path = createPrim();
        await vm.mountView(path, {}, route('/'));
        const ctrl = getCtrl();

        ctrl.states.__.setters.setTags(['a', 'a']);
        await frame();
        const li0 = getItems()[0];
        const li1 = getItems()[1];
        expect(li0).not.toBe(li1);

        ctrl.states.__.setters.setTags(['a', 'a']);
        await frame();
        expect(getItems()[0]).toBe(li0);
        expect(getItems()[1]).toBe(li1);
    });
});
