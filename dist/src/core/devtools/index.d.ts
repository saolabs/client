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
import devtools from './hook.js';
import inspector from './inspector.js';
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
    getViewTree: () => import("./hook.js").DevtoolsViewNode[];
    getLog: () => import("./hook.js").DevtoolsEvent[];
    clearLog: () => void;
    subscribe: (fn: Parameters<typeof devtools.subscribe>[0]) => () => void;
};
export { devtools, inspector };
export type { DevtoolsEvent, DevtoolsEventType, DevtoolsViewNode } from './hook.js';
export default Devtools;
//# sourceMappingURL=index.d.ts.map