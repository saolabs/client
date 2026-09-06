import type { ViewControllerInterface } from "../contracts/ViewControllerInterface.js";
import type { StateManagerInterface, ViewStateInterface, StateItem, StateListener, MultiKeyStateListener } from "../contracts/ViewStateInterface.js";
import devtools from "../devtools/hook.js";

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
export class StateManager implements StateManagerInterface {
    private states: Record<string | number, StateItem> = {};
    private listeners = new Map<string | number, StateListener[]>();
    private multiKeyListeners: MultiKeyStateListener[] = [];
    private pendingChanges = new Set<string | number>();
    private stateIndex = 0;
    private flushRAF: number | null = null;
    private hasPendingFlush = false;
    private isFlushing = false;
    private _isDestroyed = false;

    /** Flag — cho phép update state qua update$xxx chỉ trước lock */
    private _canUpdateStateByKey: boolean = true;

    /** Setter functions exposed for direct property assignment on ViewState */
    setters: Record<string | number, (value: any) => void> = {};

    /** Reference to owning ViewController */
    controller: ViewControllerInterface | null = null;

    /** Reference to owning ViewState wrapper */
    private stateInstance: ViewState;

    /** Properties that should NOT become state keys */
    private ownProperties: string[] = ['__', 'on', 'off', 'unsubscribe'];

    constructor(stateInstance: ViewState, controller?: ViewControllerInterface | null) {
        this.stateInstance = stateInstance;
        this.controller = controller ?? null;
    }

    // ─── canUpdateStateByKey ─────────────────────────────────────

    /** Public getter — compiled output checks this before updateStateByKey */
    get canUpdateStateByKey(): boolean {
        return this._canUpdateStateByKey;
    }

    /**
     * Lock — ngăn update$xxx() hoạt động sau initialization.
     * Gọi cuối commitConstructorData().
     */
    lockUpdateRealState(): void {
        this._canUpdateStateByKey = false;
    }

    /**
     * Unlock — cho phép updateVariableData gọi update$xxx lại.
     * Gọi trước updateVariableData(), lock lại khi xong.
     */
    unlockUpdateRealState(): void {
        this._canUpdateStateByKey = true;
    }

    /**
     * Bulk state update — set nhiều state keys QUIETLY (không trigger listeners).
     * Dùng trong initialization — set initial values trước khi lock.
     */
    updateRealState(stateMap: Record<string | number, any>): void {
        if (!this._canUpdateStateByKey) return;
        for (const key in stateMap) {
            if (stateMap.hasOwnProperty(key) && this.states[key] && !this.computedNodes.has(key)) {
                this.states[key].value = stateMap[key];
                this.trackArray(key, stateMap[key]);
                this.invalidateComputed(key, false);
            }
        }
    }

    // ─── useState ───────────────────────────────────────────────

    /**
     * Create a reactive state — similar to React's useState.
     * 
     * @returns [currentValue, setValue, stateKey]
     * 
     * Also defines a getter/setter on the ViewState instance so that
     * `viewState.count` reads/writes the state reactively.
     */
    useState(value: any, key?: string | number): [any, (newValue: any) => void, string | number] {
        // If key already exists, return existing state
        if (key !== undefined && key !== null && this.states[key]) {
            return [this.states[key].value, this.states[key].setValue, key];
        }

        const stateKey = String(key ?? this.stateIndex++);

        const setValue = (newValue: any) => {
            const oldValue = this.states[stateKey].value;
            this.states[stateKey].value = newValue;
            this.trackArray(stateKey, newValue);
            // fromSetter: đây là đường DEV tự set (`state.x = v` / `set$x(v)`).
            // Đường props plumbing (updateStateByKey) re-pass cùng ref là bình
            // thường nên không cảnh báo — xem warnSameReference.
            this.commitStateChange(stateKey, oldValue, true);
        };

        this.states[stateKey] = { value, setValue, key: stateKey };

        // Gieo bản chụp NGAY khi khai báo, không đợi flush đầu tiên. `mutatedInPlace`
        // coi "chưa có bản chụp" là ĐÃ ĐỔI (an toàn: thà render thừa còn hơn nuốt
        // cập nhật) — thiếu baseline thì lần set-cùng-ref đầu tiên luôn bị tính là
        // thay đổi, kể cả khi thật ra không đổi gì.
        if (value !== null && typeof value === 'object') {
            this.mutationSnapshots.set(stateKey, {
                ref: value,
                copy: StateManager.shallowCopy(value),
            });
        }
        this.trackArray(stateKey, value);
        this.setters[stateKey] = setValue;

        // Define reactive property on ViewState if not a reserved name
        if (!this.ownProperties.includes(stateKey)) {
            const self = this;
            Object.defineProperty(this.stateInstance, stateKey, {
                get: () => self.states[stateKey].value,
                set: (val) => {
                    if (typeof self.setters[stateKey] === 'function') {
                        self.setters[stateKey](val);
                    }
                },
                configurable: false,
                enumerable: true,
            });
        }

        return [value, setValue, stateKey];
    }

    // ─── State Access ───────────────────────────────────────────

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
    register(key: string | number, value?: any): (newValue: any) => void {
        return this.useState(value, key)[1];
    }

