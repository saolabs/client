/**
 * DevTools runtime hook (GAP-05).
 *
 * Nền tảng cho MỌI UI devtools (overlay in-page, browser extension sau này):
 * runtime chỉ phát sự kiện + cho phép đọc snapshot, KHÔNG biết gì về UI.
 *
 * Thiết kế:
 *   - **Tắt mặc định, zero-cost.** `emit()` thoát ngay ở dòng đầu khi chưa bật.
 *     Không tạo object, không serialize — không được làm chậm production.
 *   - Bật bằng `App.devtools.enable()` hoặc đặt sẵn `window.__SAOLA_DEVTOOLS_HOOK__`
 *     TRƯỚC khi app boot (cách extension sẽ dùng: content script inject sớm).
 *   - Snapshot đọc từ ViewManager/ViewController, không giữ state riêng →
 *     không có nguồn sự thật thứ hai để lệch.
 */

export type DevtoolsEventType =
    | 'view:mounted' | 'view:destroyed'
    | 'state:changed'
    | 'error';

export interface DevtoolsEvent {
    type: DevtoolsEventType;
    /** ms từ lúc trang load — đủ để xếp thứ tự trên timeline */
    at: number;
    viewId?: string;
    path?: string;
    /** state:changed → key nào đổi; error → phase */
    detail?: any;
}

export interface DevtoolsViewNode {
    viewId: string;
    path: string;
    viewType: string;
    lifecycleState: string;
    /** Ảnh chụp state hiện tại (đã lọc giá trị không serialize được) */
    state: Record<string, any>;
    /** Số element đang giữ trong registry — dò rò rỉ */
    elementCount: number;
    children: DevtoolsViewNode[];
}

type Listener = (e: DevtoolsEvent) => void;

const MAX_LOG = 200;

class DevtoolsHook {
    private enabled = false;
    private listeners: Listener[] = [];
    /** Vòng đệm — devtools mở muộn vẫn xem được lịch sử gần đây */
    private log: DevtoolsEvent[] = [];
    /** ViewManager, gán lúc boot; dùng any để tránh vòng import */
    private viewManager: any = null;

    isEnabled(): boolean { return this.enabled; }

    enable(): void { this.enabled = true; }
    disable(): void { this.enabled = false; this.log = []; }

    /** ViewManager tự đăng ký lúc init — hook không đi tìm global. */
    attach(viewManager: any): void { this.viewManager = viewManager; }

    subscribe(fn: Listener): () => void {
        this.listeners.push(fn);
        return () => { this.listeners = this.listeners.filter(l => l !== fn); };
    }

    /** Hot path — phải rẻ khi tắt. */
    emit(type: DevtoolsEventType, data?: Omit<DevtoolsEvent, 'type' | 'at'>): void {
        if (!this.enabled) return;
        const event: DevtoolsEvent = { type, at: Math.round(performance.now()), ...data };
        this.log.push(event);
        if (this.log.length > MAX_LOG) this.log.shift();
        for (const fn of this.listeners) {
            try { fn(event); } catch (e) { console.error('[Devtools] listener error:', e); }
        }
    }

    getLog(): DevtoolsEvent[] { return [...this.log]; }
    clearLog(): void { this.log = []; }

    /** Cây view đang mount: layout chain (ngoài → trong) rồi tới page. */
    getViewTree(): DevtoolsViewNode[] {
        const vm = this.viewManager;
        if (!vm) return [];
        const roots: any[] = [...(vm.getLayoutChain?.() ?? []), vm.getCurrentView?.()].filter(Boolean);
        // Layout chain và page nối nhau theo thứ tự mount, không phải quan hệ
        // parent/children (quan hệ đó chỉ dùng cho @include) → dựng phẳng ở
        // gốc, rồi mỗi node mở rộng theo ctrl.children thật.
        return roots.map(v => this.toNode(v.__ctrl__));
    }

    private toNode(ctrl: any): DevtoolsViewNode {
        return {
            viewId: ctrl.viewId,
            path: ctrl.path,
            viewType: ctrl.viewType,
            lifecycleState: ctrl.lifecycleState,
            state: this.snapshotState(ctrl),
            elementCount: ctrl.elements?.size ?? 0,
            children: (ctrl.children ?? []).map((c: any) => this.toNode(c)),
        };
    }

    /**
     * Ảnh chụp state — mọi giá trị đi qua JSON round-trip để cắt tham chiếu
     * DOM/hàm/vòng lặp: devtools không được giữ sống object của app, và
     * không được nổ khi state chứa cấu trúc vòng.
     */
    private snapshotState(ctrl: any): Record<string, any> {
        const out: Record<string, any> = {};
        const states = ctrl.states?.__?.states ?? {};
        for (const key of Object.keys(states)) {
            try {
                const value = states[key]?.value; // computed: getter → tính lại ở đây
                out[key] = value === undefined ? undefined : JSON.parse(JSON.stringify(value));
            } catch {
                out[key] = '[không serialize được]';
            }
        }
        return out;
    }
}

export const devtools = new DevtoolsHook();

/**
 * Nếu môi trường đã cắm sẵn `window.__SAOLA_DEVTOOLS_HOOK__` trước khi app boot
 * (browser extension làm vậy), tự bật và nối sự kiện sang đó.
 */
if (typeof window !== 'undefined') {
    const external = (window as any).__SAOLA_DEVTOOLS_HOOK__;
    if (external) {
        devtools.enable();
        devtools.subscribe((e) => { try { external.onEvent?.(e); } catch { /* của bên thứ 3 */ } });
        external.getViewTree = () => devtools.getViewTree();
        external.getLog = () => devtools.getLog();
    }
    (window as any).__SAOLA_DEVTOOLS__ = devtools;
}

export default devtools;
