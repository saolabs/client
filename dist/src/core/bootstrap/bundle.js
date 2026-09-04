/**
 * Bundle nạp rời — hợp đồng + loader.
 *
 * Bài toán: một gói build ĐỘC LẬP (theme) phải cắm được view / service /
 * helper / provider vào app đang chạy, mà không chia sẻ module graph với app.
 * Cầu nối là import map: `@saolabs/client` của gói đó resolve về đúng file
 * entry của app, nên hai bên dùng CHUNG một instance runtime. Xem
 * docs/EXTENSION_ARCHITECTURE.md §7.
 */
import logger from "../services/LoggerService";
/**
 * Khai báo một bundle. Chỉ là identity + kiểu — nó tồn tại để tên khoá là HỢP
 * ĐỒNG chứ không phải quy ước truyền miệng, và để IDE gợi ý được.
 *
 * @example
 * export default defineBundle({
 *     name: 'theme:aurora',
 *     views: { 'themes.aurora.modules.ping.index': factory },
 * });
 */
export function defineBundle(bundle) {
    return bundle;
}
function emptyMerged() {
    return { providers: [], services: {}, helpers: {}, views: {}, boots: [], loaded: [], failed: [] };
}
/**
 * Gộp nhiều manifest theo ĐÚNG THỨ TỰ mảng — không theo thứ tự resolve của
 * mạng. Bundle sau ĐÈ bundle trước ở `views`/`services`/`helpers`; `providers`
 * thì CỘNG THÊM chứ không thay, để một bundle không gỡ được provider của app.
 */
export function mergeBundles(bundles) {
    const out = emptyMerged();
    for (const bundle of bundles) {
        if (!bundle || typeof bundle !== 'object')
            continue;
        out.loaded.push(bundle.name ?? '(không tên)');
        if (Array.isArray(bundle.providers))
            out.providers.push(...bundle.providers);
        if (bundle.services)
            Object.assign(out.services, bundle.services);
        if (bundle.helpers)
            Object.assign(out.helpers, bundle.helpers);
        if (bundle.views)
            Object.assign(out.views, bundle.views);
        if (typeof bundle.boot === 'function')
            out.boots.push(bundle.boot.bind(bundle));
    }
    return out;
}
/**
 * Nạp danh sách URL bundle rồi gộp lại.
 *
 * Tải SONG SONG nhưng gộp theo thứ tự mảng — thứ tự URL là thứ tự ưu tiên do
 * server quyết định (`APP_CONFIGS.bundles`), không phải do mạng.
 *
 * Một URL hỏng KHÔNG làm sập boot: ghi vào `failed` rồi đi tiếp. Theme lỗi thì
 * site chạy bằng view gốc, còn hơn trắng trang.
 */
export async function loadBundles(urls) {
    if (!Array.isArray(urls) || urls.length === 0)
        return emptyMerged();
    const results = await Promise.all(urls.map(async (url) => {
        try {
            // URL đến từ runtime nên bundler không phân tích tĩnh được — đúng ý
            // đồ. Viết literal ở đây sẽ làm GÃY build của app (rollup cố resolve
            // một đường dẫn không có trong module graph).
            const mod = await import(/* @vite-ignore */ /* webpackIgnore: true */ url);
            // Bundle có thể khai manifest (export default) HOẶC tự đăng ký ngay
            // trong thân module qua App.View/App.set — import đã await xong nên
            // cả hai đều kịp trước khi render.
            return [url, (mod?.default ?? null), null];
        }
        catch (err) {
            return [url, null, String(err)];
        }
    }));
    const merged = mergeBundles(results.map(([, bundle]) => bundle));
    for (const [url, , error] of results) {
        if (error) {
            merged.failed.push([url, error]);
            logger.error(`[Bundle] Không nạp được "${url}": ${error}`);
        }
    }
    return merged;
}
/** Chạy `boot()` của các bundle, sau khi App đã init. Lỗi một cái không chặn cái sau. */
export function bootBundles(merged, app) {
    for (const boot of merged.boots) {
        try {
            boot(app);
        }
        catch (err) {
            logger.error('[Bundle] boot() ném lỗi:', err);
        }
    }
}
//# sourceMappingURL=bundle.js.map