    private computedNodes = new Map<string, { deps: string[]; dirty: () => void }>();
    private computedDependents = new Map<string | number, Set<string>>();

    /** Invalidate the dependency graph synchronously; evaluation remains lazy. */
    private invalidateComputed(key: string | number, notify = true): void {
        const seen = new Set<string | number>([key]);
        const pending: (string | number)[] = [key];
        for (let i = 0; i < pending.length; i++) {
            for (const dependent of this.computedDependents.get(pending[i]) ?? []) {
                if (seen.has(dependent)) continue;
                seen.add(dependent);
                this.computedNodes.get(dependent)?.dirty();
                if (notify) (this._isPaused ? this.dirtyKeys : this.pendingChanges).add(dependent);
                pending.push(dependent);
            }
        }
    }

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
    computed<T>(key: string, fn: () => T, deps: string[] = []): () => T {
        if (this._isDestroyed) throw new Error('[ViewState] Cannot register computed after destroy.');
        // Validate before replacing any edges, including indirect cycles.
        const reaches = (name: string, seen = new Set<string>()): boolean => {
            if (name === key) return true;
            if (seen.has(name)) return false;
            seen.add(name);
            return (this.computedNodes.get(name)?.deps ?? []).some(dep => reaches(dep, seen));
        };
        if (deps.some(dep => reaches(dep))) throw new Error(`[ViewState] Computed dependency cycle: ${key}`);
        const existing = this.states[key] as any;
        if (existing && !existing.__computed__) throw new Error(`[ViewState] State already exists: ${key}`);
        for (const dep of this.computedNodes.get(key)?.deps ?? []) {
            const dependents = this.computedDependents.get(dep);
            dependents?.delete(key);
            if (dependents?.size === 0) this.computedDependents.delete(dep);
        }
        let cache: T;
        let dirty = true;
        let evaluating = false;
        const slot: any = {
            key,
            __computed__: true,
            setValue: () => console.warn(`[ViewState] computed("${key}") is read-only.`),
        };
        Object.defineProperty(slot, 'value', {
            get: () => {
                if (dirty) {
                    if (evaluating) throw new Error(`[ViewState] Recursive computed read: ${key}`);
                    evaluating = true;
                    try { cache = fn(); dirty = false; }
                    finally { evaluating = false; }
                }
                return cache;
            },
            set: slot.setValue,
            enumerable: true,
        });
        this.states[key] = slot;
        this.setters[key] = slot.setValue;
        this.computedNodes.set(key, { deps: [...new Set(deps)], dirty: () => { dirty = true; } });
        for (const dep of deps) {
            if (!this.computedDependents.has(dep)) this.computedDependents.set(dep, new Set());
            this.computedDependents.get(dep)!.add(key);
        }
        if (!existing && !this.ownProperties.includes(key)) {
            Object.defineProperty(this.stateInstance, key, {
                get: () => this.states[key]?.value,
                set: slot.setValue,
                enumerable: true,
            });
        }
        if (existing) this.enqueueChange(key);
        return () => this.getStateByKey(key) as T;
    }

    /** Update state by key */
    updateStateByKey(key: string | number, value: any): any {
        if (!this.states[key]) return undefined;
        if (this.computedNodes.has(String(key))) { this.setters[key](value); return this.states[key].value; }
        const oldValue = this.states[key].value;
        this.states[key].value = value;
        this.trackArray(key, value);
        this.commitStateChange(key, oldValue);
        return value;
    }

    /**
     * Get state value by key — supports nested paths: 'user.name', 'items.0.id'
     */
    getStateByKey(key: string | number): any {
        const keyStr = String(key);

        if (!keyStr.includes('.')) {
            return this.states[keyStr]?.value ?? null;
        }

        const paths = keyStr.split('.');
        const rootKey = paths[0];
        if (!this.states[rootKey]) return null;

        let current = this.states[rootKey].value;
        for (let i = 1; i < paths.length; i++) {
            if (typeof current !== 'object' || current === null) return null;
            current = current[paths[i]];
            if (current === undefined) return null;
        }
        return current;
    }

    /**
     * Update nested state by dot-path key: 'user.name' → clones root, sets nested, triggers change
     */
    updateStateAddressKey(key: string | number, value: any): void {
        const keyStr = String(key);
        const keyPaths = keyStr.split('.');
        const rootKey = keyPaths.shift();
        if (!rootKey || !this.states[rootKey]) return;

        const stateValue = this.states[rootKey].value;
        if (keyPaths.length === 0 || typeof stateValue !== 'object' || stateValue === null) {
            return this.setters[rootKey]?.(value);
        }

        // Clone to create a new reference for reactivity detection
        let clonedValue = Array.isArray(stateValue) ? [...stateValue] : { ...stateValue };
        let current: any = clonedValue;

        for (let i = 0; i < keyPaths.length - 1; i++) {
            const path = keyPaths[i];
            if (typeof current[path] !== 'object' || current[path] === null) {
                current[path] = {};
            } else {
                current[path] = Array.isArray(current[path]) ? [...current[path]] : { ...current[path] };
            }
            current = current[path];
        }
        current[keyPaths[keyPaths.length - 1]] = value;
        this.setters[rootKey]?.(clonedValue);
    }

