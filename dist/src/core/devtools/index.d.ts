/**
 * DevTools — API công khai, gắn vào DI container dưới tên `Devtools`
 * (dùng `app('Devtools')` hoặc `App.devtools`).
 *
 * Tắt hoàn toàn mặc định: `emit()` thoát ngay ở dòng đầu khi chưa bật, nên
 * production không trả phí gì ngoài vài hàm không bao giờ chạy.
 *
 * @example
 * App.devtools.open();              // bật + mở panel
 * App.devtools.enableShortcut();    // Ctrl+Shift+D bật/tắt panel
 * App.devtools.getViewTree();       // đọc cây view bằng code
 */
import devtools from './hook';
import inspector from './inspector';
export declare const Devtools: {
    /** Bật thu thập sự kiện (chưa mở UI) — dùng khi chỉ cần đọc bằng code. */
    enable: () => void;
    disable: () => void;
    isEnabled: () => boolean;
    /** Bật + mở panel in-page. */
    open: () => void;
    close: () => void;
    toggle: () => void;
    isOpen: () => boolean;
    enableShortcut: () => void;
    getViewTree: () => import("./hook").DevtoolsViewNode[];
    getLog: () => import("./hook").DevtoolsEvent[];
    clearLog: () => void;
    subscribe: (fn: Parameters<typeof devtools.subscribe>[0]) => () => void;
};
export { devtools, inspector };
export type { DevtoolsEvent, DevtoolsEventType, DevtoolsViewNode } from './hook';
export default Devtools;
//# sourceMappingURL=index.d.ts.map