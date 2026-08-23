import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { StateManagerInterface, ViewStateInterface, StateListener } from "../contracts/ViewStateInterface";
/**
 * StateManager — manages reactive state for a ViewController.
 *
 * Core reactive primitive — when a state value changes:
 *   1. Batch the change (add to pendingChanges)
 *   2. Schedule a flush via requestAnimationFrame
 *   3. On flush: notify all subscribed listeners
 *   4. Listeners can trigger Reactive.update() → DOM re-render
 *
 * This replaces the old string-based re-render:
 *   OLD: state changes → re-render entire template string → diff/scan DOM
 *   NEW: state changes → notify only affected Reactive regions → targeted DOM update
 *
 * @example
 * const [count, setCount] = viewState.__.useState(0, 'count');
 * viewState.__.subscribe('count', (val) => myReactive.update());
 * setCount(1); // → triggers listener → Reactive re-renders its region only
 */
export declare class StateManager implements StateManagerInterface {
    private states;
    private listeners;
    private multiKeyListeners;
    private pendingChanges;
    private stateIndex;
    private flushRAF;
    private hasPendingFlush;
    private isFlushing;
    private _isDestroyed;
    /** Flag — cho phép update state qua update$xxx chỉ trước lock */
    private _canUpdateStateByKey;
    /** Setter functions exposed for direct property assignment on ViewState */
    setters: Record<string | number, (value: any) => void>;
    /** Reference to owning ViewController */
    controller: ViewControllerInterface | null;
    /** Reference to owning ViewState wrapper */
    private stateInstance;
    /** Properties that should NOT become state keys */
    private ownProperties;
    constructor(stateInstance: ViewState, controller?: ViewControllerInterface | null);
    /** Public getter — compiled output checks this before updateStateByKey */
    get canUpdateStateByKey(): boolean;
    /**
     * Lock — ngăn update$xxx() hoạt động sau initialization.
     * Gọi cuối commitConstructorData().
     */
    lockUpdateRealState(): void;
    /**
     * Unlock — cho phép updateVariableData gọi update$xxx lại.
     * Gọi trước updateVariableData(), lock lại khi xong.
     */
    unlockUpdateRealState(): void;
    /**
     * Bulk state update — set nhiều state keys QUIETLY (không trigger listeners).
     * Dùng trong initialization — set initial values trước khi lock.
     */
    updateRealState(stateMap: Record<string | number, any>): void;
    /**
     * Create a reactive state — similar to React's useState.
     *
     * @returns [currentValue, setValue, stateKey]
     *
     * Also defines a getter/setter on the ViewState instance so that
     * `viewState.count` reads/writes the state reactively.
     */
    useState(value: any, key?: string | number): [any, (newValue: any) => void, string | number];
    /**
     * Register shorthand — pre-declare a state slot, returns setter.
     *
     * Compiler pattern:
     *   const set$count = __STATE__.__.register('count');
     *   // initial value set later in commitConstructorData:
     *   update$count(0);  →  updateStateByKey('count', 0)
     *
     * Value is optional (defaults to undefined until commitConstructorData runs).
     */
    register(key: string | number, value?: any): (newValue: any) => void;
    /** Huỷ subscription của các computed khi destroy. */
    private computedUnsubs;
    /**
     * State dẫn xuất có memo hoá (kiểu Vue `computed`).
     *
     * Chỉ tính lại khi 1 trong `deps` đổi, và **lazy**: đánh dấu bẩn lúc dep
     * đổi, tính thật lúc ĐỌC. Deps đổi 5 lần trong 1 batch → tính 1 lần; đổi
     * mà không ai đọc → không tính.
     *
     * Slot nằm chung `states` với state thường nên `getStateByKey(key)`,
     * `viewState[key]` và `subscribe([key])` đều dùng được — Output/Reactive
     * chỉ cần `stateKeys: [key]`, không cần biết đó là computed.
     *
     * @example
     * states.__.computed('fullName', () => `${first} ${last}`, ['first', 'last']);
     * this.output('o', p, true, ['fullName'], () => states.__.getStateByKey('fullName'));
     */
    computed(key: string, fn: () => any, deps?: string[]): () => any;
    /** Update state by key */
    updateStateByKey(key: string | number, value: any): any;
    /**
     * Get state value by key — supports nested paths: 'user.name', 'items.0.id'
     */
    getStateByKey(key: string | number): any;
    /**
     * Update nested state by dot-path key: 'user.name' → clones root, sets nested, triggers change
     */
    updateStateAddressKey(key: string | number, value: any): void;
    subscribe(key: string | number | string[] | Record<string, StateListener>, callback?: StateListener): () => void;
    unsubscribe(key: string | number | string[] | Record<string, StateListener>, callback?: StateListener): void;
    private _isPaused;
    private dirtyKeys;
    get isPaused(): boolean;
    /** Chuyển sang dirty-mode. Flush nốt pending changes trước để DOM là snapshot nhất quán. */
    pause(): void;
    /**
     * Thoát dirty-mode. Notify listeners cho đúng các key đã đổi trong lúc paused.
     * Trả về danh sách dirty keys (rỗng = không có gì thay đổi, không render).
     */
    resume(): Array<string | number>;
    /** Flush đồng bộ pending changes (huỷ RAF đang chờ nếu có). */
    flushNow(): void;
    private commitStateChange;
    /**
     * Cùng reference nhưng NỘI DUNG (độ sâu 1) đã khác bản chụp gần nhất?
     *
     * Chưa có bản chụp (state chưa qua flush nào) → trả true: thà render thừa
     * một lần còn hơn nuốt mất cập nhật.
     * Cập nhật lại bản chụp NGAY để hai lần mutate liên tiếp trong cùng một tick
     * đều được nhận, không phải đợi flush làm mới.
     */
    private mutatedInPlace;
    /** Key đã cảnh báo rồi — mỗi key tối đa 1 dòng cho cả vòng đời app. */
    private static warnedKeys;
    /**
     * Đến được đây nghĩa là: dev gọi setter, cùng reference, VÀ nội dung ở độ
     * sâu 1 KHÔNG khác gì (`mutatedInPlace` đã trả false). Còn đúng hai khả năng:
     *   - no-op thật (set lại y nguyên) — vô hại;
     *   - mutate LỒNG SÂU (`user.profile.name = 'x'`) — `shallowDiffers` chỉ so
     *     độ sâu 1 nên không thấy. Đây mới là ca cần cảnh báo.
     * Mutate nông (`push`/`splice`/gán phần tử) rồi set KHÔNG còn tới đây nữa —
     * nó đã được `mutatedInPlace` nhận và cập nhật bình thường.
     *
     * Hai lớp lọc để không có dương tính giả:
     *   - chỉ object/array (set lại cùng số/chuỗi là bình thường, vô hại)
     *   - chỉ đường `setValue` (dev tự set). Đường `updateStateByKey` —
     *     `update$x()` lúc init và `__UPDATE_DATA_TRAIT__` khi cha truyền
     *     props — hoàn toàn có thể re-pass đúng ref cũ một cách hợp lệ.
     * Kèm warn-once theo view+key để không spam.
     */
    private warnSameReference;
    /**
     * Đưa key vào hàng đợi flush, KHÔNG so sánh giá trị.
     * Tách khỏi commitStateChange để computed dùng được: so sánh sẽ phải ĐỌC
     * `states[key].value` → kích hoạt tính lại ngay, mất tính lazy.
     */
    private enqueueChange;
    /** Trần số vòng flush nối tiếp trong 1 frame — chặn computed phụ thuộc vòng. */
    private static readonly MAX_CASCADE;
    private executeFlush;
    /** Bản sao nông của lần flush gần nhất, theo key. */
    private mutationSnapshots;
    private static readonly ARRAY_MUTATORS;
    /** Tập "kênh" gắn trên một node — nhiều view/key có thể dùng chung dữ liệu. */
    private static readonly HOOKS;
    /**
     * Một kênh cho MỘT key. Mọi node trong cây đều giữ CÙNG object này, nên gỡ
     * theo dõi chỉ là `notify = null` — O(1), không phải duyệt lại cả cây.
     */
    private trackedChannels;
    /**
     * Key vừa được hook mutate xử lý trong chu kỳ hiện tại — `detectExternalMutation`
     * dựa vào đây để chụp lại mà KHÔNG cảnh báo. Xoá sau mỗi lần quét.
     */
    private hookHandledKeys;
    /** Chỉ quan sát object THUẦN và mảng — tránh phá Date/Map/Set/instance class. */
    private static isObservable;
    /**
     * Gắn (hoặc gỡ) bộ bắt mutate cho giá trị mới của `key`.
     * Gọi ở MỌI chỗ gán `states[key].value`.
     */
    private trackArray;
    /**
     * Ngừng theo dõi một key: GỠ HẲN channel khỏi tập hook của từng node.
     *
     * Chỉ `notify = null` là KHÔNG đủ. Dữ liệu ở đây được truyền bằng THAM CHIẾU
     * TRỰC TIẾP (item của `@foreach` đi thẳng vào view con qua props, mảng có thể
     * nằm trong store dùng chung), nên cùng một object sống qua nhiều lần
     * mount/destroy. Channel chết mà nằm lại thì tập hook phình vô hạn — đo được:
     * 50 lần mount/destroy trên cùng mảng để lại 50 channel. Đúng lớp lỗi mà
     * `tests/view/registry-cleanup.test.ts` canh ("mọi registry phải có trần").
     *
     * Duyệt LẠI TỪ GỐC thay vì nhớ sẵn danh sách node: nhớ danh sách sẽ giữ sống
     * cả những node đã bị gỡ khỏi cây (item xoá khỏi list) cho tới lúc destroy —
     * đổi một rò rỉ này lấy một rò rỉ khác. Node đã rời cây thì không ai còn tham
     * chiếu, GC dọn cùng tập hook của nó.
     */
    private untrackKey;
    /** Gỡ mọi channel của manager này (destroy view). */
    private untrackAllArrays;
    /** Gỡ `channel` khỏi tập hook của `node` và toàn bộ cây con. */
    private static unobserve;
    /**
     * Cài bộ bắt mutate lên `node` và toàn bộ cây con, rồi ghi `channel` vào
     * tập hook của mỗi node. `seen` chặn vòng lặp tham chiếu.
     */
    private static observe;
    private static shallowCopy;
    /**
     * ponytail: chỉ so ĐỘ SÂU 1 — bắt push/splice/shift/sort/gán lại phần tử/
     * thêm-bớt field. KHÔNG bắt `user.profile.name = 'x'`. So sâu cần deep clone
     * mỗi flush; nếu mutate lồng thành vấn đề thật thì đó là lúc cân nhắc Proxy,
     * không phải làm snapshot nặng thêm.
     */
    private static shallowDiffers;
    /**
     * Chạy đầu mỗi flush: mọi state kiểu object được đối chiếu rồi chụp lại.
     * Nghĩa là mutate lặng lẽ sẽ lộ ở lần flush KẾ TIẾP do bất kỳ key nào —
     * gần như luôn xảy ra ngay lần tương tác sau.
     */
    private detectExternalMutation;
    /** Dùng CHUNG `warnedKeys` với warnSameReference — 1 key chỉ kêu 1 lần. */
    private warnMutatedWithoutSet;
    private flushChanges;
    /**
     * Lỗi ném ra từ callback subscribe — đưa về error boundary thay vì nuốt.
     *
     * MỌI factory người dùng chạy khi state đổi đều đi qua đây: Output `{{ }}`,
     * TextElement, Html attr/class/style/prop binding, mirror-sync của computed.
     * Trước đây chỉ `console.error` → DOM giữ giá trị cũ và boundary KHÔNG hề
     * biết (im lặng sai, tệ hơn nổ). Đây là 1 chỗ bao trọn tất cả các đường đó.
     *
     * Không có "fallback content" ở tầng này (không biết vùng DOM nào hỏng) —
     * boundary chỉ được BÁO để log/đặt state lỗi; giá trị trả về bị bỏ qua.
     * Muốn thay nội dung vùng lỗi thì dùng boundary ở Component/Reactive
     * (phase 'render'/'update'), nơi có ranh giới marker rõ ràng.
     */
    private reportListenerError;
    destroy(): void;
    private setsEqual;
    /** Debug: get all state data as plain object */
    toJSON(): Record<string | number, any>;
}
/**
 * ViewState — thin wrapper around StateManager.
 *
 * Provides a clean API surface for view code:
 *   - viewState.count        → getter reads state value
 *   - viewState.count = 5    → setter triggers reactive update
 *   - viewState.__           → access StateManager directly
 *   - viewState.on('count', cb) → subscribe shorthand
 *
 * The StateManager is stored as a non-enumerable `__` property
 * to keep it hidden from serialization/iteration.
 */
export declare class ViewState implements ViewStateInterface {
    __: StateManager;
    [key: string]: any;
    constructor(controller?: ViewControllerInterface | null);
    on(key: string | number | string[] | Record<string, (value: any) => void>, callback?: (value: any) => void): () => void;
    off(key: string | number | string[] | Record<string, (value: any) => void>, callback?: (value: any) => void): void;
    unsubscribe(key: string | number | string[] | Record<string, (value: any) => void>, callback?: (value: any) => void): void;
    /**
     * __useState — wrapper API cho compiled output.
     * Tương tự React useState, return [value, setter].
     *
     * Compiled output: const useState = (value) => __STATE__.__useState(value);
     */
    __useState(value: any, key?: string | number): [any, (newValue: any) => void];
}
//# sourceMappingURL=ViewState.d.ts.map