    // ─── Subscribe / Unsubscribe ────────────────────────────────

    subscribe(
        key: string | number | string[] | Record<string, StateListener>,
        callback?: StateListener
    ): () => void {
        // Array of keys
        if (Array.isArray(key)) {
            if (key.length === 0) return () => {};
            if (key.length === 1 && callback) return this.subscribe(key[0], callback);
            if (typeof callback !== 'function') return () => {};

            // KHÔNG lọc theo `this.states[k]`: key chưa register tại thời điểm
            // subscribe vẫn hợp lệ (computed khai báo trong render, state đăng ký
            // muộn). Lọc ở đây làm subscription bị bỏ ÂM THẦM và mất reactivity
            // không dấu vết — trong khi đường single-key ngay dưới chưa bao giờ
            // lọc, nên `subscribe(['a'])` chạy mà `subscribe(['a','b'])` thì không.
            // Key không bao giờ được register thì đơn giản không bao giờ fire:
            // flushChanges() đã kiểm `mkl.keys.has(changedKey)`.
            const keys = new Set<string | number>(key);

            const listener: MultiKeyStateListener = { keys, callback, called: false };
            this.multiKeyListeners.push(listener);

            return () => {
                const idx = this.multiKeyListeners.indexOf(listener);
                if (idx !== -1) this.multiKeyListeners.splice(idx, 1);
            };
        }

        // Object map of keys → callbacks
        if (typeof key === 'object' && key !== null) {
            const unsubs: Record<string, () => void> = {};
            for (const k in key) {
                unsubs[k] = this.subscribe(k, key[k]);
            }
            return () => { for (const k in unsubs) unsubs[k](); };
        }

        // Single key
        if (typeof callback !== 'function') return () => {};
        if (!this.listeners.has(key)) this.listeners.set(key, []);
        this.listeners.get(key)!.push(callback);

        // Gỡ theo REFERENCE (không theo index chụp lúc đăng ký — listener trước
        // unsubscribe làm index sau lệch → gỡ nhầm listener khác)
        return () => {
            const listeners = this.listeners.get(key);
            if (!listeners) return;
            const idx = listeners.indexOf(callback);
            if (idx !== -1) listeners.splice(idx, 1);
            if (listeners.length === 0) this.listeners.delete(key);
        };
    }

    unsubscribe(
        key: string | number | string[] | Record<string, StateListener>,
        callback?: StateListener
    ): void {
        if (Array.isArray(key)) {
            if (key.length === 0) return;
            if (key.length === 1) { this.unsubscribe(key[0], callback); return; }

            const keySet = new Set(key);
            if (!callback) {
                for (let i = this.multiKeyListeners.length - 1; i >= 0; i--) {
                    if (this.setsEqual(this.multiKeyListeners[i].keys, keySet)) {
                        this.multiKeyListeners.splice(i, 1);
                    }
                }
                return;
            }
            const idx = this.multiKeyListeners.findIndex(l =>
                l.callback === callback && this.setsEqual(l.keys, keySet)
            );
            if (idx !== -1) this.multiKeyListeners.splice(idx, 1);
            return;
        }

        if (typeof key === 'object' && key !== null) {
            for (const k in key) this.unsubscribe(k, key[k]);
            return;
        }

        if (callback) {
            const listeners = this.listeners.get(key);
            if (listeners) {
                const idx = listeners.indexOf(callback);
                if (idx !== -1) {
                    listeners.splice(idx, 1);
                    if (listeners.length === 0) this.listeners.delete(key);
                }
            }
        } else {
            this.listeners.delete(key);
        }
    }

    // ─── Pause / Resume (dirty tracking) ────────────────────────
    // Thiết kế: ROUTE_RENDER_FLOW.md §7, §8.2-8.3.
    // Khi paused: state VẪN nhận giá trị mới, nhưng không notify listener —
    // key đổi được ghi vào dirtyKeys. resume() flush đúng các key dirty.

    private _isPaused = false;
    private dirtyKeys = new Set<string | number>();

    get isPaused(): boolean {
        return this._isPaused;
    }

    /** Chuyển sang dirty-mode. Flush nốt pending changes trước để DOM là snapshot nhất quán. */
    pause(): void {
        if (this._isPaused || this._isDestroyed) return;
        this.flushNow();
        this._isPaused = true;
    }

    /**
     * Thoát dirty-mode. Notify listeners cho đúng các key đã đổi trong lúc paused.
     * Trả về danh sách dirty keys (rỗng = không có gì thay đổi, không render).
     */
    resume(): Array<string | number> {
        if (!this._isPaused || this._isDestroyed) return [];
        this._isPaused = false;

        const dirty = Array.from(this.dirtyKeys);
        this.dirtyKeys.clear();

        if (dirty.length > 0) {
            for (const key of dirty) this.pendingChanges.add(key);
            this.flushNow();
        }
        return dirty;
    }

    /** Flush đồng bộ pending changes (huỷ RAF đang chờ nếu có). */
    flushNow(): void {
        if (this.flushRAF !== null) {
            cancelAnimationFrame(this.flushRAF);
            this.flushRAF = null;
        }
        if (this.pendingChanges.size > 0) {
            this.executeFlush();
        }
        this.hasPendingFlush = false;
    }

