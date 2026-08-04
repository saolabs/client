import devtools from "../devtools/hook";
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
export class StateManager {
    constructor(stateInstance, controller) {
        this.states = {};
        this.listeners = new Map();
        this.multiKeyListeners = [];
        this.pendingChanges = new Set();
        this.stateIndex = 0;
        this.flushRAF = null;
        this.hasPendingFlush = false;
        this.isFlushing = false;
        this._isDestroyed = false;
        /** Flag — cho phép update state qua update$xxx chỉ trước lock */
        this._canUpdateStateByKey = true;
        /** Setter functions exposed for direct property assignment on ViewState */
        this.setters = {};
        /** Reference to owning ViewController */
        this.controller = null;
        /** Properties that should NOT become state keys */
        this.ownProperties = ['__', 'on', 'off', 'unsubscribe'];
        /** Huỷ subscription của các computed khi destroy. */
        this.computedUnsubs = [];
        // ─── Pause / Resume (dirty tracking) ────────────────────────
        // Thiết kế: ROUTE_RENDER_FLOW.md §7, §8.2-8.3.
        // Khi paused: state VẪN nhận giá trị mới, nhưng không notify listener —
        // key đổi được ghi vào dirtyKeys. resume() flush đúng các key dirty.
        this._isPaused = false;
        this.dirtyKeys = new Set();
        // ─── Phát hiện mutate tại chỗ KHÔNG kèm set ──────────────────
        // `warnSameReference` chỉ bắt được `list.push(x); setList(list)` — có đi qua
        // setter. Trường hợp còn lại KHÔNG đi qua đâu cả:
        //     list.push(x);   // hết. Không cập nhật, không cảnh báo.
        // Chỗ duy nhất còn quan sát được là lúc flush: so snapshot NÔNG của lần
        // flush trước với giá trị hiện tại. Reference y nguyên mà nội dung đã khác
        // ⇒ ai đó mutate ngoài luồng.
        /** Bản sao nông của lần flush gần nhất, theo key. */
        this.mutationSnapshots = new Map();
        this.stateInstance = stateInstance;
        this.controller = controller ?? null;
    }
    // ─── canUpdateStateByKey ─────────────────────────────────────
    /** Public getter — compiled output checks this before updateStateByKey */
    get canUpdateStateByKey() {
        return this._canUpdateStateByKey;
    }
    /**
     * Lock — ngăn update$xxx() hoạt động sau initialization.
     * Gọi cuối commitConstructorData().
     */
    lockUpdateRealState() {
        this._canUpdateStateByKey = false;
    }
    /**
     * Unlock — cho phép updateVariableData gọi update$xxx lại.
     * Gọi trước updateVariableData(), lock lại khi xong.
     */
    unlockUpdateRealState() {
        this._canUpdateStateByKey = true;
    }
    /**
     * Bulk state update — set nhiều state keys QUIETLY (không trigger listeners).
     * Dùng trong initialization — set initial values trước khi lock.
     */
    updateRealState(stateMap) {
        if (!this._canUpdateStateByKey)
            return;
        for (const key in stateMap) {
            if (stateMap.hasOwnProperty(key) && this.states[key]) {
                this.states[key].value = stateMap[key];
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
    useState(value, key) {
        // If key already exists, return existing state
        if (key !== undefined && key !== null && this.states[key]) {
            return [this.states[key].value, this.states[key].setValue, key];
        }
        const stateKey = String(key ?? this.stateIndex++);
        const setValue = (newValue) => {
            const oldValue = this.states[stateKey].value;
            this.states[stateKey].value = newValue;
            // fromSetter: đây là đường DEV tự set (`state.x = v` / `set$x(v)`).
            // Đường props plumbing (updateStateByKey) re-pass cùng ref là bình
            // thường nên không cảnh báo — xem warnSameReference.
            this.commitStateChange(stateKey, oldValue, true);
        };
        this.states[stateKey] = { value, setValue, key: stateKey };
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
    register(key, value) {
        return this.useState(value, key)[1];
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
    computed(key, fn, deps = []) {
        const existing = this.states[key];
        if (existing) {
            // Khai báo lại (re-render): cập nhật fn tại chỗ, giữ nguyên subscription.
            if (existing.__computed__) {
                existing.__setFn__(fn);
                return () => this.getStateByKey(key);
            }
            console.warn(`[ViewState] computed("${key}") trùng tên với state thường — bỏ qua.`);
            return () => this.getStateByKey(key);
        }
        let compute = fn;
        let cache;
        let dirty = true;
        const slot = {
            key,
            __computed__: true,
            __setFn__: (next) => { compute = next; dirty = true; },
            setValue: () => {
                console.warn(`[ViewState] computed("${key}") là read-only — bỏ qua set.`);
            },
        };
        // Getter trên chính slot → MỌI đường đọc (getStateByKey, proxy,
        // states[key].value trực tiếp) đều nhận giá trị tươi.
        Object.defineProperty(slot, 'value', {
            get: () => {
                if (dirty) {
                    cache = compute();
                    dirty = false;
                }
                return cache;
            },
            enumerable: true,
        });
        this.states[key] = slot;
        this.setters[key] = slot.setValue;
        if (!this.ownProperties.includes(key)) {
            Object.defineProperty(this.stateInstance, key, {
                get: () => this.states[key].value,
                configurable: false,
                enumerable: true,
            });
        }
        if (deps.length > 0) {
            this.computedUnsubs.push(this.subscribe(deps, () => {
                dirty = true;
                this.enqueueChange(key); // báo subscriber; KHÔNG đọc value → giữ lazy
            }));
        }
        return () => this.getStateByKey(key);
    }
    /** Update state by key */
    updateStateByKey(key, value) {
        if (!this.states[key])
            return undefined;
        const oldValue = this.states[key].value;
        this.states[key].value = value;
        this.commitStateChange(key, oldValue);
        return value;
    }
    /**
     * Get state value by key — supports nested paths: 'user.name', 'items.0.id'
     */
    getStateByKey(key) {
        const keyStr = String(key);
        if (!keyStr.includes('.')) {
            return this.states[keyStr]?.value ?? null;
        }
        const paths = keyStr.split('.');
        const rootKey = paths[0];
        if (!this.states[rootKey])
            return null;
        let current = this.states[rootKey].value;
        for (let i = 1; i < paths.length; i++) {
            if (typeof current !== 'object' || current === null)
                return null;
            current = current[paths[i]];
            if (current === undefined)
                return null;
        }
        return current;
    }
    /**
     * Update nested state by dot-path key: 'user.name' → clones root, sets nested, triggers change
     */
    updateStateAddressKey(key, value) {
        const keyStr = String(key);
        const keyPaths = keyStr.split('.');
        const rootKey = keyPaths.shift();
        if (!rootKey || !this.states[rootKey])
            return;
        const stateValue = this.states[rootKey].value;
        if (keyPaths.length === 0 || typeof stateValue !== 'object' || stateValue === null) {
            return this.setters[rootKey]?.(value);
        }
        // Clone to create a new reference for reactivity detection
        let clonedValue = Array.isArray(stateValue) ? [...stateValue] : { ...stateValue };
        let current = clonedValue;
        for (let i = 0; i < keyPaths.length - 1; i++) {
            const path = keyPaths[i];
            if (typeof current[path] !== 'object' || current[path] === null) {
                current[path] = {};
            }
            else {
                current[path] = Array.isArray(current[path]) ? [...current[path]] : { ...current[path] };
            }
            current = current[path];
        }
        current[keyPaths[keyPaths.length - 1]] = value;
        this.setters[rootKey]?.(clonedValue);
    }
    // ─── Subscribe / Unsubscribe ────────────────────────────────
    subscribe(key, callback) {
        // Array of keys
        if (Array.isArray(key)) {
            if (key.length === 0)
                return () => { };
            if (key.length === 1 && callback)
                return this.subscribe(key[0], callback);
            if (typeof callback !== 'function')
                return () => { };
            // KHÔNG lọc theo `this.states[k]`: key chưa register tại thời điểm
            // subscribe vẫn hợp lệ (computed khai báo trong render, state đăng ký
            // muộn). Lọc ở đây làm subscription bị bỏ ÂM THẦM và mất reactivity
            // không dấu vết — trong khi đường single-key ngay dưới chưa bao giờ
            // lọc, nên `subscribe(['a'])` chạy mà `subscribe(['a','b'])` thì không.
            // Key không bao giờ được register thì đơn giản không bao giờ fire:
            // flushChanges() đã kiểm `mkl.keys.has(changedKey)`.
            const keys = new Set(key);
            const listener = { keys, callback, called: false };
            this.multiKeyListeners.push(listener);
            return () => {
                const idx = this.multiKeyListeners.indexOf(listener);
                if (idx !== -1)
                    this.multiKeyListeners.splice(idx, 1);
            };
        }
        // Object map of keys → callbacks
        if (typeof key === 'object' && key !== null) {
            const unsubs = {};
            for (const k in key) {
                unsubs[k] = this.subscribe(k, key[k]);
            }
            return () => { for (const k in unsubs)
                unsubs[k](); };
        }
        // Single key
        if (typeof callback !== 'function')
            return () => { };
        if (!this.listeners.has(key))
            this.listeners.set(key, []);
        this.listeners.get(key).push(callback);
        // Gỡ theo REFERENCE (không theo index chụp lúc đăng ký — listener trước
        // unsubscribe làm index sau lệch → gỡ nhầm listener khác)
        return () => {
            const listeners = this.listeners.get(key);
            if (!listeners)
                return;
            const idx = listeners.indexOf(callback);
            if (idx !== -1)
                listeners.splice(idx, 1);
            if (listeners.length === 0)
                this.listeners.delete(key);
        };
    }
    unsubscribe(key, callback) {
        if (Array.isArray(key)) {
            if (key.length === 0)
                return;
            if (key.length === 1) {
                this.unsubscribe(key[0], callback);
                return;
            }
            const keySet = new Set(key);
            if (!callback) {
                for (let i = this.multiKeyListeners.length - 1; i >= 0; i--) {
                    if (this.setsEqual(this.multiKeyListeners[i].keys, keySet)) {
                        this.multiKeyListeners.splice(i, 1);
                    }
                }
                return;
            }
            const idx = this.multiKeyListeners.findIndex(l => l.callback === callback && this.setsEqual(l.keys, keySet));
            if (idx !== -1)
                this.multiKeyListeners.splice(idx, 1);
            return;
        }
        if (typeof key === 'object' && key !== null) {
            for (const k in key)
                this.unsubscribe(k, key[k]);
            return;
        }
        if (callback) {
            const listeners = this.listeners.get(key);
            if (listeners) {
                const idx = listeners.indexOf(callback);
                if (idx !== -1) {
                    listeners.splice(idx, 1);
                    if (listeners.length === 0)
                        this.listeners.delete(key);
                }
            }
        }
        else {
            this.listeners.delete(key);
        }
    }
    get isPaused() {
        return this._isPaused;
    }
    /** Chuyển sang dirty-mode. Flush nốt pending changes trước để DOM là snapshot nhất quán. */
    pause() {
        if (this._isPaused || this._isDestroyed)
            return;
        this.flushNow();
        this._isPaused = true;
    }
    /**
     * Thoát dirty-mode. Notify listeners cho đúng các key đã đổi trong lúc paused.
     * Trả về danh sách dirty keys (rỗng = không có gì thay đổi, không render).
     */
    resume() {
        if (!this._isPaused || this._isDestroyed)
            return [];
        this._isPaused = false;
        const dirty = Array.from(this.dirtyKeys);
        this.dirtyKeys.clear();
        if (dirty.length > 0) {
            for (const key of dirty)
                this.pendingChanges.add(key);
            this.flushNow();
        }
        return dirty;
    }
    /** Flush đồng bộ pending changes (huỷ RAF đang chờ nếu có). */
    flushNow() {
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
    commitStateChange(key, _oldValue, fromSetter = false) {
        if (this._isDestroyed)
            return;
        const newValue = this.states[key]?.value;
        if (_oldValue === newValue) {
            if (fromSetter)
                this.warnSameReference(key, newValue);
            return;
        }
        this.enqueueChange(key);
    }
    /**
     * Reactivity ở đây là so sánh `===`, KHÔNG deep/Proxy: `list.push(x)` hay
     * `list[0].name = 'x'` giữ nguyên reference → không có gì cập nhật, và
     * trước đây thất bại hoàn toàn im lặng. Đây là lớp bug tốn thời gian nhất
     * của mô hình này (Vue bắt được bằng Proxy; React có eslint + StrictMode).
     *
     * Hai lớp lọc để không có dương tính giả:
     *   - chỉ object/array (set lại cùng số/chuỗi là bình thường, vô hại)
     *   - chỉ đường `setValue` (dev tự set). Đường `updateStateByKey` —
     *     `update$x()` lúc init và `__UPDATE_DATA_TRAIT__` khi cha truyền
     *     props — hoàn toàn có thể re-pass đúng ref cũ một cách hợp lệ.
     * Kèm warn-once theo view+key để không spam.
     */
    warnSameReference(key, value) {
        if (value === null || typeof value !== 'object')
            return;
        const path = this.controller?.path ?? '';
        const warnKey = `${path}::${String(key)}`;
        if (StateManager.warnedKeys.has(warnKey))
            return;
        StateManager.warnedKeys.add(warnKey);
        console.warn(`[ViewState] "${String(key)}"${path ? ` (view "${path}")` : ''} được set bằng CHÍNH ` +
            `reference cũ → không có gì cập nhật. Nếu vừa mutate tại chỗ ` +
            `(push/splice/gán field), hãy tạo array/object MỚI: ` +
            `state.${String(key)} = [...cũ] thay vì cũ.push(...).`);
    }
    /**
     * Đưa key vào hàng đợi flush, KHÔNG so sánh giá trị.
     * Tách khỏi commitStateChange để computed dùng được: so sánh sẽ phải ĐỌC
     * `states[key].value` → kích hoạt tính lại ngay, mất tính lazy.
     */
    enqueueChange(key) {
        if (this._isDestroyed)
            return;
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
    executeFlush() {
        if (this._isDestroyed || this.isFlushing)
            return;
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
                    + `${StateManager.MAX_CASCADE} vòng — nghi computed phụ thuộc vòng:`, Array.from(this.pendingChanges));
                this.pendingChanges.clear();
            }
        }
        finally {
            this.isFlushing = false;
            this.hasPendingFlush = false;
            this.flushRAF = null;
        }
    }
    static shallowCopy(v) {
        return Array.isArray(v) ? v.slice() : { ...v };
    }
    /**
     * ponytail: chỉ so ĐỘ SÂU 1 — bắt push/splice/shift/sort/gán lại phần tử/
     * thêm-bớt field. KHÔNG bắt `user.profile.name = 'x'`. So sâu cần deep clone
     * mỗi flush; nếu mutate lồng thành vấn đề thật thì đó là lúc cân nhắc Proxy,
     * không phải làm snapshot nặng thêm.
     */
    static shallowDiffers(prev, cur) {
        if (Array.isArray(cur)) {
            if (!Array.isArray(prev) || prev.length !== cur.length)
                return true;
            for (let i = 0; i < cur.length; i++)
                if (prev[i] !== cur[i])
                    return true;
            return false;
        }
        if (Array.isArray(prev))
            return true;
        const prevKeys = Object.keys(prev);
        const curKeys = Object.keys(cur);
        if (prevKeys.length !== curKeys.length)
            return true;
        for (const k of curKeys)
            if (prev[k] !== cur[k])
                return true;
        return false;
    }
    /**
     * Chạy đầu mỗi flush: mọi state kiểu object được đối chiếu rồi chụp lại.
     * Nghĩa là mutate lặng lẽ sẽ lộ ở lần flush KẾ TIẾP do bất kỳ key nào —
     * gần như luôn xảy ra ngay lần tương tác sau.
     */
    detectExternalMutation() {
        for (const key in this.states) {
            const slot = this.states[key];
            if (slot?.__computed__)
                continue; // lazy — đọc `.value` sẽ ép tính lại
            const value = slot?.value;
            if (value === null || typeof value !== 'object') {
                this.mutationSnapshots.delete(key);
                continue;
            }
            const snap = this.mutationSnapshots.get(key);
            if (snap && snap.ref === value && StateManager.shallowDiffers(snap.copy, value)) {
                this.warnMutatedWithoutSet(key);
            }
            this.mutationSnapshots.set(key, { ref: value, copy: StateManager.shallowCopy(value) });
        }
    }
    /** Dùng CHUNG `warnedKeys` với warnSameReference — 1 key chỉ kêu 1 lần. */
    warnMutatedWithoutSet(key) {
        const path = this.controller?.path ?? '';
        const warnKey = `${path}::${String(key)}`;
        if (StateManager.warnedKeys.has(warnKey))
            return;
        StateManager.warnedKeys.add(warnKey);
        console.warn(`[ViewState] "${String(key)}"${path ? ` (view "${path}")` : ''} bị thay đổi tại chỗ ` +
            `mà KHÔNG set lại → UI không cập nhật. Thay vì mutate, hãy gán giá trị mới: ` +
            `state.${String(key)} = [...] / { ... }.`);
    }
    flushChanges() {
        if (this.pendingChanges.size === 0)
            return;
        this.detectExternalMutation();
        const changed = Array.from(this.pendingChanges);
        this.pendingChanges.clear();
        devtools.emit('state:changed', {
            viewId: this.controller?.viewId,
            path: this.controller?.path,
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
                    try {
                        listener(currentValue);
                    }
                    catch (e) {
                        this.reportListenerError(e);
                    }
                }
            }
            // Notify multi-key listeners
            for (const mkl of this.multiKeyListeners) {
                if (!mkl.called && mkl.keys.has(changedKey)) {
                    mkl.called = true;
                    const values = {};
                    for (const k of mkl.keys) {
                        if (changed.includes(k)) {
                            values[String(k)] = this.states[k]?.value;
                        }
                    }
                    try {
                        mkl.callback(values);
                    }
                    catch (e) {
                        this.reportListenerError(e);
                    }
                }
            }
        }
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
    reportListenerError(err) {
        const ctrl = this.controller;
        try {
            if (ctrl?.handleError?.(err, { phase: 'update', path: ctrl.path ?? '' })?.handled)
                return;
        }
        catch (e) {
            console.error('[ViewState] onError handler threw:', e);
        }
        console.error('[ViewState] Listener error:', err);
    }
    // ─── Cleanup ────────────────────────────────────────────────
    destroy() {
        this._isDestroyed = true;
        if (this.flushRAF !== null) {
            cancelAnimationFrame(this.flushRAF);
            this.flushRAF = null;
        }
        for (const unsub of this.computedUnsubs) {
            try {
                unsub();
            }
            catch { /* listener đã gỡ */ }
        }
        this.computedUnsubs = [];
        this.listeners.clear();
        this.multiKeyListeners = [];
        this.pendingChanges.clear();
        this.mutationSnapshots.clear();
        this.states = {};
        this.setters = {};
        this.controller = null;
    }
    // ─── Helpers ────────────────────────────────────────────────
    setsEqual(a, b) {
        if (a.size !== b.size)
            return false;
        for (const item of a)
            if (!b.has(item))
                return false;
        return true;
    }
    /** Debug: get all state data as plain object */
    toJSON() {
        const data = {};
        for (const key in this.states)
            data[key] = this.states[key].value;
        return data;
    }
}
/** Key đã cảnh báo rồi — mỗi key tối đa 1 dòng cho cả vòng đời app. */
StateManager.warnedKeys = new Set();
/** Trần số vòng flush nối tiếp trong 1 frame — chặn computed phụ thuộc vòng. */
StateManager.MAX_CASCADE = 20;
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
export class ViewState {
    constructor(controller) {
        const manager = new StateManager(this, controller);
        Object.defineProperty(this, '__', {
            value: manager,
            writable: false,
            configurable: false,
            enumerable: false,
        });
    }
    on(key, callback) {
        return this.__.subscribe(key, callback);
    }
    off(key, callback) {
        this.__.unsubscribe(key, callback);
    }
    unsubscribe(key, callback) {
        this.__.unsubscribe(key, callback);
    }
    /**
     * __useState — wrapper API cho compiled output.
     * Tương tự React useState, return [value, setter].
     *
     * Compiled output: const useState = (value) => __STATE__.__useState(value);
     */
    __useState(value, key) {
        const [val, setter] = this.__.useState(value, key);
        return [val, setter];
    }
}
//# sourceMappingURL=ViewState.js.map