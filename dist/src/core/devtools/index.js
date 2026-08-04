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
import inspector, { bindDevtoolsShortcut } from './inspector';
export const Devtools = {
    /** Bật thu thập sự kiện (chưa mở UI) — dùng khi chỉ cần đọc bằng code. */
    enable: () => devtools.enable(),
    disable: () => { inspector.close(); devtools.disable(); },
    isEnabled: () => devtools.isEnabled(),
    /** Bật + mở panel in-page. */
    open: () => inspector.open(),
    close: () => inspector.close(),
    toggle: () => inspector.toggle(),
    isOpen: () => inspector.isOpen(),
    enableShortcut: () => bindDevtoolsShortcut(),
    getViewTree: () => devtools.getViewTree(),
    getLog: () => devtools.getLog(),
    clearLog: () => devtools.clearLog(),
    subscribe: (fn) => devtools.subscribe(fn),
};
export { devtools, inspector };
export default Devtools;
//# sourceMappingURL=index.js.map