    // ─── Batch Flush System ─────────────────────────────────────

    private commitStateChange(key: string | number, _oldValue: any, fromSetter = false): void {
        if (this._isDestroyed) return;
        const newValue = this.states[key]?.value;
        if (_oldValue === newValue) {
            // Cùng reference. Trước đây dừng luôn ⇒ `list.splice(i,1); setList(list)`
            // — cách viết TỰ NHIÊN NHẤT — im lặng không cập nhật gì.
            //
            // Khi dev GỌI SETTER là họ đã tuyên bố ý định "giá trị này vừa đổi".
            // Lúc đó ta đối chiếu NỘI DUNG với bản chụp nông của lần flush trước
            // (`mutationSnapshots` — đã có sẵn cho phần cảnh báo) thay vì chỉ so
            // reference. Khác nội dung ⇒ coi như đổi thật.
            //
            // ĐÂY KHÔNG PHẢI deep reactivity/Proxy (xem GAPS §2.16b — quyết định
            // KHÔNG làm vẫn giữ nguyên): không có dep tracking runtime, không đổi
            // granularity. Vẫn đúng một `enqueueChange(key)` ở tầng key — kết quả
            // y hệt như dev tự viết `state.x = [...state.x]`, chỉ khác là không
            // bắt họ phải nhớ.
            if (fromSetter && this.mutatedInPlace(key, newValue)) {
                this.enqueueChange(key);
                return;
            }
            // Đã có cập nhật ĐANG CHỜ cho key này (thường do hook mutate mảng
            // vừa bắt `push`/`splice` và đã làm mới bản chụp) ⇒ set lại cùng ref
            // chỉ là thừa, KHÔNG phải bug. Không cảnh báo, tránh dương tính giả
            // cho cách viết rất phổ biến: `list.splice(i,1); setList(list)`.
            if (fromSetter && (this.pendingChanges.has(key) || this.dirtyKeys.has(key))) return;
            if (fromSetter) this.warnSameReference(key, newValue);
            return;
        }
        this.enqueueChange(key);
    }

    /**
     * Cùng reference nhưng NỘI DUNG (độ sâu 1) đã khác bản chụp gần nhất?
     *
     * Chưa có bản chụp (state chưa qua flush nào) → trả true: thà render thừa
     * một lần còn hơn nuốt mất cập nhật.
     * Cập nhật lại bản chụp NGAY để hai lần mutate liên tiếp trong cùng một tick
     * đều được nhận, không phải đợi flush làm mới.
     */
    private mutatedInPlace(key: string | number, value: any): boolean {
        if (value === null || typeof value !== 'object') return false;
        const snap = this.mutationSnapshots.get(key);
        const changed = !snap || snap.ref !== value
            || StateManager.shallowDiffers(snap.copy, value);
        if (changed) {
            this.mutationSnapshots.set(key, { ref: value, copy: StateManager.shallowCopy(value) });
        }
        return changed;
    }

    /** Key đã cảnh báo rồi — mỗi key tối đa 1 dòng cho cả vòng đời app. */
    private static warnedKeys = new Set<string>();

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
    private warnSameReference(key: string | number, value: any): void {
        if (value === null || typeof value !== 'object') return;
        const path = (this.controller as any)?.path ?? '';
        const warnKey = `${path}::${String(key)}`;
        if (StateManager.warnedKeys.has(warnKey)) return;
        StateManager.warnedKeys.add(warnKey);
        console.warn(
            `[ViewState] "${String(key)}"${path ? ` (view "${path}")` : ''} được set bằng CHÍNH ` +
            `reference cũ và nội dung ở cấp 1 KHÔNG đổi → không có gì cập nhật. ` +
            `Nếu vừa sửa dữ liệu LỒNG SÂU (vd state.${String(key)}.a.b = ...), hãy tạo ` +
            `object/array MỚI ở cấp ngoài: state.${String(key)} = { ...cũ, a: { ...cũ.a, b } }.`
        );
    }

    /**
     * Đưa key vào hàng đợi flush, KHÔNG so sánh giá trị.
     * Tách khỏi commitStateChange để computed dùng được: so sánh sẽ phải ĐỌC
     * `states[key].value` → kích hoạt tính lại ngay, mất tính lazy.
     */
    private enqueueChange(key: string | number): void {
        if (this._isDestroyed) return;
        this.invalidateComputed(key);

        // Paused → ghi sổ, không notify (giá trị đã được set vào states)
        if (this._isPaused) {
            this.dirtyKeys.add(key);
            return;
        }

        this.pendingChanges.add(key);

        if (!this.hasPendingFlush) {
            this.hasPendingFlush = true;
            this.flushRAF = requestAnimationFrame(() => this.executeFlush());
        }
    }

    /** Trần số vòng flush nối tiếp trong 1 frame — chặn computed phụ thuộc vòng. */
    private static readonly MAX_CASCADE = 20;

