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
export type DevtoolsEventType = 'view:mounted' | 'view:destroyed' | 'state:changed' | 'error';
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
declare class DevtoolsHook {
    private enabled;
    private listeners;
    /** Vòng đệm — devtools mở muộn vẫn xem được lịch sử gần đây */
    private log;
    /** ViewManager, gán lúc boot; dùng any để tránh vòng import */
    private viewManager;
    isEnabled(): boolean;
    enable(): void;
    disable(): void;
    /** ViewManager tự đăng ký lúc init — hook không đi tìm global. */
    attach(viewManager: any): void;
    subscribe(fn: Listener): () => void;
    /** Hot path — phải rẻ khi tắt. */
    emit(type: DevtoolsEventType, data?: Omit<DevtoolsEvent, 'type' | 'at'>): void;
    getLog(): DevtoolsEvent[];
    clearLog(): void;
    /** Cây view đang mount: layout chain (ngoài → trong) rồi tới page. */
    getViewTree(): DevtoolsViewNode[];
    private toNode;
    /**
     * Ảnh chụp state — mọi giá trị đi qua JSON round-trip để cắt tham chiếu
     * DOM/hàm/vòng lặp: devtools không được giữ sống object của app, và
     * không được nổ khi state chứa cấu trúc vòng.
     */
    private snapshotState;
}
export declare const devtools: DevtoolsHook;
export default devtools;
//# sourceMappingURL=hook.d.ts.map