    private executeFlush(): void {
        if (this._isDestroyed || this.isFlushing) return;
        try {
            this.isFlushing = true;
            // Listener CÓ THỂ enqueue key mới ngay trong lúc flush (computed
            // phụ thuộc computed). flushChanges() đã snapshot xong nên key mới
            // sẽ nằm lại hàng đợi; lặp cho tới khi lắng, trong CÙNG frame —
            // nếu không, cập nhật dẫn xuất kẹt tới lần state đổi kế tiếp.
            let depth = 0;
            while (this.pendingChanges.size > 0 && depth < StateManager.MAX_CASCADE) {
                this.flushChanges();
                depth++;
            }
            if (this.pendingChanges.size > 0) {
                console.warn('[ViewState] Cascade update chưa lắng sau '
                    + `${StateManager.MAX_CASCADE} vòng — nghi computed phụ thuộc vòng:`,
                    Array.from(this.pendingChanges));
                this.pendingChanges.clear();
            }
        } finally {
            this.isFlushing = false;
            this.hasPendingFlush = false;
            this.flushRAF = null;
        }

        // FIX(F6, docs/FIX_PLAN_2026-08-14.md): state flush chạy trên RAF #1;
        // listener gọi Reactive.update() → ctx.scheduleUpdate() lại đặt RAF #2
        // (ViewController.scheduleUpdate) — trong một frame, Output patch
        // textContent ĐỒNG BỘ ngay trong listener nên đã đổi, còn
        // @foreach/@if (chờ RAF #2) thì CHƯA — DOM tạm thời không nhất quán
        // (đo được: `{{ count }}` đã là "1" nhưng @foreach vẫn list cũ, phải
        // đợi thêm 1 frame nữa). Flush luôn ngay sau khi cascade lắng, CÙNG
        // frame — không đợi RAF kế tiếp. RAF trong scheduleUpdate() vẫn giữ
        // nguyên làm đường dự phòng cho update phát sinh NGOÀI chu kỳ flush
        // state; gặp hàng đợi rỗng (đã flush ở đây) thì chỉ là no-op.
        this.controller?.flushReactiveUpdatesNow?.();
    }

    // ─── Phát hiện mutate tại chỗ KHÔNG kèm set ──────────────────
    // `warnSameReference` chỉ bắt được `list.push(x); setList(list)` — có đi qua
    // setter. Trường hợp còn lại KHÔNG đi qua đâu cả:
    //     list.push(x);   // hết. Không cập nhật, không cảnh báo.
    // Chỗ duy nhất còn quan sát được là lúc flush: so snapshot NÔNG của lần
    // flush trước với giá trị hiện tại. Reference y nguyên mà nội dung đã khác
    // ⇒ ai đó mutate ngoài luồng.

    /** Bản sao nông của lần flush gần nhất, theo key. */
    private mutationSnapshots = new Map<string | number, { ref: any; copy: any }>();

    // ─── Tự bắt mutate TẠI CHỖ (mảng và object) ─────────────────
    //
    // `list.push(x)` / `user.name = 'x'` KHÔNG đổi reference và KHÔNG đi qua
    // setter nào ⇒ trước đây chỉ được PHÁT HIỆN muộn ở `detectExternalMutation`
    // (cảnh báo, không cập nhật). Cách vá — kỹ thuật **Vue 2**, KHÔNG phải Proxy:
    //   - MẢNG: thay các method mutate ngay trên chính mảng đó bằng bản bọc;
    //   - OBJECT: thay từng own-property bằng cặp getter/setter.
    // Gọi/gán xong thì `enqueueChange(key)`.
    //
    // Vì sao hợp kiến trúc này:
    //   - reference KHÔNG đổi ⇒ `ForeachSlotCache` (so `slot.item === item`),
    //     `Array.isArray`, `===` của người dùng đều nguyên vẹn;
    //   - method vá của mảng là own-property KHÔNG enumerable; accessor của
    //     object giữ `enumerable: true` ⇒ spread / `JSON.stringify` /
    //     `Object.keys` / `for…in` đều không thấy gì khác;
    //   - vẫn đúng MỘT `enqueueChange` ở TẦNG KEY GỐC ⇒ granularity không đổi,
    //     không cần dep tracking runtime (giữ nguyên lập luận GAPS §2.16b),
    //     `stateKeys`/contract SSR không đụng tới.
    //
    // Quan sát ĐỆ QUY: `user.profile.name = 'x'` (lồng sâu) trước đây vừa không
    // cập nhật vừa KHÔNG cảnh báo (`shallowDiffers` chỉ so độ sâu 1) — im lặng
    // hoàn toàn, ca tệ nhất. Nay bắt được.
    //
    // GIỚI HẠN (cần Proxy mới vượt, giống hệt Vue 2):
    //   - THÊM KEY MỚI chưa từng có lúc quan sát: `user.extra = 1`;
    //   - gán qua index/length của mảng: `list[0] = x`, `list.length = 0`.
    //   Hai ca này vẫn do `detectExternalMutation` cảnh báo ở lần flush kế.

    private static readonly ARRAY_MUTATORS = [
        'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin',
    ] as const;

    /** Tập "kênh" gắn trên một node — nhiều view/key có thể dùng chung dữ liệu. */
    private static readonly HOOKS = Symbol.for('sao.mutationHooks');

    /**
     * Một kênh cho MỘT key. Mọi node trong cây đều giữ CÙNG object này, nên gỡ
     * theo dõi chỉ là `notify = null` — O(1), không phải duyệt lại cả cây.
     */
    private trackedChannels = new Map<
        string | number,
        { channel: { notify: (() => void) | null }; root: any }
    >();

    /**
     * Key vừa được hook mutate xử lý trong chu kỳ hiện tại — `detectExternalMutation`
     * dựa vào đây để chụp lại mà KHÔNG cảnh báo. Xoá sau mỗi lần quét.
     */
    private hookHandledKeys = new Set<string | number>();

    /** Chỉ quan sát object THUẦN và mảng — tránh phá Date/Map/Set/instance class. */
    private static isObservable(v: any): boolean {
        if (v === null || typeof v !== 'object' || Object.isFrozen(v)) return false;
        if (Array.isArray(v)) return true;
        const proto = Object.getPrototypeOf(v);
        return proto === Object.prototype || proto === null;
    }

    /**
     * Gắn (hoặc gỡ) bộ bắt mutate cho giá trị mới của `key`.
     * Gọi ở MỌI chỗ gán `states[key].value`.
     */
    private trackArray(key: string | number, value: any): void {
        this.untrackKey(key);
        if (!StateManager.isObservable(value)) return;

        const channel: { notify: (() => void) | null } = { notify: null };
        channel.notify = () => {
            if (this._isDestroyed) return;
            // ĐƯỜNG NÓNG — chạy mỗi lần mutate. Chỉ ĐÁNH DẤU (O(1)); tuyệt đối
            // không chụp lại ở đây. Bản trước gọi `shallowCopy(value)` tại chỗ
            // này ⇒ mỗi lần gán một thuộc tính lại copy CẢ mảng: đo được 1000
            // lần gán trên list 10k mất ~28ms. `detectExternalMutation` ở đầu
            // flush vốn đã chụp lại mọi key rồi — chỉ cần cho nó biết key này
            // đã được xử lý để đừng cảnh báo "mutate mà KHÔNG set lại".
            this.hookHandledKeys.add(key);
            this.enqueueChange(key);
        };
        this.trackedChannels.set(key, { channel, root: value });
        StateManager.observe(value, channel, new Set());
    }

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
    private untrackKey(key: string | number): void {
        const prev = this.trackedChannels.get(key);
        if (!prev) return;
        prev.channel.notify = null;                       // chặn notify ngay
        StateManager.unobserve(prev.root, prev.channel, new Set());
        this.trackedChannels.delete(key);
    }

    /** Gỡ mọi channel của manager này (destroy view). */
    private untrackAllArrays(): void {
        for (const key of Array.from(this.trackedChannels.keys())) this.untrackKey(key);
        this.trackedChannels.clear();
    }

    /** Gỡ `channel` khỏi tập hook của `node` và toàn bộ cây con. */
    private static unobserve(node: any, channel: { notify: (() => void) | null }, seen: Set<any>): void {
        if (!StateManager.isObservable(node) || seen.has(node)) return;
        seen.add(node);
        const hooks: Set<{ notify: (() => void) | null }> | undefined = node[StateManager.HOOKS];
        hooks?.delete(channel);
        if (Array.isArray(node)) {
            for (const item of node) StateManager.unobserve(item, channel, seen);
            return;
        }
        for (const prop of Object.keys(node)) StateManager.unobserve(node[prop], channel, seen);
    }

    /**
     * Cài bộ bắt mutate lên `node` và toàn bộ cây con, rồi ghi `channel` vào
     * tập hook của mỗi node. `seen` chặn vòng lặp tham chiếu.
     */
    private static observe(node: any, channel: { notify: (() => void) | null }, seen: Set<any>): void {
        if (!StateManager.isObservable(node) || seen.has(node)) return;
        seen.add(node);

        let hooks: Set<{ notify: (() => void) | null }> | undefined = node[StateManager.HOOKS];
        const fresh = !hooks;
        if (!hooks) {
            hooks = new Set();
            try {
                Object.defineProperty(node, StateManager.HOOKS, {
                    value: hooks, enumerable: false, configurable: true, writable: false,
                });
            } catch {
                return;   // node bị seal → bỏ qua, vẫn còn cảnh báo lúc flush
            }
        }
        hooks!.add(channel);

        // Đường NÓNG — chạy mỗi lần gán/mutate. Duyệt thẳng, không `Array.from`:
        // `notify` chỉ enqueue key, không bao giờ thêm/bớt hook nên không có
        // rủi ro sửa Set đang duyệt.
        const fire = () => {
            const set: Set<{ notify: (() => void) | null }> | undefined = node[StateManager.HOOKS];
            if (!set) return;
            for (const ch of set) ch.notify?.();
        };

        /** Giá trị MỚI gán vào cũng phải được quan sát — chỉ khi nó đáng quan sát. */
        const observeIncoming = (next: any) => {
            if (!StateManager.isObservable(next)) return;   // primitive: thoát sớm, không cấp phát
            const set: Set<{ notify: (() => void) | null }> | undefined = node[StateManager.HOOKS];
            if (!set) return;
            for (const ch of Array.from(set)) {
                if (ch.notify) StateManager.observe(next, ch, new Set());
            }
        };

        if (Array.isArray(node)) {
            if (fresh) {
                for (const name of StateManager.ARRAY_MUTATORS) {
                    const original = (Array.prototype as any)[name];
                    try {
                        Object.defineProperty(node, name, {
                            value: function (this: any[], ...args: any[]) {
                                const result = original.apply(this, args);
                                // Chỉ quan sát phần tử MỚI ĐƯA VÀO (tham số), KHÔNG
                                // quét lại cả mảng — quét lại là O(n) mỗi lần push,
                                // list 10k phần tử sẽ đứng hình. `push`/`unshift`/
                                // `splice`/`fill` truyền giá trị mới qua args; các
                                // method còn lại chỉ nhận số/hàm nên `isObservable`
                                // tự bỏ qua.
                                for (const arg of args) observeIncoming(arg);
                                fire();
                                return result;
                            },
                            enumerable: false, configurable: true, writable: true,
                        });
                    } catch { /* method không ghi đè được → bỏ qua */ }
                }
            }
            for (const item of node) StateManager.observe(item, channel, seen);
            return;
        }

        for (const prop of Object.keys(node)) {
            StateManager.observe(node[prop], channel, seen);
            if (!fresh) continue;                     // accessor đã cài từ lần trước
            const desc = Object.getOwnPropertyDescriptor(node, prop);
            if (!desc || !desc.configurable || desc.get || desc.set) continue;
            let current = desc.value;
            try {
                Object.defineProperty(node, prop, {
                    enumerable: desc.enumerable,      // giữ nguyên → spread/keys không đổi
                    configurable: true,
                    get: () => current,
                    set: (next) => {
                        if (next === current) return;
                        current = next;
                        observeIncoming(next);
                        fire();
                    },
                });
            } catch { /* prop không cấu hình được → bỏ qua */ }
        }
    }

    private static shallowCopy(v: any): any {
        return Array.isArray(v) ? v.slice() : { ...v };
    }

    /**
     * ponytail: chỉ so ĐỘ SÂU 1 — bắt push/splice/shift/sort/gán lại phần tử/
     * thêm-bớt field. KHÔNG bắt `user.profile.name = 'x'`. So sâu cần deep clone
     * mỗi flush; nếu mutate lồng thành vấn đề thật thì đó là lúc cân nhắc Proxy,
     * không phải làm snapshot nặng thêm.
     */
    private static shallowDiffers(prev: any, cur: any): boolean {
        if (Array.isArray(cur)) {
            if (!Array.isArray(prev) || prev.length !== cur.length) return true;
            for (let i = 0; i < cur.length; i++) if (prev[i] !== cur[i]) return true;
            return false;
        }
        if (Array.isArray(prev)) return true;
        const prevKeys = Object.keys(prev);
        const curKeys = Object.keys(cur);
        if (prevKeys.length !== curKeys.length) return true;
        for (const k of curKeys) if (prev[k] !== cur[k]) return true;
        return false;
    }

    /**
     * Chạy đầu mỗi flush: mọi state kiểu object được đối chiếu rồi chụp lại.
     * Nghĩa là mutate lặng lẽ sẽ lộ ở lần flush KẾ TIẾP do bất kỳ key nào —
     * gần như luôn xảy ra ngay lần tương tác sau.
     */
    private detectExternalMutation(): void {
        for (const key in this.states) {
            const slot: any = this.states[key];
            if (slot?.__computed__) continue;   // lazy — đọc `.value` sẽ ép tính lại
            const value = slot?.value;
            if (value === null || typeof value !== 'object') {
                this.mutationSnapshots.delete(key);
                continue;
            }
            const snap = this.mutationSnapshots.get(key);
            if (snap && snap.ref === value
                && !this.hookHandledKeys.has(key)          // hook đã lo → không phải "quên set"
                && StateManager.shallowDiffers(snap.copy, value)) {
                this.warnMutatedWithoutSet(key);
            }
            this.mutationSnapshots.set(key, { ref: value, copy: StateManager.shallowCopy(value) });
        }
        this.hookHandledKeys.clear();
    }

    /** Dùng CHUNG `warnedKeys` với warnSameReference — 1 key chỉ kêu 1 lần. */
    private warnMutatedWithoutSet(key: string | number): void {
        const path = (this.controller as any)?.path ?? '';
        const warnKey = `${path}::${String(key)}`;
        if (StateManager.warnedKeys.has(warnKey)) return;
        StateManager.warnedKeys.add(warnKey);
        console.warn(
            `[ViewState] "${String(key)}"${path ? ` (view "${path}")` : ''} bị thay đổi tại chỗ ` +
            `mà KHÔNG set lại → UI không cập nhật. Thay vì mutate, hãy gán giá trị mới: ` +
            `state.${String(key)} = [...] / { ... }.`
        );
    }

    private flushChanges(): void {
        if (this.pendingChanges.size === 0) return;

        this.detectExternalMutation();

        const changed = Array.from(this.pendingChanges);
        this.pendingChanges.clear();

        devtools.emit('state:changed', {
            viewId: (this.controller as any)?.viewId,
            path: (this.controller as any)?.path,
            detail: { keys: changed.map(String) },
        });

        // Reset multi-key listener flags
        for (const listener of this.multiKeyListeners) {
            listener.called = false;
        }

        // Notify single-key listeners
        for (const changedKey of changed) {
            const listeners = this.listeners.get(changedKey);
            if (listeners) {
                const currentValue = this.states[changedKey]?.value;
                for (const listener of listeners) {
                    try { listener(currentValue); }
                    catch (e) { this.retryAfterReactiveFlush(e, listener, currentValue); }
                }
            }

            // Notify multi-key listeners
            for (const mkl of this.multiKeyListeners) {
                if (!mkl.called && mkl.keys.has(changedKey)) {
                    mkl.called = true;
                    const values: Record<string, any> = {};
                    for (const k of mkl.keys) {
                        if (changed.includes(k as any)) {
                            values[String(k)] = this.states[k]?.value;
                        }
                    }
                    try { mkl.callback(values); }
                    catch (e) { this.retryAfterReactiveFlush(e, mkl.callback, values); }
                }
            }
        }
    }

    /**
     * Vùng reactive re-render ở RAF kế tiếp, còn listener của Output/Text/binding
     * chạy NGAY trong đợt flush này. Nên khi guard đổi chiều
     * (`@if(record !== null)` thành false), factory bên trong vùng —
     * `{{ record['name'] }}` — vẫn chạy một lần với state mới và ném, dù DOM đó
     * chỉ còn sống thêm một frame.
     *
     * Có vùng đang chờ dựng lại thì chạy lại listener SAU đợt đó: element hoặc
     * đã bị destroy (listener no-op), hoặc chạy được với state nhất quán. Còn
     * ném nữa mới là lỗi thật và đi tiếp tới boundary.
     *
     * rAF của flushReactiveUpdates đã đăng ký TRƯỚC (trong chính đợt flush này,
     * lúc vùng gọi scheduleUpdate), nên rAF đăng ký ở đây chạy sau nó.
     *
     * Giới hạn: chỉ bắt được khi vùng bọc đã kịp vào hàng đợi trước listener
     * này — đúng với @if/@foreach bọc ngoài vì chúng subscribe trước con.
     */
    private retryAfterReactiveFlush(err: unknown, listener: (value: any) => void, value: any): void {
        const ctrl: any = this.controller;
        if (!ctrl?.hasPendingReactiveUpdate?.()) {
            this.reportListenerError(err);
            return;
        }
        requestAnimationFrame(() => {
            if (this._isDestroyed) return;
            try { listener(value); }
            catch (e) { this.reportListenerError(e); }
        });
    }

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
    private reportListenerError(err: unknown): void {
        const ctrl: any = this.controller;
        try {
            if (ctrl?.handleError?.(err, { phase: 'update', path: ctrl.path ?? '' })?.handled) return;
        } catch (e) {
            console.error('[ViewState] onError handler threw:', e);
        }
        console.error('[ViewState] Listener error:', err);
    }

    // ─── Cleanup ────────────────────────────────────────────────

    destroy(): void {
        this._isDestroyed = true;
        if (this.flushRAF !== null) {
            cancelAnimationFrame(this.flushRAF);
            this.flushRAF = null;
        }
        this.computedNodes.clear();
        this.computedDependents.clear();
        this.listeners.clear();
        this.multiKeyListeners = [];
        this.pendingChanges.clear();
        this.untrackAllArrays();
        this.hookHandledKeys.clear();
        this.mutationSnapshots.clear();
        this.states = {};
        this.setters = {};
        this.controller = null;
    }

    // ─── Helpers ────────────────────────────────────────────────

    private setsEqual(a: Set<any>, b: Set<any>): boolean {
        if (a.size !== b.size) return false;
        for (const item of a) if (!b.has(item)) return false;
        return true;
    }

    /** Debug: get all state data as plain object */
    toJSON(): Record<string | number, any> {
        const data: Record<string | number, any> = {};
        for (const key in this.states) data[key] = this.states[key].value;
        return data;
    }
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
export class ViewState implements ViewStateInterface {
    __!: StateManager;
    [key: string]: any;

    constructor(controller?: ViewControllerInterface | null) {
        const manager = new StateManager(this, controller);
        Object.defineProperty(this, '__', {
            value: manager,
            writable: false,
            configurable: false,
            enumerable: false,
        });
    }

    on(
        key: string | number | string[] | Record<string, (value: any) => void>,
        callback?: (value: any) => void
    ): () => void {
        return this.__.subscribe(key, callback);
    }

    off(
        key: string | number | string[] | Record<string, (value: any) => void>,
        callback?: (value: any) => void
    ): void {
        this.__.unsubscribe(key, callback);
    }

    unsubscribe(
        key: string | number | string[] | Record<string, (value: any) => void>,
        callback?: (value: any) => void
    ): void {
        this.__.unsubscribe(key, callback);
    }

    /**
     * __useState — wrapper API cho compiled output.
     * Tương tự React useState, return [value, setter].
     *
     * Compiled output: const useState = (value) => __STATE__.__useState(value);
     */
    __useState(value: any, key?: string | number): [any, (newValue: any) => void] {
        const [val, setter] = this.__.useState(value, key);
        return [val, setter];
    }
}
